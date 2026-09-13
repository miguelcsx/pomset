# pomset

Run, observe and verify concurrent programs on real runtimes, from the browser, with nothing to install.

The unit of work is a **versioned project, a test scenario and a set of profiles**, rather than a snippet in an editor. A Python program on asyncio and a Rust workspace on Tokio go through the same system of projects, jobs, results and publication, even though their engines and their guarantees differ.

## Three modes

| Mode | What it runs | What it can return |
|---|---|---|
| Observe | An instrumented scenario on a real runtime. | Trace, dynamic diagnostics, resources, observed behaviour. |
| Explore | The scenario under controlled scheduling. | Alternative executions, reproducible failures, coverage of the explored domain. |
| Verify | A formal or static engine, asked about a property. | A property established under contract, a counterexample, a warning, or no conclusion. |

No mode replaces the others. A proof over a restricted model leaves every native extension of the program uncovered, and a clean run demonstrates nothing about correctness.

## Status

Pre-implementation. The design is settled; the system is not built. There is no backend yet.

Branch `web/mock` holds a navigable interface mock in plain HTML, CSS and JavaScript: profile catalogue, workbench with lanes, and an evidence panel. It exists to settle the visual language and the interaction states before the product is written.

## Invariants

Running leaves the project unpublished. Compiling for a target leaves it unexecuted. A finished job proves nothing about correctness. Reopening evidence returns the old sample. Editing source leaves historical results untouched.

## Licence

Apache-2.0. Selective reuse of Compiler Explorer keeps its BSD-2-Clause notices.
