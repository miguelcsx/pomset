/**
 * The example a workbench with no saved work opens with. It is the catalog's
 * defect fixture, so the first analysis produces a finding a reviewer can read.
 * The source and the scenario come from the catalog, which stays the one copy.
 */

import type { WorkingCopy } from "../workspace/working-copy";
import { usableScenario } from "../scenario/scenario-draft";
import type { Scenario } from "@pomset/contracts";
import { getCatalogItem } from "./catalog-api";

export const STARTER_EXAMPLE_ID = "cat_triton_transform_floor_grid";

export interface StarterWorkspace {
  readonly copy: WorkingCopy;
  readonly scenario: Scenario;
}

export async function starterWorkspace(): Promise<StarterWorkspace | undefined> {
  const example = await getCatalogItem(STARTER_EXAMPLE_ID);
  const scenario = usableScenario(example.scenario);
  if (!scenario) return undefined;
  return { copy: { id: crypto.randomUUID(), files: [{ path: scenario.entrypoint.path, source: example.source }] }, scenario };
}
