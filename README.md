# pomset

**Is my parallel kernel correct, safe and efficient across the inputs and configurations I actually intend to use — and when it is not, why?**

Pomset — Parallel Behavior Explorer — analyses the *behaviour envelope* of a
kernel: how its correctness and its performance change as shape, dtype, layout,
launch configuration and hardware change. Triton comes first; CUDA C++ and
OpenMP are required later phases.

The unit of work is a **versioned project, a test scenario and a set of
profiles**, producing jobs, results and publications. That unit is unchanged
from the first product note; the scope of the question is narrower and the
answers carry qualified evidence.

## Three experiences

| Experience | What the user does | What comes back |
|---|---|---|
| Explore | Investigates how accesses, masks, addresses and conflicts are distributed across blocks, threads and memory regions. | Source-linked access records, coverage holes, conflict findings, counterexamples. |
| Validate | Declares the inputs and configurations that must be supported. | Per-property coverage of that domain: established, violated, sampled, unknown. |
| Optimize | Measures and compares configurations that already satisfy the required properties. | Measured or estimated comparisons with their qualifiers. |

Execution mechanisms are a separate vocabulary — `static`, `symbolic`,
`instrumented`, `benchmark`, `artifact` — because what ran and what the user is
doing are different questions. No experience replaces another: a proof over a
restricted model leaves every native extension uncovered, and a clean run
demonstrates nothing about correctness.

`Observe` / `Explore` / `Verify` was the earlier mode vocabulary. It is
superseded and does not appear again.

## Status

Partial implementation. A local editor-first symbolic workstation now connects
Monaco, canonical scenario editing, real AST/Z3 analysis, immutable SQLite/CAS
snapshots and portable report sharing. Hosted services, native user-kernel
adapters and release evaluation remain incomplete. The feasibility decision is
**no-go** pending independent comparisons and strategy measurements. No canonical
acceptance scenario is closed. See the
[implementation audit](docs/evaluation/implementation-audit.md) and
[local workstation decision](docs/adr/0013-local-symbolic-workstation.md).

### Run the local workstation

```sh
nix develop -c pnpm install --frozen-lockfile
nix develop -c uv sync --frozen
nix develop -c pnpm run build
nix develop -c pnpm workbench
```

Open the capability URL printed by the server. Start typing or open source files;
configure the entry point, allocations, launch and parameter domain using the
sliders icon, or import a canonical scenario. Relative scenario paths must match
workspace paths (click the path above the editor to rename a file). Select the
actual probed profile and analyze with the play button or Cmd/Ctrl+Enter.
Automatic analysis is opt-in. Memory, Domain and Details inspect captured
results; history preserves prior snapshots. Sharing previews and downloads a
portable report without publication.

Source is parsed, not executed. The supported Triton subset needs no GPU.
OpenMP/CUDA user-kernel adapters are unavailable and explained explicitly.
`POMSET_WORKBENCH_PORT` configures the loopback port (default 8811);
`POMSET_WORKBENCH_DATA` configures the local store (default `.pomset-workbench`).
The existing CLI `serve` command remains a read-only report viewer.

Branch `web/mock` holds a navigable interface mock in plain HTML, CSS and
JavaScript. It is a maquette for settling visual language and interaction
states, it is never merged into `main`, and it is not a specification.

## Invariants

Running leaves the project unpublished. Compiling for a target leaves it unexecuted. A finished job proves nothing about correctness. Reopening evidence returns the old sample. Editing source leaves historical results untouched.

## Licence

Apache-2.0. Selective reuse of Compiler Explorer keeps its BSD-2-Clause notices.
