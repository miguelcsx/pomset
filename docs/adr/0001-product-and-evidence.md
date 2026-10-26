# ADR-0001  Product and evidence

## Context

The source inputs proposed several different products. The earliest described a
broad multi-language concurrency laboratory spanning asyncio, Tokio, HIP/ROCm
and SYCL. A later assessment pivoted to detecting concurrency invariants broken
by compiler transformations. The highest-precedence input replaced both with a
question about the user's own kernel: under which inputs and configurations is
it correct, safe and efficient, and when it is not, why.

Three constraints come with that question. The compiler is not the subject, so
compiler-defect hunting cannot be a second objective. The product cannot promise
a universal proof, because no single execution model covers CUDA, C++ and
Triton. And a verified region, a tested region and an estimated region are three
different things that must never be presented as one.

## Decision

Pomset is a kernel behaviour-envelope workbench, and nothing else.

- The subject is the kernel the user writes, in Triton first, then CUDA C++ and
  OpenMP.
- The user-facing vocabulary is three experiences: **Explore**, **Validate**,
  **Optimize**. Execution mechanisms — `static`, `symbolic`, `instrumented`,
  `benchmark`, `artifact` — are a separate vocabulary.
- Every result carries one of six evidence classes: `observed`,
  `counterexample`, `potential`, `verified-under-assumptions`, `measured`,
  `estimated`.
- Proof is always relative: `established` requires a named model, a declared
  domain and visible assumptions. Absence of an observed failure is never
  proof.
- Compiler-invariant preservation, vendor-defect research, and the
  Observe/Explore/Verify mode vocabulary are recorded as superseded product
  tracks, not as a second project.

## Consequences

- The product cannot claim to verify arbitrary kernels, and does not try.
  Unsupported constructs are named and refused.
- The workbench must render qualification — coverage, assumptions, budget,
  origin — everywhere a number or a verdict appears.
- Competitive framing must be about explanation and domain qualification, not
  about being the first to detect races or the first to run GPUs in a browser.
  Precedent exists for both.

## Validation obligations

- The feasibility gate must show that at least one documented benefit exists
  over the comparison tools: an additional supported defect class, a smaller
  witness, a lower comparable cost, or a better explanation of a changing
  domain, without misclassifying the correct controls.
- Any claim about a specific tool's capability stays unvalidated until its probe
  and conformance fixtures pass.

## Links

Requirements: [`REQ-EVD-001`](../srs/evidence.md), `REQ-EVD-003`,
`REQ-EVD-015`, `REQ-DOM-007`, `REQ-UX-004`, `REQ-UX-005`.
Sources: [`SRC-001`](../reference/source-disposition.md),
`SRC-013`, `SRC-015`, `SRC-020`.
Superseded tracks are stated once in
[`../reference/source-disposition.md`](../reference/source-disposition.md).
