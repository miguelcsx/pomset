# Agent instructions

## What this is

`pomset` is a multi-language concurrency workbench for the web. You open a
project, pick a scenario, run it under one or more profiles, and read the
evidence each one produces.

The workbench is a Next.js client over a layered Express API, both in this
repository. `apps/api/src` is `domain`, `application`, `infrastructure` and
`interface`; the shared layers those use live in `packages/*`, which the CLI,
the worker and the Python engine reuse. The client is served from the API's own
origin, so a browser reaches one host and one capability.

Analysis runs in `engines/`, as a child process speaking JSON Lines over a
read-only request file. Two engines exist: `engines/triton`, which reads a kernel
and reasons about it symbolically and executes nothing, and `engines/openmp`,
which compiles a host-parallel kernel and runs it. Only the second one runs
anything the user wrote, so only the second one needs `--trust-local-code`, and
the workbench never runs it at all. Which engine a scenario belongs to is its
`launch` form.

## Branches

| Branch | Holds |
|---|---|
| `main` | The product: documents, licence, utilities. |
| `web/mock` | A navigable interface mock in plain HTML, CSS and JS. |

The mock is never merged into `main`. It is a maquette for settling the visual
language and the interaction states, and it gets thrown away once the real
frontend exists. That one is React with Monaco, built with Next.js
([ADR-0014](docs/adr/0014-web-client-and-api-layers.md)).

## Conventions

- **Code and repository documents in English**: file names, identifiers, CSS
  classes, commit messages, everything under `main`.
- **The mock's visible copy is Spanish.** Domain identifiers are never
  translated: `runtime`, `Tokio`, `asyncio`, `deadlock`, `snapshot`.
- Files stay under 500 lines, ideally under 400, with one responsibility each.
- Conventional commits, signed.

## Rules that do not bend

- Running a job leaves the project unpublished, and finishing one proves nothing
  about correctness.
- "No failures observed" is never presented as proof. Green alone does not mean
  safe.
- An unsupported combination gets explained. Never swap it for something that
  merely looks close.
- A result belongs to the snapshot that was analysed, even after the source
  changes.
- Every number carries what qualifies it: coverage, assumptions, and the profile
  that produced it.

## Before calling something done

Check it in a browser, not by reading the code. For the mock, serve the branch
root with `python3 -m http.server`.
