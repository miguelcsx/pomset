# Workbench — `UX`

The workbench is where evidence becomes understandable. It must connect views,
not stack dashboards. Sources: `SRC-036`, `SRC-053`, `SRC-054`, `SRC-047`.

### REQ-UX-001  Project and editor surface

**Statement.** The workbench SHALL present a project view of files and scenarios
alongside a source editor, and SHALL show which snapshot the viewer is looking at
at all times.

**Rationale.** `SRC-036`, `SRC-012`. Without the snapshot marker, a user cannot
tell which version a finding belongs to.

**Acceptance.** `ACC-010`.

**Scope.** Editor is Monaco, embedded in React; see
[`../adr/0003-workbench-composition.md`](../adr/0003-workbench-composition.md).

**Implemented by.** `TASK-WEB-002`, `TASK-WEB-004`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `SnapshotManifest`.

### REQ-UX-002  Source, actor, memory and event views are linked

**Statement.** Selecting a finding SHALL highlight simultaneously every actor,
memory region, address and source range the finding references, and selecting a
source range SHALL reveal the findings and events that reference it.

**Rationale.** `SRC-053`, `SRC-036`. This bidirectional link is the product's core
interaction.

**Acceptance.** `ACC-002`, `ACC-010`.

**Scope.** A finding with several actors highlights all of them.

**Implemented by.** `TASK-WEB-007`, `TASK-WEB-011`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `Finding`.

### REQ-UX-003  Up to four comparison lanes over one scenario

**Statement.** The workbench SHALL present up to four profile lanes over the same
scenario, each with its own profile revision, state and evidence, and selecting a
lane SHALL select its evidence without discarding the others.

**Rationale.** `SRC-036`. Comparing profiles is how a user sees that one engine
concludes something another cannot.

**Acceptance.** `ACC-010`.

**Scope.** The four-lane cap is a product limit, not a rendering accident.

**Implemented by.** `TASK-WEB-006`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `Job`, `AnalysisResult`.

### REQ-UX-004  Explore, Validate and Optimize are the three experiences

**Statement.** The workbench SHALL organise its primary navigation as Explore,
Validate and Optimize, and SHALL NOT present a second mode hierarchy such as
Observe/Explore/Verify.

**Rationale.** `SRC-001` defines the product as an interactive workbench about
when a parallel program is correct, when it is fast, and why its behaviour
changes. `SRC-013` superseded the earlier mode vocabulary. One vocabulary, one
navigation.

**Acceptance.** `ACC-010`.

**Scope.** Execution mechanisms appear as qualifiers on evidence, not as
navigation modes.

**Implemented by.** `TASK-WEB-001`, `TASK-WEB-008`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** See [`../README.md`](../README.md).

### REQ-UX-005  Semantic status roles decorate independent states

**Statement.** The interface SHALL use five semantic roles — `violation`,
`caution`, `activity`, `unknown`, `contract` — mapped as: violation for an actual
violation, caution for potential, limited or untested, activity for queued or
running, unknown for inconclusive, unsupported or unavailable, and contract for a
declared or established condition whose assumptions are visible. A role SHALL
decorate an independent state and SHALL NOT replace it with a single green
"safety" label.

**Rationale.** `SRC-054`. Green alone does not mean safe, and the vocabulary must
not imply that it does.

**Acceptance.** `ACC-004`, `ACC-010`.

**Scope.** Hue meaning is fixed across dark, light and high-contrast themes.

**Implemented by.** `TASK-WEB-003`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `semanticRole`.

### REQ-UX-006  Status is never carried by colour alone

**Statement.** Every state conveyed by a semantic role SHALL also be conveyed by
text and, where relevant, by shape or iconography, so that the interface remains
usable without colour perception.

**Rationale.** `SRC-054`. A colour-only status is inaccessible and ambiguous in
print.

**Acceptance.** `ACC-010`.

**Scope.** Applies to lanes, findings, badges and charts.

**Implemented by.** `TASK-WEB-003`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** —

### REQ-UX-007  Real job states are shown

**Statement.** The workbench SHALL display queued, running, cancel-requested,
succeeded, failed, cancelled, unknown and unsupported states as distinct real
states driven by the job event stream, and SHALL NOT simulate progress with a
fixed-duration animation.

**Rationale.** `SRC-031`, `SRC-012`. A staged animation cannot represent a real
cancellation or a real failure.

**Acceptance.** `ACC-004`, `ACC-010`.

**Scope.** Reconnect to the event stream restores state from durable events.

**Implemented by.** `TASK-WEB-005`, `TASK-HST-008`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `Job.state`, `JobEvent`.

### REQ-UX-008  Cancellation and partial evidence remain visible

**Statement.** A cancelled run SHALL remain visible with the partial evidence it
did produce and an explicit completeness qualifier, and SHALL NOT be removed from
the interface or silently replaced by a later run.

**Rationale.** `SRC-012`. The record of an interrupted attempt is evidence about
the attempt.

**Acceptance.** `ACC-004`.

**Scope.** Cancellation never upgrades to success, even if completion races it.

