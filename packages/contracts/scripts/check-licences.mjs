#!/usr/bin/env node
// Fixture and licence provenance.
//
// Every kernel fixture must record where it came from, the licence it is used
// under and the outcome the analysis is expected to produce, so that a fixture
// without provenance cannot be committed. A fixture that is not Pomset's own
// work must additionally be named in the repository NOTICE with its origin,
// revision and licence: the BSD-2-Clause terms Compiler Explorer carries, for
// instance, require the notice to survive a source redistribution.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const fixturesDir = join(root, "fixtures/kernels");
const noticePath = join(root, "NOTICE");
const ourLicence = "Apache-2.0";

const failures = [];

if (!existsSync(noticePath)) {
  failures.push("NOTICE is missing");
}
const notice = existsSync(noticePath) ? readFileSync(noticePath, "utf8") : "";

let fixtures = 0;
let controls = 0;
const classes = new Map();

function fixtureDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name));
}

for (const backendDir of fixtureDirs(fixturesDir)) {
  for (const dir of fixtureDirs(backendDir)) {
    // Aggregate research outputs are not kernel fixtures. Kernel directories
    // under feasibility still require their own provenance manifests.
    if (relative(fixturesDir, dir) === "feasibility/reports") continue;
    const manifestPath = join(dir, "fixture.json");
    const where = relative(root, dir);
    if (!existsSync(manifestPath)) {
      failures.push(`${where}: no fixture.json`);
      continue;
    }
    fixtures += 1;
    const fixture = JSON.parse(readFileSync(manifestPath, "utf8"));

    for (const field of ["fixtureId", "class", "backend", "origin", "licence", "expectedOutcome"]) {
      if (!fixture[field]) failures.push(`${where}: fixture.json has no ${field}`);
    }
    if (!["defect", "control"].includes(fixture.class ?? "")) {
      failures.push(`${where}: class must be defect or control`);
    }

    // The entrypoint named must exist.
    if (fixture.entrypoint && !existsSync(join(dir, fixture.entrypoint))) {
      failures.push(`${where}: entrypoint ${fixture.entrypoint} does not exist`);
    }

    // A declared outcome must name a property and an outcome.
    const expected = fixture.expectedOutcome ?? {};
    if (!expected.property || !expected.outcome) {
      failures.push(`${where}: expectedOutcome must name a property and an outcome`);
    }

    // A reconstruction names the upstream case it reconstructs, and says so.
    if (fixture.origin === "reconstructed" && !fixture.reconstructs) {
      failures.push(`${where}: a reconstructed fixture names the upstream case it reconstructs`);
    }

    // Anything that is not our own work must be listed in NOTICE.
    if (fixture.licence !== ourLicence) {
      if (!notice.includes(fixture.fixtureId)) {
        failures.push(`${where}: licence ${fixture.licence} but ${fixture.fixtureId} is not listed in NOTICE`);
      }
    }

    classes.set(fixture.class, (classes.get(fixture.class) ?? 0) + 1);
    if (fixture.class === "control") controls += 1;
    console.log(`  ${where}: ${fixture.class} (${fixture.licence})`);
  }
}

// Every defect needs a correct control, or the gate has nothing to fail against.
const defects = classes.get("defect") ?? 0;
if (defects > 0 && controls === 0) {
  failures.push(
    `${defects} defect fixture(s) and no correct control; every defect ships with its control`,
  );
}

if (failures.length > 0) {
  for (const line of failures) console.error(`licence: ${line}`);
  console.error(`\n${failures.length} provenance failure(s)`);
  process.exit(1);
}
console.log(`licences: ${fixtures} fixtures (${defects} defect, ${controls} control), NOTICE present`);
