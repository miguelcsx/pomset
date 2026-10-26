#!/usr/bin/env node
// The cross-language identity check.
//
// The same fixture set is canonicalised and hashed by the TypeScript
// implementation and by the Python one; this script compares the two. Agreement
// is the point: a content hash that differs between the ecosystems means a
// snapshot identity that differs between the CLI and the engine.
//
// `--write` fills the expected manifest hashes from the TypeScript side, which
// is how the fixture's `expectedHash` values are established; the default mode
// then holds both implementations to them.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtures = join(root, "packages/contracts/fixtures/jcs");
const domainDist = join(root, "packages/domain/dist");

const { canonicalize } = await import(join(domainDist, "canonicalize.js"));
const { manifestHash } = await import(join(domainDist, "manifest.js"));

const write = process.argv.includes("--write");

const inputs = JSON.parse(readFileSync(join(fixtures, "inputs.json"), "utf8")).cases;
const manifestCase = JSON.parse(readFileSync(join(fixtures, "manifests.json"), "utf8"));

const tsCanonical = Object.fromEntries(inputs.map((c) => [c.name, canonicalize(c.value)]));
const tsHashes = Object.fromEntries(
  manifestCase.cases.map((c) => [c.name, manifestHash(c.manifest)]),
);

if (write) {
  manifestCase.cases = manifestCase.cases.map((c) => ({ ...c, expectedHash: tsHashes[c.name] }));
  writeFileSync(join(fixtures, "manifests.json"), `${JSON.stringify(manifestCase, null, 2)}\n`);
  console.log(`wrote ${manifestCase.cases.length} expected manifest hashes`);
  process.exit(0);
}

const python = JSON.parse(
  execFileSync(
    "uv",
    [
      "run",
      "--project",
      "engines/triton",
      "python",
      "-m",
      "pomset_triton.identity.manifest",
      "--fixtures",
      fixtures,
      "--json",
    ],
    { cwd: root, encoding: "utf8" },
  ),
);

const failures = [];

// 1. Every case with a documented canonical form must match it in both.
for (const testCase of inputs) {
  if (testCase.canonical === undefined) continue;
  if (tsCanonical[testCase.name] !== testCase.canonical) {
    failures.push(`typescript canonical ${testCase.name}: ${tsCanonical[testCase.name]} != ${testCase.canonical}`);
  }
  if (python.canonical[testCase.name] !== testCase.canonical) {
    failures.push(`python canonical ${testCase.name}: ${python.canonical[testCase.name]} != ${testCase.canonical}`);
  }
}

// 2. Both implementations must agree on every case, documented or not.
for (const name of Object.keys(tsCanonical)) {
  if (tsCanonical[name] !== python.canonical[name]) {
    failures.push(`canonical disagreement on ${name}: ts=${tsCanonical[name]} py=${python.canonical[name]}`);
  }
}

// 3. Manifest hashes must agree, and match the recorded expectation.
for (const testCase of manifestCase.cases) {
  if (tsHashes[testCase.name] !== python.hashes[testCase.name]) {
    failures.push(`manifest hash disagreement on ${testCase.name}`);
  }
  if (testCase.expectedHash && tsHashes[testCase.name] !== testCase.expectedHash) {
    failures.push(`typescript manifest hash ${testCase.name} drifted from the fixture`);
  }
}

// 4. Reordering the manifest's *members* must not change the hash. Array order
//    is part of the value — JCS sorts member names, not array elements — so
//    reordering the file list legitimately produces a different manifest.
const original = manifestCase.cases.find((c) => c.name === "two-files-reordered").manifest;
const shuffledMembers = Object.fromEntries(Object.entries(original).reverse());
if (manifestHash(shuffledMembers) !== tsHashes["two-files-reordered"]) {
  failures.push("reordering the manifest's member names changed the manifest hash");
}

if (failures.length > 0) {
  for (const line of failures) console.error(`identity: ${line}`);
  console.error(`\n${failures.length} identity failure(s)`);
  process.exit(1);
}
console.log(
  `identity: ${Object.keys(tsCanonical).length} canonical cases and ${Object.keys(tsHashes).length} manifest hashes agree across languages`,
);
