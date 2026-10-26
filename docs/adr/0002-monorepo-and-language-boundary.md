# ADR-0002  Monorepo and language boundary

## Context

The product is split between two kinds of work. The control plane — projects,
scenarios, domains, policy, storage, HTTP, CLI and UI — is ordinary TypeScript
product work. The analysis work is Python over an AST and an SMT solver now, and
native tooling for CUDA and OpenMP later.

Putting both in one build system produces a TypeScript project that has to build
Python and a Python environment that has to be reached from a JS bundler. Making
the engines HTTP services introduces a network protocol, service discovery and a
deployment surface that the product does not need, and gives the engine
privileges it should not have.

## Decision

- The repository is a **pnpm workspace for TypeScript** and a **`uv` environment
  for Python**, coordinated at the root. Python and native builds are never
  forced through the JavaScript bundler.
- The product, the HTTP API, the CLI, the worker and the UI are TypeScript.
  `apps/web`, `apps/api`, `apps/cli`, `apps/worker` and `packages/*` per
  [`../architecture/monorepo.md`](../architecture/monorepo.md).
- Each engine under `engines/` is a **child process**, launched by the supervisor
  with a fixed argv vector over a read-only request file, speaking JSON Lines on
  stdin and stdout. stderr is bounded diagnostics.
- **No Python HTTP microservice.** An engine has no accounts, no publication
  rights and no hosted network access.
- `packages/domain` is pure policy with no React, HTTP, persistence, GPU or
  solver imports, and is reused by local and hosted consumers alike.
- Versions are pinned after compatibility probes, recorded in lockfiles, image
  digests and profile revisions.

## Consequences

- Two ecosystems must be set up on a developer machine and in CI. The
  compensating benefit is that neither build can break the other's.
- The engine boundary is a process boundary, so a crash is a process death that
  the supervisor can fence, time out and terminate — not a hung HTTP request.
- Protocol versioning becomes explicit and testable; see
  [`../srs/engine-protocol.md`](../srs/engine-protocol.md).
- Anything the engine needs must be passed in the request file. The engine can
  never read a path of its own choosing from an uploaded scenario.

## Validation obligations

- Confirm on Linux that the chosen sandbox image can run the pinned Python
  interpreter, `torch`, NumPy and the solver with bounded writable scratch, then
  record the image digest in the profile revision. Until that probe passes, the
  associated hosted capability stays unavailable.
- Confirm that a killed engine process tree leaves no orphaned children and no
  half-committed result.

## Links

Requirements: [`REQ-ENG-001`](../srs/engine-protocol.md) …
`REQ-ENG-017`, `REQ-SEC-011`, `REQ-CLI-001`.
Specifications: [`../architecture/monorepo.md`](../architecture/monorepo.md),
[`../architecture/security-and-deployment.md`](../architecture/security-and-deployment.md).
