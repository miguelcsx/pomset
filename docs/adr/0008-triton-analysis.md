# ADR-0008  Triton analysis

## Context

The first delivery phase must answer three questions about a Triton kernel
without a GPU: does an enabled access fall outside its allocation, is there an
output index no enabled write covers, and do two program instances write the
same address without ordering. The reference implementation for Triton support
elsewhere patches the Triton cache and the driver to emit compilation artifacts,
which imports and executes user Python. That is artifact extraction. It is not
symbolic verification and it is not a safe boundary.

Triton's interpreter executes program instances sequentially on the CPU. It is
documented as not modelling GPU scheduling or GPU performance, and it has
documented dtype and indirect-load limitations.

## Decision

- **A restricted kernel DSL is parsed on the CPU**, never imported and never
  executed, for symbolic analysis. The supported subset is enumerated in
  [`../architecture/triton-engine.md`](../architecture/triton-engine.md): one
  `@triton.jit` entrypoint selected explicitly, named pointer arguments, integer
  and constexpr parameters, `tl.program_id`, constant-bounded `tl.arange`,
  integer address arithmetic, comparisons and boolean masks, `tl.load` and
  `tl.store`, and static constexpr control flow only.
- **Symbolic variables** cover launch grid, shape, strides, block choices and
  declared allocation and alias constraints. Integer encodings preserve the
  supported Triton widths and their overflow behaviour; an unsupported width is
  rejected rather than modelled as an unbounded mathematical integer.
- **The model is address and mask, not value.** Value expressions may stay
  uninterpreted for address and coverage queries that do not depend on them, and
  no numerical-correctness claim follows from such a query.
- **Three separate queries** over one shared extraction: bounds, output
  coverage, and non-atomic write/write conflict.
- **`unsat` establishes the property over the declared model and domain only.**
  `sat` yields a witness with assignments, actors, source ranges and addresses.
  Timeout or incomplete extraction yields `unknown` or `unsupported`.
- **Unsupported semantics fail explicitly.** Data-dependent addresses, dynamic
  loops, indirect loads, reductions, dot products and atomics are `unsupported`
  with the construct named. Each later family gets its own model, extraction and
  conformance work.
- **Genuine compilation and replay remain separate operations** with their own
  sandbox and consent requirements. CPU interpreter replay is a numerical and
  modelling mechanism; it is never presented as GPU scheduling or GPU timing.

## Consequences

- The first phase needs no GPU, which keeps the free tier viable and makes the
  engine deterministic and testable.
- The supported subset is small, and saying so is part of the product. A user
  with an unsupported kernel gets an explanation, not a guess.
- Witnesses are meaningful precisely because they are minimal over a small
  model; a large model would make the witness too large to read.
- The query, model revision and solver version are recorded with every result, so
  a re-run under a newer model can legitimately disagree and say so.

## Validation obligations

- Demonstrate the flagship case: with `BLOCK=256` and a floor-divided grid,
  `N=1024` has no modelled output hole and `N=1025` yields unwritten index 1024
  with its snapshot, launch and mask provenance.
- Demonstrate a minimized overlapping-write fixture producing two distinct
  writers, an address, masks and source locations, with a corrected
  non-overlapping control producing no modelled conflict.
- Demonstrate that unsupported constructs return `unsupported` and never a
  silent approximation.
- Verify the interpreter's documented limitations are surfaced, not cast
  around.

## Links

Requirements: [`REQ-EXP-001`](../srs/exploration.md) …
`REQ-EXP-013`, [`REQ-BCK-001`](../srs/backend-expansion.md), `REQ-BCK-010`,
`REQ-BCK-011`.
Specification: [`../architecture/triton-engine.md`](../architecture/triton-engine.md).
Reference: [`../reference/compiler-explorer.md`](../reference/compiler-explorer.md).
