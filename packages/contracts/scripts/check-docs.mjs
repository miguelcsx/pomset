#!/usr/bin/env node
// Checks that every relative link inside docs/ resolves.
//
// The specification is a linked graph — requirements point at ADRs, tasks at
// contracts, acceptance scenarios at requirements — and moving a file silently
// breaks every inbound link. This check is the guard that caught the contract
// schemas moving to packages/contracts/schema.
//
// It deliberately does not check prose, identifiers or the requirement-to-task
// mapping; those are separate obligations.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const docsRoot = join(root, "docs");

function markdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownFiles(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g;
const problems = [];
let checked = 0;

for (const file of markdownFiles(docsRoot)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(linkPattern)) {
    const target = match[1];
    if (
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:") ||
      target.startsWith("#")
    ) {
      continue;
    }
    const [pathPart, fragment] = target.split("#");
    if (!pathPart) continue;
    checked += 1;
    const resolved = resolve(dirname(file), decodeURIComponent(pathPart));
    if (!existsSync(resolved)) {
      problems.push(`${relative(root, file)} -> ${target} (missing)`);
      continue;
    }
    if (fragment && statSync(resolved).isFile() && resolved.endsWith(".md")) {
      const body = readFileSync(resolved, "utf8");
      const wanted = decodeURIComponent(fragment).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const anchors = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) =>
        m[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      );
      if (!anchors.includes(wanted.replace(/^-|-$/g, ""))) {
        problems.push(`${relative(root, file)} -> ${target} (no such anchor)`);
      }
    }
  }
}

if (problems.length > 0) {
  for (const line of problems) console.error(`broken link: ${line}`);
  console.error(`\n${problems.length} broken link(s) of ${checked} relative links`);
  process.exit(1);
}
console.log(`docs links: ${checked} relative links resolve`);
