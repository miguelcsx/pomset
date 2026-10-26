#!/usr/bin/env node
// Enforces the dependency directions recorded in docs/architecture/monorepo.md.
//
// The rule that matters most is that `packages/domain` stays pure policy: it may
// depend on `@pomset/contracts` and nothing else, and it may import no React,
// HTTP, persistence, GPU or solver code. The API, the CLI, the worker, the
// hosted consumer and the browser must all be able to reuse it verbatim, so a
// rule that drifts between offline and hosted operation cannot be expressed.
//
// The check is deliberately a small, explicit table rather than a general
// module-graph tool: the whole point is that the permitted edges are enumerated.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Workspace package directories, in the order they are declared. */
const packages = [
  "packages/contracts",
  "packages/domain",
  "packages/engine-client",
  "packages/storage",
  "packages/ui",
  "apps/cli",
  "apps/worker",
  "apps/api",
  "apps/web",
];

/**
 * The layer each package sits in, numbered so that **every** permitted edge
 * points strictly downward. The numbers are the longest dependency paths, which
 * is what "layers" means here: a package may use what is beneath it and never
 * what is beside or above it. The table in packages/README.md says the same
 * thing in words.
 */
const layerOf = {
  "packages/contracts": 1,
  "packages/domain": 2,
  "packages/engine-client": 2,
  "packages/ui": 2,
  "packages/storage": 3,
  "apps/web": 3,
  "apps/worker": 4,
  "apps/cli": 4,
  "apps/api": 5,
};

/**
 * Permitted `@pomset/*` imports per package. Any workspace import not listed
 * here is a violation, including one that is merely declared in package.json.
 */
const allowedWorkspaceDeps = {
  "packages/contracts": [],
  "packages/domain": ["@pomset/contracts"],
  "packages/engine-client": ["@pomset/contracts"],
  "packages/storage": ["@pomset/contracts", "@pomset/domain"],
  "packages/ui": ["@pomset/contracts"],
  "apps/cli": [
    "@pomset/contracts",
    "@pomset/domain",
    "@pomset/storage",
    "@pomset/engine-client",
    "@pomset/ui",
  ],
  "apps/worker": ["@pomset/contracts", "@pomset/storage", "@pomset/engine-client"],
  "apps/api": [
    "@pomset/contracts",
    "@pomset/domain",
    "@pomset/storage",
    "@pomset/worker",
  ],
  "apps/web": ["@pomset/contracts", "@pomset/ui"],
};

/**
 * External modules a package may never import, whatever its manifest says.
 * Prefix matches are supported with a trailing `*`.
 */
const forbiddenExternal = {
  "packages/contracts": ["react*", "@pomset/*", "express", "fastify"],
  "packages/domain": [
    "react*",
    "express",
    "fastify",
    "node:http",
    "node:https",
    "node:net",
    "better-sqlite3",
    "pg",
    "z3",
    "z3-solver",
    "@aws-sdk/*",
  ],
  "packages/engine-client": [
    "react*",
    "@pomset/storage",
    "@pomset/domain",
    "express",
    "better-sqlite3",
    "pg",
  ],
  "packages/ui": ["@pomset/storage", "@pomset/domain", "@pomset/engine-client"],
};

const importSpecifier = /(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function specifiersIn(source) {
  const found = new Set();
  for (const match of source.matchAll(importSpecifier)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (spec) found.add(spec);
  }
  return found;
}

function matches(pattern, spec) {
  if (pattern.endsWith("*")) return spec.startsWith(pattern.slice(0, -1));
  return pattern === spec;
}

const violations = [];

for (const dir of packages) {
  const abs = join(root, dir);
  const allowed = allowedWorkspaceDeps[dir] ?? [];
  const forbidden = forbiddenExternal[dir] ?? [];

  // Every permitted workspace edge must point strictly down the layer stack.
  for (const dep of allowed) {
    const target = packages.find((candidate) => `@pomset/${candidate.split("/").at(-1)}` === dep);
    if (!target) {
      violations.push(`${dir}: allows ${dep}, which is not a workspace package`);
      continue;
    }
    if (!(layerOf[target] < layerOf[dir])) {
      violations.push(
        `${dir}: allows ${dep}, but layer ${layerOf[dir]} may only depend on a lower layer`,
      );
    }
  }

  // Manifest declarations must not name a workspace package outside the table.
  const manifestPath = join(abs, "package.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const dep of Object.keys(manifest[field] ?? {})) {
        if (dep.startsWith("@pomset/") && !allowed.includes(dep)) {
          violations.push(
            `${dir}/package.json: declares ${dep} in ${field}, which is not an allowed dependency`,
          );
        }
      }
    }
  }

  for (const file of sourceFiles(join(abs, "src"))) {
    const where = relative(root, file);
    for (const spec of specifiersIn(readFileSync(file, "utf8"))) {
      if (spec.startsWith("@pomset/")) {
        if (!allowed.includes(spec.split("/").slice(0, 2).join("/"))) {
          violations.push(`${where}: imports ${spec}, which is not an allowed dependency`);
        }
      } else if (!spec.startsWith(".")) {
        for (const pattern of forbidden) {
          if (matches(pattern, spec)) {
            violations.push(`${where}: imports forbidden module ${spec}`);
          }
        }
      }
    }
  }
}

// Frontend feature leaves cannot import the composition root or one another
// except for the explicit pure working-copy dependency.
const webRoot = join(root, "apps/web/src/app");
const featureImports = {
  editor: [], scenario: [], workspace: [],
  analysis: ["workspace"], evidence: ["workspace"],
};
for (const file of sourceFiles(webRoot)) {
  if (/\.test\.tsx?$/.test(file)) continue;
  const feature = relative(webRoot, file).split("/")[0];
  if (!(feature in featureImports)) continue;
  for (const spec of specifiersIn(readFileSync(file, "utf8"))) {
    if (!spec.startsWith(".")) continue;
    const target = relative(webRoot, resolve(dirname(file), spec)).split("/")[0];
    if (target !== feature && !featureImports[feature].includes(target)) {
      violations.push(`${relative(root, file)}: ${feature} cannot import ${spec}`);
    }
  }
}

if (violations.length > 0) {
  for (const line of violations) console.error(`forbidden import: ${line}`);
  console.error(`\n${violations.length} boundary violation(s)`);
  process.exit(1);
}

console.log(`boundary check: ${packages.length} packages, 0 forbidden imports`);
