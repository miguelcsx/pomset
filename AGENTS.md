# Agent instructions

## What this is

`pomset` is a multi-language concurrency workbench for the web. You open a
project, pick a scenario, run it under one or more profiles, and read the
evidence each one produces. There is no backend yet.

## Branches

| Branch | Holds |
|---|---|
| `main` | The product: documents, licence, utilities. |
| `web/mock` | A navigable interface mock in plain HTML, CSS and JS. |

The mock is never merged into `main`. It is a maquette for settling the visual
language and the interaction states, and it gets thrown away once the real
frontend exists. That one will be React with Monaco.

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
