# Agent instructions

## What this is

`pomset` is a multi-language concurrency workbench for the web. The technical
specification in `docs/about.md` is normative: architecture, contracts,
isolation, budgets, catalogue and UI. There is no backend yet.

Read the relevant section before proposing anything. When something contradicts
the spec, the spec wins or an ADR is opened; it is not settled in the code.

## Branches

| Branch | Holds |
|---|---|
| `main` | The product: documents, licence, utilities. |
| `web/mock` | A navigable interface mock in plain HTML, CSS and JS. |

The mock is never merged into `main`. It is a maquette for validating the visual
language and the interaction states, not the eventual frontend, which is React,
Monaco and Dockview (ADR-006).

## Conventions

- **Code and repository documents in English**: file names, identifiers, CSS
  classes, commit messages, everything under `main`.
- **The mock's visible copy is Spanish.** Domain identifiers are never
  translated: `runtime`, `Tokio`, `asyncio`, `deadlock`, `snapshot` (§22.3).
- Files stay under 500 lines, ideally under 400, with one responsibility each.
- Conventional commits, signed.

## Rules that do not bend

These come from the product invariants (§23) and apply to the mock as well:

- Running is not publishing. Finishing a job is not proving correctness.
- "No failures observed" is never presented as proof. Green alone does not mean
  safe.
- An unsupported combination is explained, never silently swapped for something
  that looks close.
- A result belongs to the snapshot that was analysed, even after the source
  changes.

## Before calling something done

Check it in a browser, not by reading the code. For the mock, serve the branch
root with `python3 -m http.server`.
