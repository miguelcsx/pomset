# Architecture decisions

An ADR records a **decision** with its consequences. A statement that a tool
supports something is not a decision and does not belong here; it belongs in
[`../reference/analysis-tool-landscape.md`](../reference/analysis-tool-landscape.md)
and remains unvalidated until a probe runs.

The local symbolic workstation amendment is [ADR-0013](0013-local-symbolic-workstation.md).

## The distinction

| | Where it lives | Status |
|---|---|---|
| Architecture decision | this directory | accepted; implementable now |
| Tool capability claim | landscape, capability manifests | unvalidated until the probe and conformance fixtures pass |
| Requirement | [`../srs/`](../srs/README.md) | normative |

An ADR cites the requirements it serves. It does not restate them, and where a
requirement and an ADR conflict, the requirement wins.

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-product-and-evidence.md) | Kernel-only behaviour-envelope product with Explore/Validate/Optimize and six evidence classes. | accepted |
| [0002](0002-monorepo-and-language-boundary.md) | pnpm/uv tree; TypeScript product and CLI; isolated Python/native engines behind a subprocess protocol. | accepted |
| [0003](0003-workbench-composition.md) | React, Monaco and Vite with bounded CSS-grid panels; shared semantic tokens; no GoldenLayout/jQuery/EventHub. | accepted |
| [0004](0004-contract-authority.md) | JSON Schema 2020-12 is the portable authority; OpenAPI 3.1 references it; generated consumers. | accepted |
| [0005](0005-snapshots-and-artifacts.md) | Immutable, content-addressed snapshot and artifact manifests; ownership separate from content identity. | accepted |
| [0006](0006-jobs-and-persistence.md) | SQLite/CAS locally, PostgreSQL and leased jobs plus object storage hosted; no proprietary queue requirement. | accepted |
| [0007](0007-sandbox-and-local-runners.md) | Hosted CPU-only jobs in gVisor/runsc isolation; GPU work only on user-operated local runners. | accepted |
| [0008](0008-triton-analysis.md) | CPU-side parse of a restricted kernel DSL with an address/mask model and Z3 queries; no import of user modules for symbolic analysis. | accepted |
| [0009](0009-backend-semantics.md) | Shared presentation and evidence contracts, separate per-backend memory and event semantics, external engines reused. | accepted |
| [0010](0010-performance-and-eligibility.md) | Required-property policy gates recommendations and benchmark execution; imports stay labelled; measurements are not proofs. | accepted |
| [0011](0011-private-local-and-publication.md) | Offline operation, no implicit upload, explicit publication with a disclosure preview. | accepted |
| [0012](0012-research-gates-and-compatibility.md) | Feasibility before the full web product; feature-by-feature tool probes; later-phase documentation stays specified even if a gate fails. | accepted |

## Template

```text
# ADR-NNNN  Title

## Context
What forces this decision, and what it is not.

## Decision
The choice, stated so that an implementer can follow it.

## Consequences
What becomes easy, what becomes impossible, and what must be maintained.

## Validation obligations
What would have to be probed or measured to falsify a supporting assumption.

## Links
Requirements, specifications, tasks.
```
