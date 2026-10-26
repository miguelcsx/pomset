# ADR-0004  Contract authority

## Context

The same portable records — a project, a scenario, a workload domain, a finding,
a measurement, a bundle — are consumed and produced by TypeScript services, a
Python engine, a CLI and a browser UI. If each side defines its own types, a
field renamed in one place becomes a silent mismatch: a scenario that validates
in the UI, fails in the engine, and produces a report the UI cannot render.

There is also a temptation to define a type twice: once in an OpenAPI document
for HTTP and once in a schema for the portable artifact. Those two definitions
drift.

## Decision

- **JSON Schema 2020-12 is the authority** for every portable record: domain,
  evidence, measurement, engine and bundle types, and the publication records.
  The schemas live in [`../contracts/`](../contracts/README.md).
- **OpenAPI 3.1 describes the HTTP surface** and `$ref`s the same schema
  definitions for its request and response bodies. It does not redefine them.
- **Consumers are generated**: TypeScript bindings for the services, CLI, worker
  and UI, and Python bindings for the engines.
- **One canonical location.** At the implementation cutover the schemas move
  under `packages/contracts`. The documentation copy is the draft; there is
  never a second live authority.
- **One error vocabulary**, defined once and shared by HTTP responses, engine
  payloads, job failures and CLI reports.
- **`schemaVersion: 1`** for the initial portable format. An unsupported version
  is rejected at import, not coerced.

## Consequences

- A contract change is a schema change plus regenerated consumers; the compiler
  finds the call sites that no longer fit.
- The engine validates its input against the same schema the API produced it
  from, so a mismatch surfaces at the boundary rather than three layers in.
- Schemas are documents a human can read and a validator can check, which is what
  makes the documentation verifiable rather than decorative.
- Integers outside the interoperable JSON safe-integer range are encoded as
  decimal strings under explicit schemas. Non-I-JSON values are rejected.

## Validation obligations

- Validate every schema with a 2020-12 validator over the valid and invalid
  fixtures in [`../contracts/examples.md`](../contracts/examples.md).
- Validate the OpenAPI document with an OpenAPI 3.1 validator and confirm every
  local reference resolves.
- Confirm that a schema change which breaks a consumer is caught by a generated
  binding, not by a runtime surprise.

## Links

Requirements: [`REQ-PRJ-013`](../srs/projects.md), `REQ-EVD-004`, `REQ-ENG-013`,
`REQ-PERF-012`, `REQ-SHR-005`.
Specification: [`../contracts/README.md`](../contracts/README.md).
