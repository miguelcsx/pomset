import { describe, expect, it } from "vitest";

import type { Assumptions, Coverage, Finding, SampledCheck, Witness } from "@pomset/contracts";

import { createCoverage, coveragePercentage } from "./coverage.js";
import {
  createFinding,
  createPropertyResult,
  createSampledCheck,
  createWitness,
  hasStatedModel,
} from "./evidence.js";

const assumptions: Assumptions = {
  model: "triton-address-and-mask",
  modelRevision: "rev-1",
  domainRef: "dom_1",
  items: [
    { assumptionId: "a1", statement: "i32 wraparound is modelled", kind: "width" },
  ],
};

function result(overrides: Record<string, unknown>): ReturnType<typeof createPropertyResult> {
  return createPropertyResult({
    propertyResultId: "pr_1",
    propertyId: "outputCoverage",
    outcome: "violated",
    method: "symbolic",
    evidenceClass: "counterexample",
    assumptions,
    coverageRef: "cov_1",
    ...overrides,
  } as Parameters<typeof createPropertyResult>[0]);
}

describe("the closed outcome x method x evidenceClass table", () => {
  it("admits every listed combination", () => {
    const admitted = [
      { outcome: "established", method: "static", evidenceClass: "verified-under-assumptions" },
      { outcome: "established", method: "symbolic", evidenceClass: "verified-under-assumptions" },
      { outcome: "violated", method: "symbolic", evidenceClass: "counterexample" },
      { outcome: "violated", method: "static", evidenceClass: "counterexample" },
      { outcome: "violated", method: "instrumented", evidenceClass: "observed" },
      { outcome: "unknown", method: "static", evidenceClass: "potential", unknownReason: "budget" },
      { outcome: "unsupported", method: "symbolic", evidenceClass: "estimated", unsupportedReason: "atomics" },
    ] as const;
    for (const entry of admitted) {
      expect(result(entry).ok, JSON.stringify(entry)).toBe(true);
    }
  });

  it("refuses established paired with an instrumented observation", () => {
    const refused = result({ outcome: "established", method: "instrumented", evidenceClass: "observed" });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.rejections[0]?.record.code).toBe("INPUT_INVALID");
  });

  it("refuses violated paired with verified-under-assumptions", () => {
    const refused = result({ evidenceClass: "verified-under-assumptions" });
    expect(refused.ok).toBe(false);
  });

  it("refuses established without a stated model, revision and domain", () => {
    const refused = result({
      outcome: "established",
      method: "symbolic",
      evidenceClass: "verified-under-assumptions",
      assumptions: { ...assumptions, modelRevision: "" },
    });
    expect(refused.ok).toBe(false);
  });

  it("refuses an unknown without the reason it could not decide", () => {
    const refused = result({ outcome: "unknown", evidenceClass: "potential" });
    expect(refused.ok).toBe(false);
  });

  it("refuses a sampled check promoted to established", () => {
    const refused = result({
      outcome: "established",
      method: "symbolic",
      evidenceClass: "verified-under-assumptions",
      sampledCheckIds: ["sc_1"],
    });
    expect(refused.ok).toBe(false);
  });

  it("requires a stated model to be complete", () => {
    expect(hasStatedModel(assumptions)).toBe(true);
    expect(hasStatedModel({ ...assumptions, items: [] })).toBe(false);
  });
});

