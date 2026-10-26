# ADR-0009  Backend semantics

## Context

CUDA, C++ and Triton do not share a memory model. A GPU scope, a fence and a
barrier are not C++ atomics. A Triton kernel's ordering story is not the C++
ordering story. A data race under one model is not automatically a data race
under another, and two tools that both print "data race" may be describing
different things.

The temptation is to define one universal concurrency representation and
translate every backend into it. That representation would be wrong for every
backend at once, and the interface would produce confident, incorrect
explanations.

The alternative — one bespoke representation per backend — throws away the
product's actual value, which is presenting evidence from different tools in one
place.

## Decision

- **Shared contracts, separate semantics.** The portable evidence contracts —
  actors, memory events, findings, witnesses, assumptions, coverage, results,
  measurements — are common to all backends. The semantics under which a finding
  holds are not: each backend declares its ordering, atomicity, scope and
  synchronization model, and that model is attached to the finding.
- **Reuse external engines rather than inventing universal concurrency
  analysis.** Z3 for the Triton model; ThreadSanitizer and Archer for OpenMP;
  Compute Sanitizer and Nsight for CUDA. None of them is reimplemented.
- **Backend-qualified diagnostic categories.** Liveness, schedule dependence and
  memory ordering are categories with a stated model and a stated backend, not
  universal properties.
- **No cross-backend ranking or merging** into one verdict. Results from
  different backends appear as separate evidence about the same kernel with
  their own qualifiers.
- **A capability is declared per backend**, with a support level and an
  availability, and a backend offers nothing it has not passed conformance for.

## Consequences

- The comparison lanes are per profile revision, which is exactly what the
  behaviour-envelope idea needs: the same kernel under different engines, each
  answering what it can.
- The UI can compare conclusions without implying that the conclusions mean the
  same thing, because each carries its model.
- Adding a backend is adding a semantics declaration, a set of adapters and a
  conformance corpus — not extending a universal model.
- Some questions will have no backend that can answer them, and the answer is
  `unsupported`.

## Validation obligations

- Verify that a finding produced under one backend cannot be displayed as
  though it held under another's model, and that the model appears with it.
- Verify that a property established under one backend's model is not counted as
  satisfying a requirement declared against a different backend without an
  explicit, recorded capability statement.

## Links

Requirements: [`REQ-EVD-012`](../srs/evidence.md),
[`REQ-BCK-007`](../srs/backend-expansion.md), `REQ-BCK-012`,
[`REQ-VAL-008`](../srs/validation.md).
Specifications: [`../architecture/native-backends.md`](../architecture/native-backends.md),
[`../architecture/triton-engine.md`](../architecture/triton-engine.md).