**Implemented by.** `TASK-WEB-005`, `TASK-ENG-005`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `Job.state`, `AnalysisResult`.

### REQ-UX-009  Historical evidence stays attached to its snapshot

**Statement.** When source changes, previously produced evidence SHALL stay
displayable with a stale-snapshot indicator naming the snapshot it belongs to, and
SHALL NOT be re-attributed to the newer source.

**Rationale.** `SRC-012`. The binding invariant, rendered.

**Acceptance.** `ACC-004`.

**Scope.** Includes measurements and artifacts.

**Implemented by.** `TASK-WEB-004`, `TASK-WEB-005`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `AnalysisResult.snapshotId`.

### REQ-UX-010  Unavailable profiles are shown, not filtered out

**Statement.** The profile selector and catalogue SHALL show unavailable and
unsupported profiles with the reason they are unavailable, and SHALL NOT hide
them, reorder them silently, or substitute a similar profile.

**Rationale.** `SRC-029`, `SRC-038`. Hiding an unsupported combination is a way of
pretending it was supported.

**Acceptance.** `ACC-004`, `ACC-009`.

**Scope.** An unknown profile id resolves to `PROFILE_NOT_FOUND`, never to a
nearby profile.

**Implemented by.** `TASK-WEB-010`, `TASK-HST-011`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `Capability`, `PROFILE_NOT_FOUND`.

### REQ-UX-011  Disabled capabilities explain themselves

**Statement.** A disabled control SHALL state why it is disabled and what would
enable it, and SHALL NOT be present-but-inert without explanation.

**Rationale.** `SRC-029`. An inert control teaches the user nothing.

**Acceptance.** `ACC-009`.

**Scope.** Includes write and job controls in a read-only local viewer.

**Implemented by.** `TASK-WEB-010`, `TASK-LOC-009`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `Capability.reason`.

### REQ-UX-012  Domain and coverage are visible next to each result

**Statement.** Every property result SHALL display its domain, regions and
coverage next to the outcome, and every region SHALL show its per-property
classification rather than a single aggregate verdict.

**Rationale.** `SRC-004`, `SRC-003`.

**Acceptance.** `ACC-003`, `ACC-007`.

**Scope.** Includes sampled regions, which are labelled as sampled.

**Implemented by.** `TASK-WEB-008`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `Coverage`.

### REQ-UX-013  Charts label measurement versus estimate and show region coverage

**Statement.** A chart SHALL label whether its values are measured or estimated,
SHALL show which regions and configurations produced them, and SHALL NOT draw a
chart whose points imply coverage of a domain that was not covered.

**Rationale.** `SRC-054`, `SRC-055`.

**Acceptance.** `ACC-006`, `ACC-010`.

**Scope.** Applies to performance comparisons and to domain-coverage charts.

**Implemented by.** `TASK-WEB-015`, `TASK-WEB-008`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `Measurement.evidenceClass`, `Coverage`.

### REQ-UX-014  Causal views show only established order

**Statement.** The event view SHALL render only the ordering edges the analysis
established, SHALL mark unresolved relationships as unresolved, and SHALL NOT
draw a timeline that implies an order among independent events.

**Rationale.** `SRC-051`. A neat timeline is not evidence.

**Acceptance.** `ACC-002`, `ACC-010`.

**Scope.** The same rule governs the Perfetto export.

**Implemented by.** `TASK-WEB-011`, `TASK-PRS-006`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `partialOrder`.

### REQ-UX-015  Publication is a previewed, explicit act

**Statement.** Publishing SHALL require an explicit selection of a snapshot and
artifacts after a disclosure preview listing what would become visible.

**Rationale.** `SRC-012`, `SRC-037`.

**Acceptance.** `ACC-008`.

**Scope.** See [`sharing.md`](sharing.md) for the authorization rules.

**Implemented by.** `TASK-WEB-016`, `TASK-HST-010`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `DisclosurePreview`, `Publication`.

### REQ-UX-016  Empty, offline and error states are explicit

**Statement.** The workbench SHALL render explicit states for an empty result set,
an offline or unreachable service, a wrong or unknown profile, a budget-limited
inconclusive result, and a partially complete evidence set, and SHALL NOT render a
blank panel or an indefinite spinner in place of any of them.

**Rationale.** `SRC-029`, `SRC-022`.

**Acceptance.** `ACC-009`.

**Scope.** Includes the read-only local viewer.

**Implemented by.** `TASK-WEB-017`, `TASK-WEB-005`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** `ErrorRecord`.

### REQ-UX-017  Responsive and keyboard-operable

**Statement.** The workbench SHALL remain operable with keyboard alone, SHALL
expose findings, actors, source ranges and events to assistive technology with
meaningful names, and SHALL reflow to a usable layout on a narrow viewport.

**Rationale.** `SRC-036`. The core interaction is navigation, and navigation must
not require a pointer or a wide screen.

**Acceptance.** `ACC-010`.

**Scope.** Includes the local read-only viewer, which shares the same components.

**Implemented by.** `TASK-WEB-018`.

**ADRs.** [ADR-0003](../adr/0003-workbench-composition.md)  Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

**Contracts.** —
