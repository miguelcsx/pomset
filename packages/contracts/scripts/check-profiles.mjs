#!/usr/bin/env node
// Validates every profile and capability manifest.
//
// A profile revision is an immutable measured statement, so this check enforces
// the things that make it one: it validates against the schema, it recomputes
// the revision hash from the record itself (with `--write` it fills it), it
// refuses a revision that pins no tool versions, and it refuses a capability
// that claims `validated` with no recorded conformance reference — nothing is
// advertised until its fixtures pass.
//
// Availability is deliberately not part of the hash: it is derived from
// deployment state at read time, so a deployment change must leave the support
// claim and the revision hash exactly as recorded.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const profilesDir = join(root, "profiles");
const write = process.argv.includes("--write");

const { createSchemaSet, loadSchemas, SCHEMA_DIR } = await import(
  join(root, "packages/contracts/dist/validate.js")
);
const { sha256Of, canonicalize } = await import(join(root, "packages/domain/dist/identity.js")).then(
  async (identity) => ({
    sha256Of: identity.sha256Of,
    canonicalize: (await import(join(root, "packages/domain/dist/canonicalize.js"))).canonicalize,
  }),
);

const schemas = createSchemaSet(loadSchemas(SCHEMA_DIR));
const failures = [];
let revisions = 0;
let capabilities = 0;

function revisionHash(record) {
  const withoutHash = { ...record };
  delete withoutHash.revisionHash;
  return sha256Of(canonicalize(withoutHash));
}

for (const backend of readdirSync(profilesDir, { withFileTypes: true })) {
  if (!backend.isDirectory()) continue;
  const dir = join(profilesDir, backend.name);
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".json") || entry.endsWith(".capabilities.json")) continue;
    const path = join(dir, entry);
    const revision = JSON.parse(readFileSync(path, "utf8"));
    revisions += 1;

    const validateRevision = schemas.validatorFor("domain.schema.yaml#/$defs/profileRevision");
    if (!validateRevision(revision)) {
      failures.push(`${path}: ${validateRevision.errors?.[0]?.instancePath} ${validateRevision.errors?.[0]?.message}`);
      continue;
    }

    // The revision hash is derived from the record, never supplied beside it.
    const computed = revisionHash(revision);
    if (write) {
      revision.revisionHash = computed;
      writeFileSync(path, `${JSON.stringify(revision, null, 2)}\n`);
    } else if (computed !== revision.revisionHash) {
      failures.push(
        `${path}: revision hash is stale (recorded ${revision.revisionHash}, recomputed ${computed})`,
      );
    }

    if (revision.components.length === 0) {
      failures.push(`${path}: the revision pins no tool versions`);
    }
    for (const component of revision.components) {
      if (!component.version) failures.push(`${path}: component ${component.name} names no version`);
    }

    const capabilitiesPath = join(dir, `${basename(entry, ".json")}.capabilities.json`);
    const records = JSON.parse(readFileSync(capabilitiesPath, "utf8"));
    const validateCapability = schemas.validatorFor("domain.schema.yaml#/$defs/capability");
    const ids = [];
    for (const capability of records) {
      capabilities += 1;
      ids.push(capability.capabilityId);
      if (!validateCapability(capability)) {
        failures.push(
          `${capabilitiesPath}: ${capability.capabilityId} ${validateCapability.errors?.[0]?.instancePath} ${validateCapability.errors?.[0]?.message}`,
        );
        continue;
      }
      if (!capability.support) {
        failures.push(`${capabilitiesPath}: ${capability.capabilityId} declares no support level`);
      }
      if (!capability.availability) {
        failures.push(`${capabilitiesPath}: ${capability.capabilityId} declares no availability`);
      }
      if (capability.support === "validated" && (capability.evidenceArtifactIds ?? []).length === 0) {
        failures.push(
          `${capabilitiesPath}: ${capability.capabilityId} claims validated with no conformance reference`,
        );
      }
    }

    const declared = [...revision.capabilityIds].sort();
    const found = [...ids].sort();
    if (JSON.stringify(declared) !== JSON.stringify(found)) {
      failures.push(
        `${path}: capabilityIds does not match ${basename(capabilitiesPath)} (${declared.length} declared, ${found.length} present)`,
      );
    }
    console.log(`  ${backend.name}/${entry}: ${ids.length} capabilities`);
  }
}

if (failures.length > 0) {
  for (const line of failures) console.error(`profile: ${line}`);
  console.error(`\n${failures.length} profile failure(s)`);
  process.exit(1);
}
console.log(
  write
    ? `profiles: wrote ${revisions} revision hashes`
    : `profiles: ${revisions} revisions and ${capabilities} capabilities validate`,
);
