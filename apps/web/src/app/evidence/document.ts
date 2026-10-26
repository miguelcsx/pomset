/** Imported data is checked before rendering; consistency is not authenticity. */
import {
  schemaSet,
  evidenceLinkProblems,
  canonicalize,
} from "@pomset/contracts/browser";
import type { InspectionDocument } from "@pomset/ui";

export const MAX_REPORT_BYTES = 16_777_216;
export async function inspectionDocument(
  raw: unknown,
): Promise<InspectionDocument> {
  if (!raw || typeof raw !== "object")
    throw new Error("Report must be an object.");
  const record = raw as Record<string, unknown>;
  for (const [field, target] of Object.entries({
    analysis: "evidence.schema.yaml#/$defs/analysisResult",
    scenario: "domain.schema.yaml#/$defs/scenario",
    snapshot: "domain.schema.yaml#/$defs/snapshotManifest",
    profile: "domain.schema.yaml#/$defs/profileRevision",
  })) {
    const validate = schemaSet().validatorFor(target);
    if (!validate(record[field]))
      throw new Error(
        `${field}${validate.errors?.[0]?.instancePath}: ${validate.errors?.[0]?.message}. A legacy summary is insufficient for source-linked inspection.`,
      );
  }
  const document = raw as InspectionDocument;
  const { analysis, scenario, snapshot, profile } = document;
  async function hash(value: unknown): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonicalize(value)),
    );
    return (
      "sha256:" +
      [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  const { manifestHash, ...manifest } = snapshot;
  if ((await hash(manifest)) !== manifestHash)
    throw new Error("Snapshot manifest hash does not match.");
  const { revisionHash, ...revision } = profile;
  if ((await hash(revision)) !== revisionHash)
    throw new Error("Profile revision hash does not match.");
  if (
    analysis.snapshotId !== snapshot.snapshotId ||
    scenario.snapshotId !== snapshot.snapshotId ||
    analysis.scenarioId !== scenario.scenarioId ||
    analysis.profileRevisionId !== profile.profileRevisionId ||
    analysis.domain.domainId !== scenario.domain.domainId
  )
    throw new Error("Report provenance does not match its portable records.");
  const problems = evidenceLinkProblems(analysis, scenario);
  if (problems.length) throw new Error(problems.join("; "));
  if (
    record["job"] &&
    !schemaSet().validatorFor("engine.schema.yaml#/$defs/job")(record["job"])
  )
    throw new Error("Invalid job record.");
  if (document.job)
    for (const field of [
      "jobId",
      "attemptId",
      "snapshotId",
      "scenarioId",
      "profileRevisionId",
    ] as const)
      if (document.job[field] !== analysis[field])
        throw new Error("Job provenance does not match the evidence.");
  const paths = new Set<string>();
  for (const file of snapshot.files) {
    if (paths.has(file.path)) throw new Error("Duplicate snapshot path.");
    paths.add(file.path);
    const source = document.sourceFiles?.[file.path];
    if (!source || source.encoding !== "base64")
      throw new Error(`Captured source is missing: ${file.path}`);
    const bytes = Uint8Array.from(atob(source.data), (char) =>
      char.charCodeAt(0),
    );
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash =
      "sha256:" +
      [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    if (bytes.byteLength !== file.bytes || hash !== file.sha256)
      throw new Error(`Captured bytes do not match the snapshot: ${file.path}`);
  }
  const actorIds = new Set(analysis.actors?.map((actor) => actor.actorId));
  const eventIds = new Set(analysis.events?.map((event) => event.eventId));
  for (const finding of analysis.findings ?? []) {
    if (
      finding.actorIds.some((id) => !actorIds.has(id)) ||
      finding.eventIds.some((id) => !eventIds.has(id))
    )
      throw new Error("A finding references a missing actor or event.");
    if (finding.sourceRanges.some((range) => !paths.has(range.path)))
      throw new Error("A finding references source outside its snapshot.");
  }
  return document;
}
