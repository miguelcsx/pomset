/** Exact scenario identity groups lanes; changed snapshots remain separate history. */
import type { InspectionDocument } from "@pomset/ui";
export const MAX_LANES = 4;
export const MAX_HISTORY = 20;
export function rememberReport(history: readonly InspectionDocument[], incoming: InspectionDocument): InspectionDocument[] {
  const existing = history.filter((item) => item.analysis.resultId !== incoming.analysis.resultId);
  if (existing.filter((item) => item.scenario.scenarioId === incoming.scenario.scenarioId).length >= MAX_LANES) throw new Error("This scenario already has four lanes. Open another workspace or remove a report before adding a lane.");
  if (existing.length >= MAX_HISTORY) throw new Error("This session has 20 captured reports. Remove a report before opening another.");
  return [...existing, incoming];
}
