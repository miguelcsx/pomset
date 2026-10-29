import type { Scenario } from "@pomset/contracts";
import { schemaSet } from "@pomset/contracts/browser";
export function newScenario(path: string): Scenario {
  return { schemaVersion: 1, scenarioId: `scn_${crypto.randomUUID()}`, snapshotId: `snp_${crypto.randomUUID()}`,
    name: "Untitled scenario", entrypoint: { path, symbol: "" }, allocations: [],
    launch: { grid: [{ op: "literal", value: 1 }], block: [{ op: "literal", value: 1 }] },
    domain: { domainId: `dom_${crypto.randomUUID()}`, enumerable: true, variables: [], constraints: [] },
    requiredProperties: ["memoryBounds", "outputCoverage", "writeWriteConflict"], createdAt: new Date().toISOString() };
}
/** The first top-level `def` name in a Python source, the function an analysis runs by default. */
export function inferEntrypoint(source: string | undefined): string | undefined {
  return source?.match(/^def ([A-Za-z_][A-Za-z0-9_]{0,63})\(/m)?.[1];
}
export function parseScenario(text: string): Scenario {
  const value: unknown = JSON.parse(text);
  const validate = schemaSet().validatorFor("domain.schema.yaml#/$defs/scenario");
  if (!validate(value)) throw new Error(`Scenario ${validate.errors?.[0]?.instancePath}: ${validate.errors?.[0]?.message}`);
  return value as Scenario;
}
