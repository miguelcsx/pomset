import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type {
  IntExpr,
  LaunchConfig,
  ProgramInstanceLaunch,
  Scenario as ScenarioRecord,
} from "@pomset/contracts";

import { aliasingAllocations, createScenario, launchParameters } from "./scenario.js";
import { validateScenario } from "./validate.js";

const examplePath = fileURLToPath(
  new URL("../../../docs/contracts/examples/scenario.json", import.meta.url),
);

function example(): ScenarioRecord {
  return JSON.parse(readFileSync(examplePath, "utf8")) as ScenarioRecord;
}

/** The canonical example is launched as program instances, so its grid is there. */
function exampleLaunch(): ProgramInstanceLaunch {
  return example().launch as ProgramInstanceLaunch;
}

/** A shallow copy with one launch dimension replaced. */
function withLaunchGrid(grid: readonly IntExpr[]): unknown {
  const scenario = example();
  return { ...scenario, launch: { ...exampleLaunch(), grid } };
}

/** The same kernel declared as a host thread team instead. */
function withLaunch(launch: LaunchConfig): ScenarioRecord {
  return { ...example(), launch };
}

describe("scenario validation", () => {
  it("accepts the canonical example scenario", () => {
    const result = validateScenario(example());
    expect(result.ok).toBe(true);
  });

  it("keeps exactly one entrypoint and one declared launch", () => {
    const result = createScenario(example());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scenario.entrypoint.symbol).toBe("transform");
    // A second entrypoint cannot be constructed: the contract carries one object.
    // @ts-expect-error a scenario has exactly one entrypoint, not an array of them
    const _two: ScenarioRecord = { ...example(), entrypoint: [] };
    void _two;
  });

  it("rejects an unknown property id that lacks the reserved prefix", () => {
    const scenario = { ...example(), requiredProperties: ["numericalDrift"] };
    const result = validateScenario(scenario);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections[0]?.record.code).toBe("INPUT_INVALID");
    expect(result.rejections[0]?.pointer).toBe("/requiredProperties/0");
  });

  it("rejects a launch parameter that no domain variable declares", () => {
    const scenario = withLaunchGrid([
      { op: "floorDivide", operands: [{ op: "parameter", parameter: "M" }, { op: "parameter", parameter: "BLOCK" }] },
    ]);
    const result = validateScenario(scenario);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections.some((r) => r.record.message.includes("M"))).toBe(true);
  });

  it("rejects a divisor that is not provably positive", () => {
    const scenario = withLaunchGrid([
      { op: "floorDivide", operands: [{ op: "parameter", parameter: "N" }, { op: "literal", value: 0 }] },
    ]);
    const result = validateScenario(scenario);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections[0]?.record.message).toContain("not provably positive");
  });

  it("rejects a grid dimension that is not provably nonnegative", () => {
    const scenario = withLaunchGrid([
      {
        op: "subtract",
        operands: [{ op: "parameter", parameter: "N" }, { op: "literal", value: 4096 }],
      },
    ]);
    const result = validateScenario(scenario);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections[0]?.record.message).toContain("nonnegative");
  });

  it("rejects a scenario whose required property set is empty", () => {
    const scenario = { ...example(), requiredProperties: [] };
    const result = validateScenario(scenario);
    expect(result.ok).toBe(false);
  });

  it("reports the declared launch parameters", () => {
    const result = createScenario(example());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...launchParameters(result.value)].sort()).toEqual(["BLOCK", "N"]);
  });

  it("accepts the same kernel launched as a host thread team", () => {
    // No grid and no block: the runtime owns the threads, and the kernel only
    // declares how many it wants.
    const scenario = withLaunch({
      threads: { op: "parameter", parameter: "BLOCK" },
      schedule: "dynamic",
      chunk: { op: "literal", value: 64 },
    });
    const result = createScenario(scenario);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...launchParameters(result.value)].sort()).toEqual(["BLOCK"]);
  });

  it("rejects a host thread count that no domain variable declares", () => {
    const scenario = withLaunch({
      threads: { op: "parameter", parameter: "M" },
    });
    const result = validateScenario(scenario);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections.some((r) => r.record.message.includes("M"))).toBe(true);
  });

  it("rejects a host thread count that is not provably positive", () => {
    // A team of zero threads is not a launch, so nonnegative is not enough.
    for (const threads of [
      { op: "literal", value: 0 },
      { op: "subtract", operands: [{ op: "parameter", parameter: "N" }, { op: "parameter", parameter: "N" }] },
    ] as const) {
      const result = validateScenario(withLaunch({ threads }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.rejections.some((r) => r.record.message === "thread count is not provably positive")).toBe(true);
    }
  });

  it("rejects a launch that is neither form", () => {
    // `grid` without `block` is neither a program instance launch nor a host
    // one, so the union has no branch for it and the schema says so.
    const result = validateScenario(withLaunch({ grid: [{ op: "literal", value: 1 }] } as unknown as LaunchConfig));
    expect(result.ok).toBe(false);
  });

  it("never infers aliasing: an allocation outside a group stands alone", () => {
    const result = createScenario(example());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const allocationId = result.value.scenario.allocations[0]?.allocationId ?? "";
    expect(aliasingAllocations(result.value, allocationId)).toEqual([allocationId]);
  });

  it("is immutable: a change is a compile error", () => {
    const result = createScenario(example());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // @ts-expect-error scenario values are readonly; a change produces a new value
    result.value.scenario.entrypoint.path = "other.py";
    // @ts-expect-error the allocations collection is readonly
    result.value.scenario.allocations.push(result.value.scenario.allocations[0]);
  });
});
