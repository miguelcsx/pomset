# Software requirements

Requirements are normative and live only here. Architecture decisions
([`../adr/`](../adr/README.md)), behaviour specifications
([`../architecture/`](../architecture/README.md)) and delivery tasks
([`../delivery/`](../delivery/README.md)) link to these identifiers rather than
restating a competing policy. Where a specification and a requirement disagree,
the requirement wins and the specification is the defect.

## Normative terms

- **SHALL** — mandatory for the phase that owns the requirement.
- **SHOULD** — strongly recommended; a departure is recorded with its reason.
- **MAY** — genuinely optional.
- **MUST NOT** — prohibited.

## Actors

| Actor | What they do | What they need from Pomset |
|---|---|---|
| Kernel author | Writes a Triton, CUDA C++ or OpenMP kernel and declares the inputs it must support. | To find out where behaviour changes, and why, before shipping. |
| Investigator | Reproduces someone else's failure from a shared experiment. | Enough provenance to rerun it and to see what differed. |
| CI maintainer | Runs the local CLI in a pipeline over proprietary source. | Deterministic exit statuses, no upload, no telemetry. |
| Operator | Runs the hosted deployment. | Quotas, isolation, durable jobs, no hidden privileges. |
| Reviewer of evidence | Reads a report and must judge a claim. | Coverage, assumptions, budget and the profile that produced each number. |

## Product boundaries

In scope: user-written kernels in Triton (first), CUDA C++ and OpenMP
(subsequent required phases); their behaviour envelope over a declared domain;
symbolic analysis on CPU for the supported Triton subset; real numerical,
instrumented and measured evidence through external tools; local and CI use;
explicit publication.

Out of scope: compiler-internal defect research; a universal concurrency model;
a hosted GPU pool; automatic web-to-local execution; distributed-training
runtimes; a general-purpose autotuner; a general-purpose profiler; languages
beyond the selected backends.

## Identifiers

| Prefix | Meaning | Where |
|---|---|---|
| `REQ-<FAMILY>-NNN` | Requirement | this directory |
| `ACC-NNN` | Acceptance scenario | [`../evaluation/acceptance.md`](../evaluation/acceptance.md) |
| `SRC-NNN` | Source claim | [`../reference/source-disposition.md`](../reference/source-disposition.md) |
| `TASK-<EPIC>-NNN` | Implementation task | [`../delivery/`](../delivery/README.md) |
| `ADR-NNNN` | Architecture decision | [`../adr/`](../adr/README.md) |

Requirement identifiers are stable. A withdrawn requirement is marked
withdrawn with its reason rather than renumbered.

## Families

| Family | File | Subject |
|---|---|---|
| `PRJ` | [`projects.md`](projects.md) | Projects, files, scenarios, snapshots, comparison. |
| `DOM` | [`domains.md`](domains.md) | The workload domain and its regions. |
| `EVD` | [`evidence.md`](evidence.md) | Evidence classes, findings, coverage, budget. |
| `EXP` | [`exploration.md`](exploration.md) | Extraction, queries, witnesses, exploration. |
| `VAL` | [`validation.md`](validation.md) | Required properties, numerical reference, replay. |
| `PERF` | [`performance.md`](performance.md) | Measurement, import, eligibility, comparison. |
| `UX` | [`workbench.md`](workbench.md) | The workbench and its states. |
| `CLI` | [`local-ci.md`](local-ci.md) | Offline CLI, manifests, exit statuses, CI. |
| `SHR` | [`sharing.md`](sharing.md) | Publication, bundles, disclosure, revocation. |
| `PLT` | [`platform.md`](platform.md) | Profiles, availability, durability, quotas, operations. |
| `SEC` | [`security.md`](security.md) | Trust boundaries, sandboxing, imports, leakage. |
| `BCK` | [`backend-expansion.md`](backend-expansion.md) | Triton, CUDA C++ and OpenMP delivery obligations. |
| `ENG` | [`engine-protocol.md`](engine-protocol.md) | Protocol, lifecycle, cancellation, errors. |

## Requirement format

```text
REQ-FAMILY-NNN  Short imperative title
                          (the heading form is: three # then REQ-FAMILY-NNN then two spaces then the title)

**Statement.** The system SHALL ...

**Rationale.** Why this exists. Sources: `SRC-###`, `SRC-###`.

**Acceptance.** What is observable. Executed only by `ACC-###`.

**Scope.** Backend and phase qualification. What this does not claim.

**Implemented by.** `TASK-EPIC-NNN`, `TASK-EPIC-NNN`.

**Contracts.** Schema types and specification sections this constrains.
```

## Rule: acceptance lives in one place

A requirement states *what must be observable*. The executable scenario that
observes it is written once, as `ACC-###` in
[`../evaluation/acceptance.md`](../evaluation/acceptance.md). A requirement MAY
narrate an illustrative example, but the canonical check is the `ACC-`
scenario. No requirement defines its own private test procedure.

## Rule: four things acceptance must keep apart

Every acceptance scenario distinguishes:

1. **Job completion** — the job reached a terminal state.
2. **Sampled success** — the finite sample that ran reported no failure.
3. **Evidence classification** — what the produced records actually claim.
4. **Formal proof** — established over a stated model and domain, with
   assumptions attached.

A green run means (1) and possibly (2). It never means (3) or (4).

## Rule: no requirement without a task and a scenario

Every requirement is implemented by at least one task and observed by at least
one acceptance scenario, and every retained source goal reaches a requirement.
The mapping is maintained in [`traceability.md`](traceability.md) and checked
mechanically.
