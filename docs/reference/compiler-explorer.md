# Compiler Explorer: what to adopt, adapt and reject

The Compiler Explorer copy under the untracked `inspo/compiler-explorer` is an
**architectural comparison and a selective-reuse reference**. It is not a
specification, it is not a dependency, and nothing in it is inherited as a
security or correctness guarantee. Line anchors below refer to that untracked
copy.

## Comparisons

| Anchors | What it does | Decision | Reason |
|---|---|---|---|
| `lib/compilers/triton.ts:33-108`, `125-163` | `TritonCompiler` extends `BaseCompiler`: chooses a configurable wrapper path defaulting to `etc/scripts/triton_wrapper.py`, wires IR/PTX/SASS parsers, filters wrapper output, reads produced files. | **Adapt** | The adapter boundary and explicit artifact parsing are the right shape. Keep artifact extraction strictly separate from behaviour analysis: a compiler artifact is not evidence about execution. Owns `REQ-BCK-*`. |
| `etc/scripts/triton_wrapper.py:25-67`, `100-110`, `145-186` | A `MockCacheManager` writes compiler outputs; `setup_triton` patches Triton cache, compilation and GPU driver behaviour (`MagicMock` for the driver) so artifacts can be emitted without running a kernel. It imports `torch` and Triton, and documents the exact Triton versions it was tested against. | **Reject** | Running this path imports user Python. It is neither symbolic verification nor a safe execution boundary. Any artefact-extraction operation in Pomset is a version-qualified, sandboxed operation with a declared trust boundary. Owns `REQ-SEC-*`, `REQ-ENG-*`. |
| `lib/execution/base-execution-env.ts:61-77` | Local execution environment reads its sandbox type from properties, **defaulting to `'none'`** (`this.sandboxType = execProps('sandboxType', 'none')`), and initialises packaging and cache machinery. | **Reject the default; adapt the separation** | A permissive default is not an isolation guarantee. Pomset fails closed: an unsupported sandbox or tool combination is unavailable, never run unisolated. Owns [`../adr/0007-sandbox-and-local-runners.md`](../adr/0007-sandbox-and-local-runners.md). |
| `static/compiler-service.ts:80-91` | Resolves the language and compiler selection; when an explicit compiler id is unknown it returns `compilers[0]`, the **first compiler of that language**. | **Adapt resolution, reject the fallback** | Silent substitution is exactly the failure mode the product forbids: an unknown profile id yields `PROFILE_NOT_FOUND`. Owns `REQ-PLT-*`, `REQ-ENG-*`. |
| `static/panes/editor.ts:1-25`, `73-110` | Monaco-backed editor pane: editor state, language lookup, source setup, decorations, integration with sibling panes, under an individual BSD-2-Clause copyright header. | **Adopt the editor concept, adapt the integration** | Monaco is the agreed editor for the React frontend (repository instructions). Panes are reconstructed as React components over a store; the legacy runtime coupling is not carried over. Owns [`../adr/0003-workbench-composition.md`](../adr/0003-workbench-composition.md). |
| `static/components.ts:24-160` | Typed component configurations (GoldenLayout) for editors, compilers, executors and related panes, passing pane state between components. | **Adapt typed component boundaries; reject the stack** | Typed, explicitly-configured components are worth having. GoldenLayout, jQuery and the EventHub are not prescribed dependencies for Pomset. Owns [`../adr/0003-workbench-composition.md`](../adr/0003-workbench-composition.md). |
| `lib/compilation-queue.ts:1-30`, `32-101` | In-process queue over `p-queue`: concurrency limit, timeout, stale-after handling, active-context tracking, priority, counters, under an individual BSD-2-Clause copyright header. | **Adapt the concepts; reject as the job system** | Bounded work, stale-request handling and observability map onto the durable lease lifecycle. An in-memory queue is not durable coordination. Owns [`../architecture/lifecycle.md`](../architecture/lifecycle.md). |

## What this comparison does not license

- It does not license importing the wrapper's mocked interfaces, its cached
  artifact trick, or its driver patching anywhere in Pomset.
- It does not license a sandbox that may be disabled by configuration.
- It does not license a "nearest profile" fallback of any kind, in the API, the
  CLI or the UI.
- It does not license copying the whole reference repository. Only a bounded,
  named unit may be reused, and only with its notices.

## Selective BSD-2-Clause reuse

The reference repository is BSD-2-Clause (`LICENSE:1-25`, with the disclaimer
running to line 25) and carries per-file copyright and BSD-style redistribution
headers (`lib/compilers/triton.ts:1-23`, `lib/compilation-queue.ts:1-25`,
`static/panes/editor.ts:1-25`, `etc/scripts/triton_wrapper.py:1-23`). If any code
were reused:

1. The applicable per-file copyright, conditions and disclaimer are retained
   in the source of the reused unit. The repository `LICENSE` alone does not
   replace a file notice.
2. Redistribution in binary form reproduces the notice in the accompanying
   documentation or materials.
3. The reused unit is listed in the Pomset `NOTICE` file with its origin path,
   upstream revision and the licence text it carries, alongside the
   Apache-2.0 licence of Pomset itself.

No code is copied by this documentation change, so no notice change is required
today. Any future reuse task MUST carry its own licence verification step;
see [`../delivery/README.md`](../delivery/README.md) for the fixture and licence
provenance task.
