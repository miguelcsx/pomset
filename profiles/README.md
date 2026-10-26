# Profiles

An immutable, measured compatibility manifest per backend and profile revision.

```
profiles/{backend}/{profileId}.json                the ProfileRevision
profiles/{backend}/{profileId}.capabilities.json   its Capability records
```

The revision record pins the engine and tool versions it was measured with, the
platform and, where hosted, the deployment image digest. Each capability
declares two independent things:

- a **support level** — `validated`, `limited`, `untested` — which is a property
  of the measured revision and never changes until a new revision is measured;
- an **availability** — `immediate`, `queued`, `unavailable` — derived from
  deployment and queue state at read time.

Changing what a deployment offers therefore changes availability and nothing
else; the support claim and the revision hash stay as they were recorded. A
capability whose support level is `validated` must cite a conformance reference:
nothing is advertised until its fixtures pass, and an unpromoted feature is
`unsupported` with the missing capability named rather than replaced by a nearby
one.

The revision hash is SHA-256 over the RFC 8785 canonical serialization of the
revision with its own `revisionHash` member omitted — the same rule a snapshot
manifest follows.

```bash
pnpm --filter @pomset/contracts run check:profiles -- profiles
```
