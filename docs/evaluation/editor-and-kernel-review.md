# Editor and kernel review — 2026-10-11

This review follows the user's tab/context-menu, text-density, module-boundary
and native-backend feedback. It is a targeted implementation review against the
existing specification inventory, not proof that every function or every
acceptance scenario works. The [implementation audit](implementation-audit.md)
continues to record the full product gaps and the no-go feasibility gate.

## Changes with evidence

| Finding | Correction | Evidence |
|---|---|---|
| Tab toolbar exposed a scrollbar and had no close interaction | Independent tab visibility, close buttons, right-click/Shift-F10 menu, close others/all, reopen and workspace file menu; horizontal overflow stays reachable without a visible scrollbar | `tab-state.test.ts`; real browser checks below |
| Dense finding labels repeated explanations | Finding selector names the property and source location; explanations remain in tooltips and expandable details | Built application inspected in both themes |
| Frontend feature responsibilities were mixed in one folder | Editor, scenario, workspace, analysis and evidence folders; explicit allowed imports enforced by CI | Dependency-boundary check |
| Submission and reconnection duplicated job polling | Shared validated, abortable observer; terminal submission is fetched too; wrong job identities rejected | Three observer regressions |
| Integer domains with explicit values could show ineffective range controls | Form distinguishes ranges from values, removes the inactive representation and validates nonempty values | Browser range/values round-trip and invalid-input check |
| Bare return did not stop access extraction | Stop extraction at unconditional return; retain preceding accesses | Two regressions; both failed before correction |
| User symbols collided with solver coordinates/output index | Fresh symbols for model parameters and query coordinates | Five renamed-parameter cases; program/lane/output_index failed before correction |
| Bounded domains required an unnecessary extra constraint | Empty additional conjunction allowed; variable bounds still constrain the model and contradictory domains remain rejected | Empty-conjunction and existing contradictory-domain regressions |
| Invalid store keyword combinations were silently ignored | Reject repeated keywords and load-only keywords on stores | Two rejection regressions |
| Signature/decorator semantics were approximated | Refuse unsupported parameter kinds, defaults, annotations, decorator options and wrappers; reject plain function redefinition | Eight parsing regressions |
| Native probe timeout was labeled failure | Record unknown progress separately from a failed compiler/kernel observation | Timeout regression |
| Aggregate verification required a missing NOTICE | Add the fixture/design-reference provenance notice without inventing upstream reproduction evidence | License check |

The extraction/query model revision is now **3**. Historical revision-2 evidence
remains immutable. No-store output coverage still returns explicit unsupported;
this review does not promote it to a supported query or fabricate a source witness.

## Executed checks

`nix develop -c pnpm run ci` passed with **167 TypeScript tests and 50 Python
tests**. It includes schemas and generated bindings, semantic rejection,
dependency directions, TypeScript, lint, Python formatting, production builds,
profiles, fixture licensing, documentation links and cross-language identities.
See the [complete log](reports/editor-review-ci.log).

The [native probe](reports/native-review.json) records actual source bytes,
hashes, exact argv, compiler version, diagnostics, exit codes and elapsed times:

- OpenMP: Clang 21.1.8 on Darwin arm64 passed frontend, compile/link and the owned
  CPU reduction control. This does not validate arbitrary kernels or race freedom.
- CUDA: blocked because `nvcc` is absent. PTX compilation was not executed.
- No GPU execution, sanitizer or hardware measurement was performed.

The [NVIDIA compiler documentation](https://docs.nvidia.com/cuda/cuda-compiler-driver-nvcc/index.html)
separates PTX/cubin compilation from execution. These compilation and source-map
tasks must not be labeled GPU-required. The
[LLVM Archer documentation](https://openmp.llvm.org/doxygen/dir_d25e7fcf0ab543d5b35a958546f34a9d.html)
describes OpenMP-aware ThreadSanitizer instrumentation; CPU execution is the
relevant path, with exact toolchain/platform conformance still required.

## Browser observations

On the built local application, with the user's existing three-file workspace:

- Right-clicked a background file, closed it, then reopened it from the workspace
  menu. The active editor stayed available and the workspace still contained three
  files. Closing a tab does not delete its source or alter analysis inputs.
- Shift-F10 opened the same context menu. Close-all showed “No open editors,”
  disabled source download and preserved all three workspace files. Reopening
  restored the working source. All original tabs were restored after testing.
- Switched N from range to values. An empty value array disabled Analyze and
  displayed a validation error. Switching to range cleared that error. Restored
  the original range 1–4096 and step 1 after this test.
- Ran the current two-store kernel with its restored scenario. The actual result
  reported a memory-bounds violation, inconclusive output coverage and established
  distinct-writer conflict absence under the declared model. Inconclusive coverage
  was not converted to success. The new immutable snapshot suffix is `c53c0ce3`.
- At 390 × 844, document dimensions remained exactly 390 × 844. The 333-pixel tab
  strip contained 406 pixels of tabs with scrollbar width `none`; the last tab
  remained selectable and Home returned to the first tab. Reset the viewport.
- Inspected light and dark appearances. No source file was replaced or deleted.

## Remaining work and research workflow

A researcher should be able to change source, vary a declared scenario, run an
exact profile, inspect a counterexample at its source and retain the previous
snapshot for comparison. The local symbolic loop now supports those individual
steps. Full multi-lane comparisons, undo/view-state retention across editor
switches, persistent tab layout, scenario presets, measured performance and
complete keyboard/screen-reader certification remain unfinished. The composition
component still owns substantial session state; folder boundaries are a concrete
improvement, not a claim that all architectural debt is gone. The unused older
`CodeWorkspace` and report-session helpers remain candidates for removal or
integration after the multi-lane design is resolved.

Native user-kernel adapters, precise runtime/instrumentation identities, licensed
native corpora and sanitizer normalization remain implementation work, separately
from missing toolkit/device/Linux environments. Advanced Triton control flow,
indirection, reductions and atomics remain unsupported. Independent comparisons
and strategy measurements required by the feasibility gate remain missing.
Hosted ownership, durable events, containment, publication and revocation remain
unfinished; local report download is not public sharing. No ACC-001–ACC-010 is
closed by this review. Passing the current tests is not full specification
compliance or an exhaustive function-by-function verification.
