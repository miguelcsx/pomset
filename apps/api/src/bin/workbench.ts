/**
 * `pnpm workbench` — the explicitly launched local symbolic workstation, and the
 * public deployment that runs the same workbench behind a platform route.
 *
 * Source is parsed as data. User kernels, references and GPU code are never
 * imported or executed here; this is not a hosted execution profile.
 *
 * A public deployment is selected by its hostname: `POMSET_WORKBENCH_PUBLIC_HOST`,
 * or `RENDER_EXTERNAL_HOSTNAME` which Render sets on every web service. It signs
 * sessions with `JWT_SECRET`, which is never written to the log.
 *
 * Demo accounts are created only when `POMSET_DEMO_ACCOUNTS=1`, and their
 * passwords come from `POMSET_DEMO_ADMIN_PASSWORD` and `POMSET_DEMO_USER_PASSWORD`.
 * They are never written to the log.
 */

import { resolve } from "node:path";

import { type DemoPasswords } from "../application/accounts/SeedDemoAccounts.js";
import { startWorkbench } from "../main.js";

const env = process.env;

const portValue = env["POMSET_WORKBENCH_PORT"] ?? env["PORT"] ?? "8811";
const port = Number(portValue);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("Invalid POMSET_WORKBENCH_PORT");

const publicHost = env["POMSET_WORKBENCH_PUBLIC_HOST"] || env["RENDER_EXTERNAL_HOSTNAME"] || undefined;
const jwtSecret = env["JWT_SECRET"] || undefined;
const demoAccounts = demoPasswords();

const workbench = await startWorkbench({
  directory: resolve(env["POMSET_WORKBENCH_DATA"] ?? ".pomset-workbench"),
  port,
  ...(publicHost ? { publicHost } : {}),
  ...(jwtSecret ? { jwtSecret } : {}),
  ...(demoAccounts ? { demoAccounts } : {}),
});

if (publicHost) console.log(`Pomset workbench is serving https://${publicHost}/ on port ${port}.`);
else console.log(`Pomset local symbolic workbench: ${workbench.url}`);
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

function demoPasswords(): DemoPasswords | undefined {
  if (env["POMSET_DEMO_ACCOUNTS"] !== "1") return undefined;
  const admin = env["POMSET_DEMO_ADMIN_PASSWORD"];
  const user = env["POMSET_DEMO_USER_PASSWORD"];
  if (!admin || !user)
    throw new Error(
      "POMSET_DEMO_ACCOUNTS=1 needs POMSET_DEMO_ADMIN_PASSWORD and POMSET_DEMO_USER_PASSWORD",
    );
  return { admin, user };
}
