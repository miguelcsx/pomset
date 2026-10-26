# Packages and the layer stack

The backend is separated into layers, and a dependency may only point **down**
the stack. The rule is enforced mechanically by `scripts/check-boundaries.mjs`,
which fails the build on any import that leaves a package's allowed set, so the
separation is a property of the repository rather than a convention.

| Layer | Package | Holds | May depend on |
|---|---|---|---|
| 5 | `apps/api` | The HTTP surface: transport, auth, authorization | 4, 3, 2, 1 |
| 4 | `apps/cli` | The command line and the read-only local viewer | 3, 2, 1 |
| 4 | `apps/worker` | Process supervision and hosted job consumption | 3, 2, 1 |
| 3 | `packages/storage` | The consumer-visible lifecycle over both backends | 2, 1 |
| 3 | `apps/web` | The workbench: routing, store, layout, rendering | 2, 1 |
| 2 | `packages/domain` | Pure policy: what a project, scenario, result and policy are | 1 |
| 2 | `packages/engine-client` | The engine process boundary: protocol, launch, limits | 1 |
| 2 | `packages/ui` | Shared workbench primitives and tokens | 1 |
| 1 | `packages/contracts` | The canonical records and the error vocabulary | — |

The numbers are the longest dependency paths, so every edge is a step down and
none is a step sideways.

## Why the layers are drawn here

`packages/domain` is the layer that must not drift. Offline and hosted operation
answer the same questions — is this property satisfied, is this measurement
eligible, is this result allowed to claim that — and they must answer them the
same way, so the rules live in one pure package with no React, HTTP,
persistence, GPU or solver import, and both the API and the CLI import it rather
than restating it.

`packages/contracts` sits beneath everything because it is the only authority for
a portable record: the TypeScript and the Python bindings are generated from the
schemas, so a hand-written duplicate type cannot exist and the engine, the CLI
and the API cannot disagree about the shape of a message.

The transport packages hold no policy. `apps/api` decides *whether* a caller may
act and then delegates; `apps/cli` decides nothing about correctness and reports
what the engine found; `apps/worker` supervises a process and never interprets
what it produced.

## Patterns in use

- **Ports and adapters** for the two storage backends: one lifecycle interface,
  a local implementation over SQLite and a content-addressed filesystem, and a
  hosted implementation over PostgreSQL and an object store. Consumers depend on
  the interface, so no rule forks between deployments.
- **Immutable value types with validating constructors.** A value is either
  constructed valid or refused with a machine-readable rejection list; there is
  no partially repaired state to reason about, and an impossible combination —
  an established property derived from an instrumented run — is unconstructible
  rather than merely rejected.
- **A closed outcome table instead of an open matrix.** What a result may claim
  is data, generated from one authority and enforced at construction.
- **One error vocabulary** across HTTP, the engine protocol, job failures and
  CLI reports, so a failure is one story rather than several.
- **Explicit identity everywhere.** Compatibility, cache hits and eligibility are
  exact identity comparisons; nothing is inferred from resemblance, and a
  content hash is never an access credential.
- **The supervisor owns the process; the engine owns analysis.** The boundary
  between them is a child process and a line protocol, which is what makes
  running untrusted code a containment problem rather than a trust problem.
