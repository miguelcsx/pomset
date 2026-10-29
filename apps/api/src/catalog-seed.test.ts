/**
 * The reviewed examples the catalog starts with. Each one must be the fixture
 * it names, byte for byte, and each scenario must be one the workbench accepts,
 * so a seeded entry can never be a copy that drifted from the evidence.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCatalogInput } from "./domain/catalog/CatalogItem.js";
import { CATALOG_SEED } from "./infrastructure/accounts/catalogSeed.js";

const FIXTURES: Record<string, { folder: string; kind: string }> = {
  cat_triton_transform_floor_grid: { folder: "transform_floor_grid", kind: "defect" },
  cat_triton_transform_ceil_grid: { folder: "transform_ceil_grid", kind: "control" },
};

describe("catalog seed", () => {
  it("holds exactly the defect and its control, with unique identifiers", () => {
    expect(CATALOG_SEED.map((item) => item.id).sort()).toEqual(Object.keys(FIXTURES).sort());
    expect(new Set(CATALOG_SEED.map((item) => item.id)).size).toBe(CATALOG_SEED.length);
  });

  for (const item of CATALOG_SEED) {
    describe(item.id, () => {
      const expected = FIXTURES[item.id]!;
      const fixtureDir = resolve("../../fixtures/kernels/triton", expected.folder);

      it("is the fixture's kernel source, unchanged", () => {
        expect(item.source).toBe(readFileSync(resolve(fixtureDir, "kernel.py"), "utf8"));
      });

      it("is the fixture's class", () => {
        const fixture = JSON.parse(readFileSync(resolve(fixtureDir, "fixture.json"), "utf8")) as { class: string };
        expect(item.kind).toBe(fixture.class);
        expect(item.kind).toBe(expected.kind);
      });

      it("passes the same checks a catalog write passes, scenario included", () => {
        const { id: _id, ...input } = item;
        expect(() => parseCatalogInput(input)).not.toThrow();
      });
    });
  }
});
