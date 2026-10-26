/** Compare qualified evidence without editing either historical record. */
import { readPortableReport } from "../portable-report.js";
import { canonicalize } from "@pomset/domain";


export function compare(baselinePath: string, currentPath: string): { status: number; document: unknown } {
  const baseline = readPortableReport(baselinePath);
  const current = readPortableReport(currentPath);
  if (!baseline.scenario || !current.scenario || !baseline.snapshot || !current.snapshot || !baseline.analysis || !current.analysis) throw new Error("INPUT_INVALID: comparison requires portable evidence with named snapshots");
  if (canonicalize(baseline.scenario.domain) !== canonicalize(current.scenario.domain)) throw new Error("INPUT_INVALID: domains differ; no approximate comparison was made");
  if (baseline.profileRevisionId !== current.profileRevisionId || baseline.policyId !== current.policyId || baseline.policyRevision !== current.policyRevision) throw new Error("INPUT_INVALID: profile or policy revisions differ");
  const files = [...new Set([...baseline.snapshot.files.map((file) => file.path), ...current.snapshot.files.map((file) => file.path)])].sort().map((path) => {
    const before = baseline.snapshot?.files.find((file) => file.path === path)?.sha256;
    const after = current.snapshot?.files.find((file) => file.path === path)?.sha256;
    return { path, change: !before ? "added" : !after ? "removed" : before === after ? "unchanged" : "modified", before, after };
  });
  const properties = current.scenario.requiredProperties.map((propertyId) => {
    const before = baseline.properties.find((property) => property.propertyId === propertyId)?.outcome;
    const after = current.properties.find((property) => property.propertyId === propertyId)?.outcome;
    const movement = before === after ? "unchanged" : after === "violated" ? "regressed" : before === "violated" && after === "established" ? "improved" : "inconclusive";
    return { propertyId, before, after, movement,
      baselineRegions: baseline.analysis?.coverage.regions.filter((region) => region.classifications.some((classification) => classification.propertyId === propertyId)),
      currentRegions: current.analysis?.coverage.regions.filter((region) => region.classifications.some((classification) => classification.propertyId === propertyId)) };
  });
  return { status: properties.some((property) => property.movement === "regressed") ? 1 : properties.some((property) => property.movement === "inconclusive") ? 2 : 0,
    document: { schemaVersion: 1, baselineSnapshotId: baseline.snapshotId, currentSnapshotId: current.snapshotId, profileRevisionId: current.profileRevisionId, policyId: current.policyId, files, properties } };
}
