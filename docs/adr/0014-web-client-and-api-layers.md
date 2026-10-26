# ADR-0014  Web client and API layers

## Context

The workbench client was React, Monaco and Vite, composed in
`apps/web/src/app/Workbench.tsx` and served by the API from `apps/web/dist`
(ADR-0003). The API was a single Express module in which the router, the
controllers, the middlewares and the error mapping were the same file, so the
layers the packages already expressed — policy, storage, supervision — stopped
at the package boundary and reappeared mixed inside `apps/api`.

Two forces changed this. The client is expected to follow the framework the
course uses, which is Next.js with the App Router. And the API is expected to
show the layer shape the course uses: `domain`, `application`, `infrastructure`
and `interface`, with one place that decides composition.

What must not change is the loopback trust boundary of ADR-0013: the browser
talks to one host, one origin and one capability, and the workbench refuses
anything else.

## Decision

- **Next.js replaces Vite** for `apps/web`. The client is built as a static
  export; it was already entirely client-side, so nothing is prerendered that
  was not before. `apps/web/app/` is Next.js's own root and the composition root
  of the view; the feature leaves live under `apps/web/src/features/`.
- **One origin.** The workbench serves the exported client from the same origin
  as its API, so the browser never makes a cross-origin request and ADR-0013's
  boundary is untouched. The CLI's read-only viewer serves the same export.
- **Monaco is client-only.** It is mounted through `next/dynamic` with
  `ssr: false` and stays out of the server render. Its workers are declared as
  `new Worker(new URL(…, import.meta.url))`, the form a bundler can resolve
  statically; they and the editor are bundled locally, and no CDN is consulted.
- **The API is layered in place.** `apps/api/src` is `domain`, `application`,
  `infrastructure` and `interface`. `application` declares the ports it needs —
  `AnalysisRepository` and `EngineRunner` — and `infrastructure` implements
  them. Only the composition root (`app.ts`, `main.ts`, `bin/`) names a concrete
  adapter.
- **The shared packages stay packages.** `packages/domain`, `packages/storage`,
  `packages/engine-client` and `packages/contracts` are not dissolved into
  folders: they are the same layers, shared with the CLI, the worker and the
  Python engine. The one canonical contract set and the generated TypeScript and
  Python bindings remain authoritative.
- **A failure carries a category, not a status.** Handlers call `next(error)`;
  one middleware maps a category to an HTTP status. No layer infers a status
  from the text of a message.
- **Development is opt-in.** `next dev` runs on its own port and proxies to the
  workbench. Accepting the proxied origin requires `POMSET_WORKBENCH_DEV_ORIGIN`
  and still requires a loopback `Host`.

## Consequences

- The boundary check enforces the API's layers as well as the packages', so the
  shape is verified rather than merely intended.
- `apps/web/dist` and Vite's `assets/` layout disappear; the exported client
  lives in `apps/web/out` and is served by both the workbench and the CLI viewer.
- The report document keeps one shape across both transports, so the read-only
  viewer and the workbench still share one renderer (REQ-CLI-013). An envelope
  around it was considered and rejected: two shapes for one document would make
  the shared client branch on which server answered.
- A static export has no server, so Next.js rewrites and `output: export` are
  mutually exclusive. The development proxy therefore exists only when not
  exporting.
- Server rendering is given up. It was never used, and the alternative —
  keeping the client on its own origin in production — would have required
  weakening the check that ADR-0013 rests on.
- The workbench must be built before it is launched. When the export is absent
  the server says so, and names the command, rather than answering 404.

## Validation obligations

- Verify in a browser that Monaco mounts, that the editor accepts input and that
  a finding still selects its source range and its actors, with keyboard only.
- Verify in a browser that the workbench and the read-only viewer both render
  from the same client and the same report document.
- Demonstrate that a request from a foreign `Host` or a foreign `Origin` is
  still refused, and that the development allowance changes nothing until it is
  set.
- Confirm that no request leaves the loopback interface and that no asset is
  fetched from a CDN.

## Links

Requirements: `REQ-UX-004`, `REQ-CLI-012`, `REQ-CLI-013`, `REQ-UX-001` …
`REQ-UX-017`.
Amends: [ADR-0003](0003-workbench-composition.md) — the editor and the panels
stand; the bundler and the origin do not.
Specifications: [`../architecture/monorepo.md`](../architecture/monorepo.md),
[`../architecture/workbench.md`](../architecture/workbench.md).
