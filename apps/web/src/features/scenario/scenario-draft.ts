import type { Scenario } from "@pomset/contracts";
import { schemaSet } from "@pomset/contracts/browser";
const UNTITLED = "Untitled scenario";
export function newScenario(path: string): Scenario {
  return { schemaVersion: 1, scenarioId: `scn_${crypto.randomUUID()}`, snapshotId: `snp_${crypto.randomUUID()}`,
    name: UNTITLED, entrypoint: { path, symbol: "" },
    // The canonical contract and the domain engine both need at least one allocation, one variable and one constraint before analysis, so a new scenario starts with one of each.
    allocations: [{ allocationId: `al_${crypto.randomUUID()}`, name: "x", role: "input", dtype: "fp32", shape: [{ op: "literal", value: 1 }] }],
    launch: { grid: [{ op: "literal", value: 1 }], block: [{ op: "literal", value: 1 }] },
    domain: {
      domainId: `dom_${crypto.randomUUID()}`, enumerable: true,
      variables: [{ name: "N", kind: "shape", type: "int", width: "i32", min: 1, max: 8, step: 1 }],
      constraints: [{ constraintId: "c_1", lhs: { op: "parameter", parameter: "N" }, relation: "ge", rhs: { op: "literal", value: 1 } }],
    },
    requiredProperties: ["memoryBounds", "outputCoverage", "writeWriteConflict"], createdAt: new Date().toISOString() };
}
/** The name a saved script starts with: the scenario's own name once it has one, otherwise the entry point it analyses. */
export function scriptTitle(scenario: Scenario): string {
  if (scenario.name && scenario.name !== UNTITLED) return scenario.name;
  const { path, symbol } = scenario.entrypoint;
  return symbol ? `${path} · ${symbol}` : path;
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
/**
 * The scenario if the analysis can run it, otherwise undefined. An empty constraint set is refused by the domain engine, so it does not count.
 * An empty entry symbol is filled from the source when analysing, so it is checked with a placeholder and returned as it was.
 */
export function usableScenario(value: unknown): Scenario | undefined {
  const draft = value as Scenario | undefined;
  if (!draft?.entrypoint) return undefined;
  try {
    const checked = parseScenario(JSON.stringify({ ...draft, entrypoint: { ...draft.entrypoint, symbol: draft.entrypoint.symbol || "entry" } }));
    return (checked.domain.constraints ?? []).length > 0 ? draft : undefined;
  } catch {
    return undefined;
  }
}
