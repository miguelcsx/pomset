# pomset

Run, observe and verify concurrent programs on real runtimes, from the browser, with nothing to install.

The unit of work is not a snippet pasted into an editor. It is a **versioned project, a test scenario and a set of profiles**. A Python program using asyncio, a Rust workspace on Tokio and a CMake project with OpenMP go through the same system of projects, jobs, results and publication, even though their engines and guarantees differ.

## Three modes

| Mode | What it runs | What it can return |
|---|---|---|
| Observe | An instrumented scenario on a real runtime. | Trace, dynamic diagnostics, resources, observed behaviour. |
| Explore | The scenario under controlled scheduling. | Alternative executions, reproducible failures, coverage of the explored domain. |
| Verify | A formal or static engine, asked about a property. | A property established under contract, a counterexample, a warning, or no conclusion. |

No mode replaces the others. A proof over a restricted model does not cover every native extension of a program, and a run without errors does not demonstrate correctness.

## Status

Pre-implementation. The technical specification lives in `docs/` and covers architecture, contracts, isolation, budgets, catalogue and UI. There is no backend yet.

Branch `web/mock` holds a navigable interface mock in plain HTML, CSS and JavaScript: profile catalogue, workbench with lanes, and an evidence panel. It exists to settle the visual language and the interaction states before the product is written.

## Invariants

Running is not publishing. Compiling for a target is not executing on it. Finishing a job is not proving correctness. Reopening evidence is not taking a fresh sample. Editing source does not change historical results.

## Licence

Apache-2.0. Selective reuse of Compiler Explorer keeps its BSD-2-Clause notices.
