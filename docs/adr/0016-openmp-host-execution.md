# ADR-0016  The OpenMP host-execution backend

## Context

The only analysis in the repository was the Triton symbolic engine, which reads
a deliberately tiny subset of a kernel and executes nothing. Everything the
OpenMP backend needed was specified — `docs/delivery/09-openmp-and-advanced-triton.md`
names its package and its tasks, the contract already carried `openmp` in the
`backend` enumeration and `numericalAgreement`, `initialization`,
`raceFreedom`, `synchronizationOrdering` and `deadlockFreedom` among its
properties — and none of it existed as code.

The purpose of this backend is the case that needs neither a host nor a device: a
host-parallel kernel is compiled and run on the machine the analysis runs on.

Two facts were measured rather than assumed, because they decide what the
backend may claim:

- Clang with `-fopenmp` compiles and runs here. A kernel carrying a data race
  gave a different answer at one thread count and the right one at others, in the
  same build.
- **ThreadSanitizer does not run on this platform.** Every binary built with
  `-fsanitize=thread` dies before `main`, with or without OpenMP. The repository's
  own audit already recorded "specified Linux combination not available here";
  the probe now measures it and names the signal.

## Decision

- **`launch` has two forms, and the form decides the backend.** A
  program-instance launch places instances on a device; a host-threads launch
  declares how the runtime parallels work the kernel does not place. Reading the
  form is what selects the engine, rather than a flag, because a flag could name a
  backend the scenario cannot use.
- **The OpenMP engine is a second engine behind the same process boundary.**
  It is a child process speaking JSON Lines over a request file, launched by a
  fixed argv vector like the first one, and it shares the protocol package rather
  than restating it.
- **Executing the kernel requires consent, per invocation, from the CLI.**
  `REQ-CLI-011` and ADR-0013 stand: the loopback workbench accepts source as data
  and never compiles or runs OpenMP. It can render a report the CLI produced; it
  cannot produce one. Consent is settled before any process or directory exists,
  is carried on the request so the engine checks it too, and is never remembered.
- **This harness's conventions are the harness's, and are declared.** The entry
  point takes each declared allocation as a pointer and each numeric domain
  variable as a scalar, in declaration order; inputs hold a deterministic pattern
  defined once and emitted both as C and as Python; outputs are poisoned at the
  declared width before the call. A scenario that does not fit is refused by name.
- **What the engine may say is bounded by the contract, not by taste.** A run that
  agreed is `unknown` with a reason: `REQ-EVD-003` admits `established` only
  through reasoning over a stated model. A disagreement is `violated` with method
  `instrumented` and evidence class `observed`. A run that did not finish is
  unknown progress and never a deadlock. What was executed is a `sampledCheck`,
  one observation per declared domain point.
- **Instrumentation that cannot run is `unsupported` with the measured
  reason.** `raceFreedom`, `synchronizationOrdering` and `deadlockFreedom` are
  refused by naming the capability and the signal that killed it. A clean run
  would say nothing about race freedom in any case, so nothing is claimed either
  way.

## Consequences

- OpenMP analysis is reachable from the CLI and not from the workbench. That is
  the intended asymmetry, not an unfinished path: the workbench's trust boundary
  is source-as-data, and running a kernel from a browser page is a different act
  that would need its own decision.
- No instrumented path exists on this platform, so the backend's race,
  synchronization and deadlock capabilities are unavailable here and say so.
  On Linux, where the combination is specified, they would be a different profile
  with its own measured revision.
- There is no source map for a compiled kernel, so a violation names the element
  that differed and the values it held, and carries neither a finding nor a
  witness: both require a source range, and inventing one would be inventing
  precision. The detail is recorded in the coverage notes.
- The thread counts are a request. The harness sets `OMP_NUM_THREADS` before each
  run; a kernel carrying a `num_threads` clause ignores it, and the harness cannot
  see the team size from outside. The coverage says what was asked for, and an
  assumption names the limit.
- Two properties are decided, and they do not overlap. An element that was never
  written is `initialization`; a value that differs from the reference is
  `numericalAgreement`. The second reports that the elements which *were* written
  agreed, and that the rest were never written, rather than claiming agreement
  over an output the comparison never reached.

## Validation obligations

- Demonstrate that a defect is caught and its control is not, on the same
  machine, in the same build. The `partial-write` fixture pair does this
  deterministically and is exercised by CI.
- Demonstrate that the same defect is *sometimes* missed. The `missing-reduction`
  fixture is kept for that: a corpus that cannot show a miss cannot show whether a
  check works.
- Confirm that an OpenMP scenario is refused without the consent flag, before any
  process starts, and that a symbolic scenario still needs no consent.
- Confirm that nothing this backend reports can be read as race freedom, and that
  an unavailable capability always carries its measured reason.

## Links

Requirements: `REQ-BCK-003`, `REQ-BCK-011`, `REQ-EVD-002`, `REQ-EVD-003`,
`REQ-EVD-010`, `REQ-VAL-005`, `REQ-VAL-006`, `REQ-VAL-008`, `REQ-CLI-011`.
Supersedes nothing: [ADR-0013](0013-local-symbolic-workstation.md) is unchanged,
and this is the CLI path it left open.
Specifications: [`../architecture/native-backends.md`](../architecture/native-backends.md),
[`../delivery/09-openmp-and-advanced-triton.md`](../delivery/09-openmp-and-advanced-triton.md).
