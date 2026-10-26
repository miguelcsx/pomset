/**
 * `pnpm workbench` — the explicitly launched local symbolic workstation.
 *
 * Source is parsed as data. User kernels, references and GPU code are never
 * imported or executed here; this is not a hosted execution profile.
 */

import { resolve } from "node:path";

import { startWorkbench } from "../main.js";

const port = Number(process.env["POMSET_WORKBENCH_PORT"] ?? 8811);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("Invalid POMSET_WORKBENCH_PORT");

const workbench = await startWorkbench({
  directory: resolve(process.env["POMSET_WORKBENCH_DATA"] ?? ".pomset-workbench"),
  port,
});

console.log(`Pomset local symbolic workbench: ${workbench.url}`);
console.log(
  "Source is parsed as data; user kernels, references and GPU code are not executed. Stop with Ctrl+C.",
);

let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (!closing) {
      closing = true;
      void workbench.close().then(() => process.exit(0));
    }
  });
