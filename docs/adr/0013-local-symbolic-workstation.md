# ADR-0013 Local symbolic workstation

## Context

The user explicitly requested an editor → configure → analyze → inspect → share
loop on the available local machine. ADR-0007 prohibits a hosted web-to-local
execution bridge and ADR-0011 makes `pomset serve` read-only. Those boundaries
remain necessary. The requested workstation needs a separately opted-in surface.

## Decision

`pnpm workbench` explicitly launches a single-owner loopback application. It
accepts source text and canonical scenarios for the existing AST/Z3 analyzer.
It never imports or executes user source, references, CUDA, OpenMP or interpreter
replay. It exposes no executable, environment or arbitrary operation parameter.
This narrowly scoped source-as-data API is an authorized amendment, not a hosted
execution profile or a removal of the feasibility gate.

The browser starts with an empty file. Its source editor and evidence inspector
share the viewport with a resizable divider. A compact toolbar, file tabs,
collapsible scenario controls and bottom status line replace project-first
navigation. Evidence is visual by default: recorded access relationships,
witness inputs and domain classifications. Exact declarations, assumptions,
unsupported reasons and provenance remain inspectable. Diagram geometry encodes
neither elapsed time nor coverage percentage.

The service binds only to loopback, checks Host and Origin, requires a random
capability bearer token and same-origin writes, limits request size and concurrent
analysis, and delegates fixed engine launches to the existing supervisor. One
supervisor claims a store transactionally; another live owner is refused. Queued
attempts abandoned before launch fail on recovery rather than remaining pending.
This is a local trust boundary, not gVisor isolation. Kernel execution remains
unavailable here.

Source and configuration are captured in immutable SQLite/CAS snapshots. Results
are committed with cancellation precedence. The browser stores working drafts in
IndexedDB, reconnects to actual jobs, and compares inputs with captured evidence.
Following a historical source link displays captured bytes read-only and leaves
the current working files intact. The CLI viewer still has no submission route.

Sharing downloads a portable report after category-level disclosure preview.
Nothing is published and no public URL is invented. Hosted publication, retrieval
and revocation remain separately required and incomplete.

## Consequences

OpenMP validation does not inherently require a GPU; CUDA compilation need not
require a GPU either. The UI distinguishes unavailable adapters/toolchains from
GPU requirements. Local symbolic availability is based on actual interpreter,
engine and solver probes; probe success does not certify all model capabilities.
Only real measurements may populate performance views. The current local service
serializes analyses; distributed leases, ownership, deployment isolation and
production load validation remain hosted requirements.
