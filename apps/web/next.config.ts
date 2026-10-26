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
  ...(exporting
    ? { output: "export" as const }
    : {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${workbench}/api/:path*` }];
        },
      }),
};

export default config;
