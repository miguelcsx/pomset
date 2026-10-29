import { readFileSync } from "node:fs";

import type { NextConfig } from "next";

const version = (
  JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;

/**
 * The workbench serves the exported client from the same origin as its API, so
 * the loopback trust boundary in `apps/api` stays exactly as it was: one host,
 * one origin, one capability. `next dev` runs on its own port instead, which is
 * why rewrites and `output: export` are mutually exclusive here — a static
 * export has no server left to rewrite with.
 *
 * In development the dev server proxies `/api` to the workbench so the browser
 * still sees a single origin. Run `pnpm workbench` alongside `pnpm dev`.
 */
const exporting = process.env["POMSET_WEB_EXPORT"] === "1";
const workbench = process.env["POMSET_WORKBENCH_URL"] ?? "http://127.0.0.1:8811";

const config: NextConfig = {
  env: { NEXT_PUBLIC_POMSET_WEB_VERSION: version },
  // This repository keeps one set of agent instructions, at the root. Next.js
  // would otherwise write its own inside `apps/web` on every dev run.
  agentRules: false,
  // The API serves the export with a plain static handler and no fallback to
  // index.html. With a trailing slash every route is a directory index, which
  // that handler serves, so a direct load of /login or /mis-scripts/ works.
  ...(exporting
    ? { output: "export" as const, trailingSlash: true }
    : {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${workbench}/api/:path*` }];
        },
      }),
};

export default config;