describe("findings and witnesses", () => {
  it("refuses a finding with no source range", () => {
    const finding = {
      schemaVersion: 1,
      findingId: "f_1",
      propertyId: "writeWriteConflict",
      evidenceClass: "counterexample",
      title: "two writers",
      actorIds: ["ac_1"],
      eventIds: ["ev_1"],
      sourceRanges: [],
    } as unknown as Finding;
    expect(createFinding(finding).ok).toBe(false);
  });

  it("admits a finding that links several actors, events and ranges", () => {
    const finding = {
      schemaVersion: 1,
      findingId: "f_1",
      propertyId: "writeWriteConflict",
      evidenceClass: "counterexample",
      title: "two writers",
      actorIds: ["ac_1", "ac_2"],
      eventIds: ["ev_1", "ev_2"],
      sourceRanges: [
        { path: "k.py", startLine: 1, startColumn: 0, endLine: 1, endColumn: 4 },
        { path: "k.py", startLine: 9, startColumn: 0, endLine: 9, endColumn: 4 },
      ],
    } as unknown as Finding;
    expect(createFinding(finding).ok).toBe(true);
  });

  it("requires a witness to record its minimisation outcome", () => {
    const witness = {
      witnessId: "w_1",
      kind: "output-index",
      assignments: [{ name: "N", value: 1025 }],
      actorIds: ["ac_1"],
      eventIds: ["ev_1"],
      sourceRanges: [{ path: "k.py", startLine: 1, startColumn: 0, endLine: 1, endColumn: 4 }],
      minimization: { attempted: false, droppedAssumptions: [] },
    } as unknown as Witness;
    expect(createWitness(witness).ok).toBe(false);
  });
});

describe("coverage and its denominator", () => {
  const enumerated: Coverage = {
    coverageId: "cov_1",
    domainRef: "dom_1",
    denominator: { kind: "enumerated", pointCount: 12288, duplicatesRemoved: true },
    regions: [
      {
        regionId: "r_1",
        constraints: ["N mod BLOCK != 0"],
        classifications: [
          { propertyId: "outputCoverage", classification: "violated", method: "symbolic", resultId: "pr_1" },
        ],
      },
    ],
  };

  it("admits an enumerated denominator with duplicates removed", () => {
    expect(createCoverage(enumerated).ok).toBe(true);
  });

  it("refuses a count over an unenumerated domain", () => {
    const refused = createCoverage({
      ...enumerated,
      denominator: { kind: "unenumerated", pointCount: 1000 },
    } as unknown as Coverage);
    expect(refused.ok).toBe(false);
  });

  it("refuses an enumerated denominator that did not deduplicate", () => {
    const refused = createCoverage({
      ...enumerated,
      denominator: { kind: "enumerated", pointCount: 10, duplicatesRemoved: false },
    } as unknown as Coverage);
    expect(refused.ok).toBe(false);
  });

  it("refuses a sampled classification without its sampled check", () => {
    const refused = createCoverage({
      ...enumerated,
      regions: [
        {
          regionId: "r_1",
          constraints: ["N > 0"],
          classifications: [{ propertyId: "memoryBounds", classification: "sampled", method: "symbolic" }],
        },
      ],
    } as unknown as Coverage);
    expect(refused.ok).toBe(false);
  });

  it("gives a percentage only for an enumerated denominator", () => {
    expect(coveragePercentage(enumerated, 6144)).toBe(0.5);
    const unenumerated = { ...enumerated, denominator: { kind: "unenumerated" } } as Coverage;
    expect(coveragePercentage(unenumerated, 10)).toBeUndefined();
  });
});

describe("sampled checks", () => {
  const check: SampledCheck = {
    sampledCheckId: "sc_1",
    strategyId: "boundary",
    strategyRevision: 1,
    seed: 20261011,
    budget: {
      solverTimeMs: 30000,
      engineWallTimeMs: 120000,
      memoryBytes: 2147483648,
      maxMessageBytes: 1048576,
      maxOutputBytes: 16777216,
      maxArtifactBytes: 268435456,
    },
    points: [
      { pointId: "p_1", assignments: [{ name: "N", value: 1024 }] },
      { pointId: "p_2", assignments: [{ name: "N", value: 1025 }] },
    ],
    observations: [
      { pointId: "p_1", observation: "passed" },
      { pointId: "p_2", observation: "failed" },
    ],
  };

  it("admits a check where every drawn point has one observation", () => {
    expect(createSampledCheck(check).ok).toBe(true);
  });

  it("refuses an observation of a point that was not drawn", () => {
    const refused = createSampledCheck({
      ...check,
      observations: [{ pointId: "p_9", observation: "passed" }],
    } as unknown as SampledCheck);
    expect(refused.ok).toBe(false);
  });
});
