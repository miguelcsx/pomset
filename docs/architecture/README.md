# Architecture

The behavioural and structural specifications that sit between the requirements
in [`../srs/`](../srs/README.md) and the tasks in [`../delivery/`](../delivery/README.md).

| Document | Owns |
|---|---|
| [`monorepo.md`](monorepo.md) | Package boundaries, dependency directions, build tooling and ownership of shared packages. |
| [`lifecycle.md`](lifecycle.md) | Ownership, snapshot, job, attempt and event transitions, leasing, cancellation races, artifact finalisation, retention, cache identity. |
| [`triton-engine.md`](triton-engine.md) | The supported Triton DSL subset, the address/mask model, the three queries, witness handling, and what the engine refuses. |
| [`exploration-and-validation.md`](exploration-and-validation.md) | Domain partitioning, sampling strategies, replay and minimisation, numerical reference and output poisoning, eligibility. |
| [`native-backends.md`](native-backends.md) | CUDA C++ and OpenMP tooling, pinning, probing, artefacts and diagnostics. |
| [`security-and-deployment.md`](security-and-deployment.md) | Trust and data flow, sandboxing, limits, least privilege, deployment topology, teardown. |
| [`workbench.md`](workbench.md) | The React workbench: responsibilities, views, lane states, accessibility and theming. |
| [`local-ci.md`](local-ci.md) | The CLI, its commands, manifests, storage, transport and CI recipes. |

Decisions that shape these documents are recorded in [`../adr/`](../adr/README.md).
Where a specification and a requirement disagree, the requirement in
[`../srs/`](../srs/README.md) wins and the specification is the defect.
