import { describe, expect, it } from "vitest";

import { kindLabel, parseCatalogItem, parseCatalogSummary } from "./catalog-api";

const item = {
  id: "cat_triton_transform_floor_grid",
  title: "Floor grid defect",
  summary: "Rounds the grid down.",
  kind: "defect",
  source: "def kernel(): pass",
  scenario: { allocations: [] },
  expectedOutcome: "fires",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

describe("parseCatalogItem", () => {
  it("accepts a complete item", () => {
    const parsed = parseCatalogItem(item);
    expect(parsed.id).toBe("cat_triton_transform_floor_grid");
    expect(parsed.kind).toBe("defect");
    expect(parsed.scenario).toEqual({ allocations: [] });
  });

  it("rejects a kind outside defect and control", () => {
    expect(() => parseCatalogItem({ ...item, kind: "warning" })).toThrow();
  });

  it("rejects a summary that omits the source", () => {
    const { source: _source, ...withoutSource } = item;
    expect(() => parseCatalogItem(withoutSource)).toThrow();
  });
});

describe("parseCatalogSummary", () => {
  it("ignores the source and scenario fields a list does not carry", () => {
    const { source: _source, scenario: _scenario, expectedOutcome: _outcome, ...summary } = item;
    expect(parseCatalogSummary(summary).title).toBe("Floor grid defect");
  });
});

describe("kindLabel", () => {
  it("names each kind for people reading the page", () => {
    expect(kindLabel("defect")).toBe("Defect");
    expect(kindLabel("control")).toBe("Control");
  });
});
