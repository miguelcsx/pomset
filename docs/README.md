# Pomset documentation

**Pomset — Parallel Behavior Explorer** answers one question about a parallel
kernel: *is this kernel correct, safe and efficient across the inputs and
configurations I actually intend to use, and when it is not, why?*

The unit of work is unchanged from the first product note: a **versioned
project**, a **scenario**, a set of **profiles**, the **jobs** they produce and
the **results** those jobs leave behind. What changed is the scope of the
question. Pomset is not a compiler-defect hunt and not another profiler; it
analyses the behaviour envelope of the kernel the user writes.

This directory is the implementation specification, alongside a partial implementation.

## Status

Contracts, domain helpers, supervision and a narrow Triton analyzer exist.
The [implementation audit](evaluation/implementation-audit.md) records their
limits and the baseline no-go gate. No complete acceptance scenario has been
closed. Architecture and delivery documents specify target behavior; their
future-tense descriptions are not current implementation claims. Tool support
requires measured conformance, independently of package or target existence.

The mock branch `web/mock` is a disposable maquette. It is not a specification
and it is not a source of product behaviour.

## Reading order

| Document | Answers |
|---|---|
| [`reference/source-disposition.md`](reference/source-disposition.md) | What each source input claimed, what was kept, superseded or left as evaluation, and why. The authority ledger. |
| [`reference/compiler-explorer.md`](reference/compiler-explorer.md) | What to adopt, adapt or reject from the Compiler Explorer reference, with source anchors. |
| [`reference/analysis-tool-landscape.md`](reference/analysis-tool-landscape.md) | The role of each external tool: chosen integration, feasibility comparison, historical context or unvalidated candidate. |
| [`srs/README.md`](srs/README.md) | Normative terms, actors, identifiers, acceptance format. |
| `srs/*.md` | The requirements, by family: `PRJ`, `DOM`, `EVD`, `EXP`, `VAL`, `PERF`, `UX`, `CLI`, `SHR`, `PLT`, `SEC`, `BCK`, `ENG`. |
| [`srs/traceability.md`](srs/traceability.md) | Requirement → source, ADR, contract, task, acceptance. |
| [`architecture/monorepo.md`](architecture/monorepo.md) | Package boundaries and dependency directions of the planned tree. |
| `architecture/*.md` | Behavioural specifications: lifecycle, Triton engine, exploration and validation, native backends, security and deployment, workbench, local CLI. |
| [`adr/README.md`](adr/README.md) | Indexed architecture decisions, and the line between a decision and an unvalidated capability. |
| [`contracts/README.md`](contracts/README.md) | The canonical portable contracts, identity rules, error vocabulary and HTTP surface. |
| [`delivery/README.md`](delivery/README.md) | The dependency DAG, milestones and task format. |
| `delivery/0*.md` | Runnable subtasks and gates. |
| [`evaluation/methodology.md`](evaluation/methodology.md) | How claims would be measured. |
| [`evaluation/acceptance.md`](evaluation/acceptance.md) | Canonical `ACC-###` scenarios. |

## Vocabulary

Two vocabularies are deliberately separate and must never be merged.

**Product experiences** — what the user is doing:

- **Explore** — investigate how accesses, masks, addresses and conflicts are
  distributed across blocks, threads and memory regions.
- **Validate** — declare the inputs and configurations that must be supported,
  and find out which properties hold, fail, or remain unknown there.
- **Optimize** — measure and compare the configurations that already satisfy
  the required properties.

**Execution mechanisms** — what actually ran:

`static`, `symbolic`, `instrumented`, `benchmark`, `artifact`.

`Observe` / `Explore` / `Verify` from the first product note is **superseded**.
It is not a second navigation, and it is not an evidence hierarchy. The six
evidence classes in [`srs/evidence.md`](srs/evidence.md) carry the epistemic
weight instead.

## Invariants

These hold in every phase and every document:

1. Running a job leaves the project unpublished. Publication is an explicit,
   separate act on a selected immutable snapshot.
2. Compiling for a target leaves it unexecuted, and produces artifacts, not
   behaviour.
3. Finishing a job proves nothing about correctness. A `succeeded` job may
   contain violated, unknown and unsupported results.
4. A result belongs to the snapshot that was analysed, even after the source
   changes.
5. Every number carries what qualifies it: coverage, assumptions and the
   profile that produced it.
6. An unsupported combination is explained. It is never swapped for something
   that merely looks close.
7. No failures observed is never presented as proof.

## Conventions

English throughout, relative links inside `docs/`. Requirements are normative
and live only in `srs/`; ADRs and tasks link them rather than restating them.
Canonical executable acceptance lives only in `evaluation/acceptance.md`.

Paths under `apps/`, `packages/`, `engines/`, `fixtures/` and `infra/` are
implementation targets, some of which now exist partially. The audit inventories
their current presence without treating it as acceptance evidence.
Inputs that are not tracked (`dont-track/`, `inspo/`, branch `web/mock`) are
described by name inside these documents and are never required reading.

## Licence

Apache-2.0 for Pomset. Selective reuse of Compiler Explorer keeps its
BSD-2-Clause notices; see [`reference/compiler-explorer.md`](reference/compiler-explorer.md).
