import { describe, expect, it } from "vitest";

import type { IntExpr, WorkloadDomain } from "@pomset/contracts";

import { createWorkloadDomain, enumerateDomain, signsOfVariable } from "./domain.js";
import {
  describe as describeExpression,
  evaluateIntExpr,
  isProvablyPositive,
  validateLaunch,
} from "./expr.js";

const parameter = (name: string): IntExpr => ({ op: "parameter", parameter: name });
const literal = (value: number): IntExpr => ({ op: "literal", value });
const binary = (op: IntExpr["op"], left: IntExpr, right: IntExpr): IntExpr => ({
  op,
  operands: [left, right],
});

/** The domain the canonical example scenario declares. */
const DOMAIN: WorkloadDomain = {
  domainId: "dom_1",
  variables: [
    { name: "N", kind: "shape", type: "int", width: "i32", min: 1, max: 4096, step: 1 },
    { name: "BLOCK", kind: "blockSize", type: "int", width: "i32", values: [128, 256, 512] },
  ],
  enumerable: true,
  hardwareCohortIds: ["hw_a100_80g"],
  constraints: [
    { constraintId: "c1", lhs: parameter("N"), relation: "ge", rhs: literal(1) },
    { constraintId: "c2", lhs: parameter("BLOCK"), relation: "gt", rhs: literal(0) },
  ],
};

function model(domain: WorkloadDomain = DOMAIN) {
  const result = createWorkloadDomain(domain);
  if (!result.ok) throw new Error("fixture domain must be valid");
  return result.value;
}

describe("the integer expression evaluator", () => {
  it("evaluates floor division as the launch does", () => {
    const result = evaluateIntExpr(binary("floorDivide", parameter("N"), parameter("BLOCK")), {
      N: 1025,
      BLOCK: 256,
    });
    expect(result).toEqual({ ok: true, value: 4 });
  });

  it("evaluates ceiling division", () => {
    const result = evaluateIntExpr(binary("ceilDivide", parameter("N"), parameter("BLOCK")), {
      N: 1025,
      BLOCK: 256,
    });
    expect(result).toEqual({ ok: true, value: 5 });
  });

  it("evaluates modulo", () => {
    const result = evaluateIntExpr(binary("modulo", parameter("N"), parameter("BLOCK")), {
      N: 1025,
      BLOCK: 256,
    });
    expect(result).toEqual({ ok: true, value: 1 });
  });

  it("refuses a divisor of zero rather than clamping", () => {
    const result = evaluateIntExpr(binary("floorDivide", parameter("N"), literal(0)), { N: 8 });
    expect(result.ok).toBe(false);
  });

  it("refuses an unbound parameter at a domain point", () => {
    const result = evaluateIntExpr(parameter("M"), { N: 1 });
    expect(result.ok).toBe(false);
  });

  it("renders an expression stably", () => {
    expect(describeExpression(binary("floorDivide", parameter("N"), parameter("BLOCK")))).toBe(
      "floorDivide(N, BLOCK)",
    );
  });
});

describe("the launch evaluator", () => {
  it("admits the floor-divided grid the example declares", () => {
    const result = validateLaunch(
      { grid: [binary("floorDivide", parameter("N"), parameter("BLOCK"))], block: [parameter("BLOCK")] },
      model(),
      "launch",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const signs = result.value.gridSigns[0] ?? [];
    expect(signs).not.toContain("negative");
  });

  it("proves a divisor positive from the declaration alone", () => {
    expect(isProvablyPositive(parameter("BLOCK"), model())).toBe(true);
    expect(isProvablyPositive(literal(256), model())).toBe(true);
    expect(isProvablyPositive(literal(0), model())).toBe(false);
  });

  it("refuses a divisor the declaration does not prove positive", () => {
    const relaxed = {
      ...DOMAIN,
      variables: [
        { name: "N", kind: "shape", type: "int", min: 1, max: 4096, step: 1 },
        { name: "BLOCK", kind: "blockSize", type: "int", min: 0, max: 8, step: 1 },
      ],
      constraints: [{ constraintId: "c1", lhs: parameter("N"), relation: "ge", rhs: literal(1) }],
    } as WorkloadDomain;
    const result = validateLaunch(
      {
        grid: [binary("floorDivide", parameter("N"), parameter("BLOCK"))],
        block: [parameter("BLOCK")],
      },
      model(relaxed),
      "launch",
    );
    // BLOCK ranges over 0..8, so no constraint proves it positive.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections[0]?.record.message).toContain("not provably positive");
  });

  it("quotes the offending subexpression on refusal", () => {
    const result = validateLaunch(
      { grid: [binary("subtract", parameter("N"), literal(4096))], block: [literal(1)] },
      model(),
      "launch",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections[0]?.record.details?.["expression"]).toBe("subtract(N, 4096)");
  });
});

describe("the workload domain", () => {
  it("enumerates every declared point when the domain is finite", () => {
    const points = enumerateDomain(model());
    expect(points).toBeDefined();
    expect(points).toHaveLength(4096 * 3);
  });

  it("refuses a domain that declares no variable", () => {
    const result = createWorkloadDomain({ ...DOMAIN, variables: [] });
    expect(result.ok).toBe(false);
  });

  it("refuses a domain whose constraints are empty", () => {
    const result = createWorkloadDomain({ ...DOMAIN, constraints: [] });
    expect(result.ok).toBe(false);
  });

  it("refuses a variable of an unsupported kind", () => {
    const variable = {
      ...DOMAIN.variables[0],
      kind: "clockFrequency",
    } as unknown as WorkloadDomain["variables"][number];
    const result = createWorkloadDomain({ ...DOMAIN, variables: [variable] });
    expect(result.ok).toBe(false);
  });

  it("refuses a constraint that names an undeclared variable", () => {
    const result = createWorkloadDomain({
      ...DOMAIN,
      constraints: [{ constraintId: "c9", lhs: parameter("M"), relation: "gt", rhs: literal(0) }],
    });
    expect(result.ok).toBe(false);
  });

  it("derives signs from the declared values", () => {
    expect(signsOfVariable(model(), "BLOCK")).toEqual(["positive"]);
    expect(signsOfVariable(model(), "N")).toEqual(["positive"]);
  });
});
