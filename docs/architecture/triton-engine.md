# Triton engine

The CPU-side symbolic analyser for the first backend. The supported subset is
deliberately tiny; saying so is part of the product. Requirements:
[`../srs/exploration.md`](../srs/exploration.md),
[`../srs/backend-expansion.md`](../srs/backend-expansion.md). Decision:
[`../adr/0008-triton-analysis.md`](../adr/0008-triton-analysis.md).

## Initial supported DSL

Exactly this, and nothing else:

1. One `@triton.jit` entrypoint, selected explicitly by the scenario.
2. Named pointer arguments and integer or `tl.constexpr` parameters.
3. `tl.program_id`, a constant-bounded `tl.arange`, integer address arithmetic,
   comparisons and boolean masks.
4. `tl.load` and `tl.store` with an address expression and a mask.
5. Static `tl.constexpr` control flow only.

Everything else is `unsupported`, with the construct named and its source range
attached. That includes data-dependent addresses, dynamic loops, indirect
loads, reductions, dot products and atomics. Each of those families gets its own
model, extraction work and conformance fixtures before it is enabled
(`TASK-TRX-*`).

The engine **parses** the kernel. It never imports or executes the user module
for symbolic analysis. Symbolic and executable paths are separate operations
with separate trust boundaries.

## Symbolic variables

| Variable family | Source |
|---|---|
| Launch grid | The scenario's restricted launch expression AST. |
| Block shape and lane index | `tl.arange` and the launch configuration. |
| Shapes, strides | Declared allocations and domain variables. |
| Block-size, warp, stage choices | Domain variables. |
| Allocation and alias constraints | Declared alias groups. |

Value expressions may stay **uninterpreted** for queries that only ask about
addresses, masks and coverage. No numerical-correctness claim follows from an
uninterpreted query, and the result says so.

Integer encodings preserve the Triton widths the scenario declares, including
overflow. A width the engine cannot model is rejected rather than widened to a
mathematical integer, because widening would erase exactly the overflow defects
the analysis is meant to find.

## The three queries

All three share one extraction pass.

| Query | Property | What it answers |
|---|---|---|
| Bounds | `memoryBounds` | Is some enabled access outside its allocation, under some domain point? |
| Output coverage | `outputCoverage` | Does some declared output index have no enabled write under some domain point? |
| Write/write conflict | `writeWriteConflict` | Do two distinct program instances or lanes write the same address in an unordered, non-atomic way? |

Read/write conflicts, atomics, and synchronization or cross-scope diagnostics are
**not** part of the initial symbolic query. They are separate backend capabilities
delivered by the native or instrumented tools, or by a later explicitly modelled
feature.

### Interpreting an answer

| Solver result | Meaning |
|---|---|
| `unsat` | The property holds **over the declared model and domain only**. |
| `sat` | A witness: assignments, actors, source ranges, addresses. |
| Timeout or incomplete extraction | `unknown` or `unsupported`, with the reason. |

`unsat` is never a statement about the program in general. The assumptions it
rests on are printed next to it — the model name and revision, the domain, the
width and aliasing assumptions, and the solver version.

## Witnesses

A witness is the deliverable a developer can act on. It contains:

- the assignments that fix every domain variable the property depends on;
- the participating actors (program instances or lanes) with coordinates;
- the participating events with their address and mask expressions;
- the source ranges of those events.

Minimization is attempted, and **the assumptions the result depends on are never
dropped** to make the witness smaller. Replay through an independent execution
path is recorded when available; a CPU interpreter replay is a numerical and
modelling mechanism and is never presented as evidence of GPU scheduling, race
freedom or GPU speed.

## The flagship correction hint

When an output-coverage witness is caused by the recognized pattern — a positive
`N`, a positive `BLOCK`, and a floor-divided grid — the engine emits a correction
hint recommending `grid = (triton.cdiv(N, BLOCK),)`.

The hint is a **qualified explanation**, not a repair:

- it says which pattern it recognized and where,
- it requires the user to rerun validation,
- it never edits the kernel,
- it is never described as a proved functional repair.

Generic repair synthesis is out of scope. One recognized pattern with an explicit
trigger is the whole feature.

## Domain exploration

The engine supports exhaustive (only over an enumerated finite domain), random,
boundary, partition-guided and counterexample-guided sampling. Every run records
its strategy, strategy revision, seed and budget, so the same points can be
re-derived without re-running the exploration.

A found counterexample directs the next partition: the constraints under which
behaviour changed become the boundary of the next region. This is the mechanism
by which the product aims to need fewer experiments than exhaustive enumeration —
a hypothesis the feasibility gate has to measure, not a claim.

Sampled regions stay labelled sampled. A sampled pass never becomes a domain-wide
`established`.

## What the engine refuses

- An entrypoint that is not a single explicit `@triton.jit` function.
- A launch configuration whose divisors are not provably positive, or whose grid
  extents are not provably nonnegative, under the declared constraints.
- A domain that is empty, contradictory or unsatisfiable.
- A construct outside the supported subset, named explicitly.
- A width it cannot model.
- A value expression it would have to interpret to answer a numerical question
  it was not asked.

Each refusal is a result, not a crash: `unsupported` with a reason, or `unknown`
with a reason.
