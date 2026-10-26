import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { semanticProblems } from "./semantic.js";
import type { Scenario } from "./generated/index.js";
import { createSchemaSet, loadSchemas } from "./validate.js";

const schemaDir = fileURLToPath(new URL("../schema", import.meta.url));
const examplesDir = fileURLToPath(new URL("../../../docs/contracts/examples", import.meta.url));

interface ManifestEntry {
  readonly file: string;
  readonly schema: string;
  readonly why?: string;
  readonly contextScenario?: string;
}

interface Manifest {
  readonly valid: ManifestEntry[];
  readonly invalid: ManifestEntry[];
  readonly invalid_expected: ManifestEntry[];
}

const manifest = JSON.parse(
  readFileSync(`${examplesDir}/manifest.json`, "utf8"),
) as Manifest;
const schemas = createSchemaSet(loadSchemas(schemaDir));
const fixture = (file: string): unknown =>
  JSON.parse(readFileSync(`${examplesDir}/${file}`, "utf8"));

describe("canonical contract fixtures", () => {
  it("accepts every valid fixture through the schemas", () => {
    const rejected = manifest.valid.filter(
      (entry) => !schemas.validatorFor(entry.schema)(fixture(entry.file)) || semanticProblems(fixture(entry.file)).length > 0,
    );
    expect(rejected.map((entry) => entry.file)).toEqual([]);
  });

  it("rejects every invalid fixture including contextual semantics", () => {
    const accepted = [...manifest.invalid, ...manifest.invalid_expected]
      .filter((entry) => schemas.validatorFor(entry.schema)(fixture(entry.file)) && semanticProblems(fixture(entry.file), entry.contextScenario ? fixture(entry.contextScenario) as Scenario : undefined).length === 0);
    expect(accepted.map((entry) => entry.file)).toEqual([]);
  });

  it("covers all 22 valid and 13 invalid fixtures", () => {
    expect(manifest.valid).toHaveLength(22);
    expect(manifest.invalid.length + manifest.invalid_expected.length).toBe(13);
  });
});
