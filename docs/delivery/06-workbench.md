# Workbench — `WEB`

The workbench is the React application where a user reads evidence: source, actors,
memory, events, domain coverage, comparison lanes and publication preview. It
renders real engine output from the hosted API and from the read-only local
viewer; it never simulates progress and never invents an ordering.

**Whole-epic prerequisites.** `TASK-FND-002` (React/Monaco/Vite shell and the
shared token package), `TASK-LOC-009` (the read-only local transport) and
`TASK-HST-008` (the durable job event stream). Each block lists its own
prerequisites.

**Milestone.** M4 Workbench: real engine output renders in the four-lane
workbench, hosted and read-only local, with source, actor and memory navigation
linked from findings.

Contracts precede UI: `TASK-FND-002` and the schemas in
[`../contracts/`](../contracts/README.md) are authoritative, and no component
redefines a portable type. Composition and token decisions are in
[`../adr/0003-workbench-composition.md`](../adr/0003-workbench-composition.md);
view responsibilities are specified in
[`../architecture/workbench.md`](../architecture/workbench.md). Every path below
is a planned future target and the mock under `origin/web/mock` is a visual
reference only, not scaffolding to import.

### TASK-WEB-001  Build the React, Monaco and Vite shell with Explore, Validate and Optimize

**Purpose.** Establish the application shell and the single primary navigation so later views attach to one vocabulary.

**Owns.** `apps/web/src/app/`, `apps/web/src/navigation/`, `apps/web/vite.config.ts`, `packages/ui/src/tokens/`

**Requirement links.** `REQ-UX-004`, `REQ-CLI-013`

**Prerequisites.** `TASK-FND-002`

**Implementation.** Create the Vite build, the React root and a CSS-grid layout whose primary navigation is exactly Explore, Validate and Optimize. There is no second mode hierarchy and no Observe/Explore/Verify vocabulary. Import the shared token package from `packages/ui` and build both the hosted client and the local reader from it: `pomset serve` mounts the same built route and components over the read-only transport, so no second renderer exists. Execution mechanisms appear as qualifiers on evidence, never as navigation entries.

**Acceptance.** The built app renders three primary navigation entries with those names, no fourth mode entry exists anywhere in the source, and the same bundle built from `packages/ui` is served at a loopback `pomset serve` URL showing identical navigation and tokens.

**Verification.** Environment: Node toolchain with the workspace installed, plus `pomset serve` over an exported report. Command: `pnpm --filter @pomset/web build` and `pnpm --filter @pomset/web test -- shell`. Observe: navigation entries and identical component tree in both modes.

**Artifacts.** The Vite/React shell, the navigation module, and the token package consumption path shared with the local viewer.

### TASK-WEB-002  Present the project tree and source editor over a snapshot

**Purpose.** Give the user the project unit and the exact bytes being viewed, with the snapshot always named.

**Owns.** `apps/web/src/project/ProjectTree.tsx`, `apps/web/src/editor/MonacoPanel.tsx`, `apps/web/src/project/SnapshotBanner.tsx`

**Requirement links.** `REQ-UX-001`

**Prerequisites.** `TASK-WEB-001`

**Implementation.** Render the file and scenario tree of a `Project` beside a Monaco editor pane, reading a `SnapshotManifest` to list files and show each file's content, and keep a persistent banner naming the snapshot id, its manifest hash and its parent when one exists. Editing in the pane marks the buffer modified and offers snapshot creation as an explicit action; it never writes through to an existing snapshot. The banner is present in every view of the workbench, including the read-only local viewer.

**Acceptance.** Opening a project shows the file tree and the editor with the snapshot banner naming a snapshot id; typing changes the buffer state without altering the stored manifest; the banner names the correct snapshot after switching projects.

**Verification.** Environment: hosted API with a migrated fixture project. Command: `pnpm --filter @pomset/web test -- project-editor`. Observe: tree contents, banner text, unchanged manifest after typing.

**Artifacts.** The project tree, the Monaco panel over a snapshot, and the persistent snapshot banner.

### TASK-WEB-003  Define the semantic token set and convey status without colour alone

**Purpose.** Make five fixed semantic roles decorate independent states rather than collapsing into one green label, and keep every state readable without colour.

**Owns.** `packages/ui/src/tokens/semantic.css`, `packages/ui/src/status/StatusBadge.tsx`, `packages/ui/src/status/roles.ts`

**Requirement links.** `REQ-UX-005`, `REQ-UX-006`

**Prerequisites.** `TASK-WEB-001`

**Implementation.** Define the roles `violation`, `caution`, `activity`, `unknown` and `contract` with fixed meanings — violation for an actual violation, caution for potential, limited or untested, activity for queued or running, unknown for inconclusive, unsupported or unavailable, and contract for a declared or established condition with visible assumptions — and keep hue meaning stable across dark, light and high-contrast themes. `StatusBadge` renders a role together with text, and an icon or shape where a state distinction matters, so no state is carried by colour alone. A role never replaces the underlying state: the badge shows the state name beside the role.

**Acceptance.** Each of the five roles renders with a distinct text label and a non-colour cue; a queued job shows `activity` with the state text `queued`; an unsupported analysis shows `unknown` with the state text `unsupported`. Rendering with colour forced to a single flat value leaves every state distinguishable.

**Verification.** Environment: the built app with a token fixture page. Command: `pnpm --filter @pomset/ui test -- status-roles` plus a monochrome rendering pass. Observe: labels and non-colour cues per role.

**Artifacts.** The semantic token set, the role mapping, and the accessible status badge.

### TASK-WEB-004  Switch snapshots with stale-snapshot indicators that never re-attribute evidence

**Purpose.** Keep every result bound to the snapshot it analysed, even after the source has moved on.

**Owns.** `apps/web/src/project/SnapshotSwitcher.tsx`, `apps/web/src/staleness/StaleBanner.tsx`, `apps/web/src/state/snapshotSelection.ts`

**Requirement links.** `REQ-PRJ-008`, `REQ-UX-001`, `REQ-UX-009`

**Prerequisites.** `TASK-WEB-002`

**Implementation.** Let the user select among a project's snapshots and mark the selected snapshot as current-in-viewer versus current-in-project. When the viewer holds a snapshot that is not the project's newest, show a stale-snapshot indicator naming the snapshot id it belongs to and its age relative to the newest, and continue displaying the evidence attached to it unchanged. Switching snapshots re-reads results by their own `snapshotId`; no component rewrites a result, measurement or artifact onto a newer snapshot, and measurements and artifacts carry the same indicator.

**Acceptance.** After creating a child snapshot, viewing the parent still lists its original results under a banner naming the parent id, and no result's `snapshotId` changes. Switching back to the child shows the child's own results with the indicator absent.

**Verification.** Environment: hosted API with a two-snapshot project carrying distinct results. Command: `pnpm --filter @pomset/web test -- snapshot-switching`. Observe: banner text per selection and unchanged result identities.

**Artifacts.** The snapshot switcher, the stale-snapshot indicator, and the selection state that scopes result reads by snapshot.

### TASK-WEB-005  Drive lane state from the real job event stream

**Purpose.** Show what actually happened to a job — including cancellation and partial evidence — instead of a staged animation.

**Owns.** `apps/web/src/lanes/LaneState.tsx`, `apps/web/src/lanes/useJobEvents.ts`, `apps/web/src/cancel/CancelControl.tsx`

**Requirement links.** `REQ-UX-007`, `REQ-UX-008`, `REQ-UX-009`

**Prerequisites.** `TASK-WEB-002`, `TASK-HST-008`

**Implementation.** Subscribe a lane to `GET /v1/jobs/{jobId}/events` and derive its state from the durable events, rendering queued, running, cancel-requested, succeeded, failed, cancelled, unknown and unsupported as distinct real states with their error records when present. Reconnect uses `Last-Event-ID` and restores state from replayed events, and an expired cursor triggers a state fetch rather than a fabricated stage. A cancelled run stays in the lane with the partial evidence it produced and an explicit completeness qualifier, and is never removed or replaced by a later run. The cancel control calls `POST /v1/jobs/{jobId}/cancel` and reflects the recorded result. Progress is whatever the events report; no timer advances it.

**Acceptance.** A job cancelled mid-analysis keeps its lane with `cancelled` and the findings it had produced under a partial qualifier. Dropping and restoring the connection mid-job yields the same final lane state with no duplicated or missing event. No component in the lane contains a fixed-duration progress animation.

**Verification.** Environment: hosted API with a stub engine that delays and can be cancelled. Command: `pnpm --filter @pomset/web test -- lane-events`. Observe: lane state, partial evidence, reconnect continuity.

**Artifacts.** The lane state component, the event-stream hook with reconnect, and the cancel control.

### TASK-WEB-006  Present up to four comparison lanes over one scenario

**Purpose.** Let a user compare profile revisions side by side without discarding any lane's evidence.

**Owns.** `apps/web/src/lanes/LaneGrid.tsx`, `apps/web/src/lanes/laneModel.ts`, `apps/web/src/lanes/LaneSelector.tsx`

**Requirement links.** `REQ-UX-003`, `REQ-BCK-012`

**Prerequisites.** `TASK-WEB-005`

**Implementation.** Model a workspace of at most four lanes over one scenario, each lane naming its own profile revision, job state and evidence, and refuse a fifth lane with an explanation rather than silently replacing one. Selecting a lane selects its evidence while the other lanes keep theirs, so results are compared as separate evidence about the same kernel with their own semantics and support levels rather than merged. Where two lanes come from different backends, the lane header states each backend's semantics and marks the view as a comparison of cohorts, never a single ranked list.

**Acceptance.** Four lanes can hold four profile revisions simultaneously and selecting one does not clear another's results. Adding a fifth is refused with the four-lane limit named. Two lanes on different backends label their semantics separately.

**Verification.** Environment: hosted API with results from two profile revisions. Command: `pnpm --filter @pomset/web test -- lanes`. Observe: retained evidence per lane, refusal at the fifth, per-lane semantics labels.

**Artifacts.** The lane grid, the lane model and its four-lane limit, and the lane selector.

### TASK-WEB-007  Link source, actor and memory selection from a finding both ways

**Purpose.** Make the finding the entry point into every artefact it references, and make a source range an entry point back to its findings.

**Owns.** `apps/web/src/link/FindingSelection.tsx`, `apps/web/src/link/SourceRangeHighlighter.tsx`, `apps/web/src/link/selectionStore.ts`

**Requirement links.** `REQ-UX-002`

**Prerequisites.** `TASK-WEB-005`

**Implementation.** Selecting a `Finding` highlights simultaneously every actor, memory region, symbolic address and source range it references, across the editor, the actor list and the memory view; a finding with several actors links all of them. Selecting a source range reveals the findings and events that reference it. Selection state lives in one store so the editor, actor list, memory view and event view agree, and symbolic addresses are shown as expressions with a concrete address only where the witness fixes it.

**Acceptance.** Selecting a two-writer conflict finding highlights both actors and both source ranges at once, and selecting either source range reveals the same finding. A finding with a symbolic address shows the expression and no invented concrete address.

**Verification.** Environment: hosted API with a conflict fixture carrying a witness. Command: `pnpm --filter @pomset/web test -- selection-links`. Observe: highlighted actors, ranges and address display.

**Artifacts.** The finding selection component, the source-range highlighter, and the shared selection store.

### TASK-WEB-008  Show domain, region and coverage views beside each outcome

**Purpose.** Keep the domain and the per-property classification next to every result, so no screen shows one aggregate verdict.

**Owns.** `apps/web/src/domain/DomainView.tsx`, `apps/web/src/domain/CoverageView.tsx`, `apps/web/src/domain/PropertyTable.tsx`

**Requirement links.** `REQ-DOM-007`, `REQ-DOM-008`, `REQ-EVD-008`, `REQ-EVD-015`, `REQ-UX-004`, `REQ-UX-012`, `REQ-UX-013`

**Prerequisites.** `TASK-WEB-005`

**Implementation.** Render the declared `WorkloadDomain` as its variables and constraints, and the `Coverage` as regions each carrying the per-property classification `established`, `violated`, `sampled`, `unknown` or `unsupported`. Every property result displays its assumptions, budget and coverage beside the outcome, and the job's own state is shown separately from those outcomes so a succeeded job is never rendered as a correctness verdict. Counts and percentages appear only where the denominator is finite and explicitly enumerated with duplicate points removed; otherwise the view shows constraints and sampled points with no percentage. Sampled regions are labelled sampled.

**Acceptance.** A result with one violated region, one established region and one sampled region renders three regions with distinct classifications and a legend saying sampled is not proof. A domain with a non-enumerated denominator shows no percentage anywhere in the view.

**Verification.** Environment: hosted API with a multi-region fixture and a sampled-check fixture. Command: `pnpm --filter @pomset/web test -- domain-coverage`. Observe: per-region classifications, absent percentages, separate job state.

**Artifacts.** The domain view, the coverage view, and the property table with assumptions, budget and coverage columns.

### TASK-WEB-009  Edit scenario, domain and required properties

**Purpose.** Let the user declare what the analysis is about, with the same vocabulary the API and CLI validate.

**Owns.** `apps/web/src/scenario/ScenarioEditor.tsx`, `apps/web/src/scenario/DomainEditor.tsx`, `apps/web/src/scenario/RequiredProperties.tsx`

**Requirement links.** `REQ-PRJ-004`

**Prerequisites.** `TASK-WEB-004`

**Implementation.** Provide controls to create and edit a `Scenario` on the selected snapshot: allocations with role, dtype, shape and strides; alias groups; the launch configuration as a restricted integer-expression tree; the reference computation; and the required-property set. Unknown property ids are refused with the offending id named, and the editor never applies a default property set on the user's behalf. Launch expressions are edited through typed operands so that a parameter resolving to nothing or a divisor not provably positive is rejected in place, and the human display hint is text that is never parsed back. Saving creates a scenario on the snapshot and validates server-side before persisting.

**Acceptance.** Creating a scenario with the required properties empty is refused with the requirement named; an unknown property id is refused naming the id; a launch expression naming an undeclared parameter is refused in the control; a saved scenario round-trips through the API unchanged.

**Verification.** Environment: hosted API with the schema fixtures. Command: `pnpm --filter @pomset/web test -- scenario-editor`. Observe: refusal messages, saved scenario body.

**Artifacts.** The scenario, domain and required-property editors and their validation paths.

### TASK-WEB-010  Explain disabled and unavailable capabilities with the alternative that exists

**Purpose.** Make every unavailable control state why it is unavailable and what would enable it, instead of sitting inert.

**Owns.** `apps/web/src/capability/UnavailablePanel.tsx`, `apps/web/src/capability/useCatalogue.ts`, `apps/web/src/capability/DisabledControl.tsx`

**Requirement links.** `REQ-UX-010`, `REQ-UX-011`, `REQ-EXP-013`, `REQ-BCK-011`, `REQ-CLI-014`

**Prerequisites.** `TASK-WEB-001`, `TASK-HST-011`

**Implementation.** Read the profile catalogue and render every profile and capability, including those with support `untested` or availability `unavailable`, each showing its reason instead of being filtered out, reordered or replaced by a similar entry. A disabled control states why it is disabled and what would enable it, and names the alternative that does exist — a different capability, a different profile, or the local CLI command that performs the operation. Requesting an unknown profile id surfaces `PROFILE_NOT_FOUND` and never substitutes a nearby profile. In the read-only local viewer, job and write controls are unavailable with an explanation of why and no attempt to fake them.

**Acceptance.** An unavailable capability appears in the selector with its reason and an alternative, and is not hidden. A disabled run control in the local viewer names why it is disabled and the CLI command that replaces it. An unknown profile id in a URL shows `PROFILE_NOT_FOUND` and no fallback evidence.

**Verification.** Environment: hosted API with an unavailable capability and `pomset serve` over an offline report. Command: `pnpm --filter @pomset/web test -- capability-states`. Observe: reason text, alternatives, no fallback.

**Artifacts.** The capability catalogue hook, the unavailable panel, and the explained disabled control.

### TASK-WEB-011  Render only established ordering edges in the causal event view

**Purpose.** Show the partial order the analysis established, and nothing that implies more.

**Owns.** `apps/web/src/events/EventGraph.tsx`, `apps/web/src/events/partialOrderLayout.ts`, `apps/web/src/events/UnresolvedMarker.tsx`

**Requirement links.** `REQ-EVD-007`, `REQ-UX-002`, `REQ-UX-014`

**Prerequisites.** `TASK-WEB-007`

**Implementation.** Render the actor and event view from the record's partial order, drawing exactly the edges the analysis established and labelling them with their kind and backend semantics. Relationships the analysis did not order are marked unresolved rather than placed on an implied timeline, and no layout step adds an edge, sorts independent events into a total order, or aligns lanes by wall-clock time to look tidy. Selecting an event highlights its actors and source ranges through the shared selection store.

**Acceptance.** A fixture with two independent writers and no established edge between them renders both events with an unresolved marker and no connecting edge. A fixture with one established ordering edge renders exactly that edge and no others. Selecting an event highlights its source range.

**Verification.** Environment: a hosted API fixture carrying partial orders from two backends. Command: `pnpm --filter @pomset/web test -- event-graph`. Observe: edge count and unresolved markers.

**Artifacts.** The event graph, the partial-order layout, and the unresolved-relationship marker.

### TASK-WEB-012  Show static and dynamic validation results side by side

**Purpose.** Keep a proof and an instrumented observation as two results about one property, whose disagreement is information.

**Owns.** `apps/web/src/validation/PropertyResultsPanel.tsx`, `apps/web/src/validation/MethodColumns.tsx`

**Requirement links.** `REQ-EVD-002`, `REQ-VAL-004`

**Prerequisites.** `TASK-WEB-008`

**Implementation.** Under each property id, render one column per result: a static or symbolic result with its outcome `established`, `violated` or `unknown` and evidence class `verified-under-assumptions` or `counterexample`, and an instrumented result with evidence class `observed`. The two are never merged into one row and a clean instrumented run is titled as observed coverage rather than race freedom. Where a proof and an observation disagree, both are shown with their methods, and each carries its own assumptions, budget and coverage.

**Acceptance.** A property with one established symbolic result and one clean sanitizer observation renders two rows under that property id, the observation labelled as observed coverage of that run. A property with only an instrumented result renders no `established` outcome.

**Verification.** Environment: hosted API with a fixture carrying both result kinds for one property. Command: `pnpm --filter @pomset/web test -- validation-columns`. Observe: row count, titles, evidence classes.

**Artifacts.** The property results panel and the per-method columns.

### TASK-WEB-013  Surface the qualified correction hint with a rerun action

**Purpose.** Explain a recognized output-coverage cause as a qualified suggestion, with the user in control of validating it.

**Owns.** `apps/web/src/hints/CorrectionHint.tsx`, `apps/web/src/hints/rerunAction.ts`

**Requirement links.** `REQ-EVD-014`

**Prerequisites.** `TASK-WEB-008`

**Implementation.** When an output-coverage witness carries the recognized positive-N/positive-BLOCK floor-grid trigger, show the ceiling-division suggestion, rendered as `grid = (triton.cdiv(N, BLOCK),)`, together with the witness it is derived from and an explicit qualifier that it explains one recognized pattern and is not a proved functional repair. Offer a rerun action that creates a new snapshot and a new job and lets the user validate the change. The hint never edits the kernel automatically and never appears for any other cause of an unwritten output.

**Acceptance.** The N=1025 floor-grid fixture shows the hint with the `triton.cdiv` suggestion, the witness, and the qualifier, plus a rerun action; invoking rerun creates a new snapshot and job and leaves the original report unchanged. A different unwritten-output cause shows no hint.

**Verification.** Environment: hosted API with the N=1025 fixture and the corrected control. Command: `pnpm --filter @pomset/web test -- correction-hint`. Observe: hint text, witness link, original report after rerun.

**Artifacts.** The correction-hint component and the rerun action that creates a new snapshot and job.

### TASK-WEB-014  Compare snapshots and validation regressions

**Purpose.** Support the detect, explain, modify, re-analyse, compare workflow over two named snapshots.

**Owns.** `apps/web/src/compare/SnapshotDiff.tsx`, `apps/web/src/compare/RegressionTable.tsx`

**Requirement links.** `REQ-PRJ-009`, `REQ-VAL-009`

**Prerequisites.** `TASK-WEB-004`

**Implementation.** Let the user name two snapshots of one project and show the file-level change between them alongside a per-property and per-region comparison of the two snapshots' outcomes marked improved, regressed or unchanged. The comparison reads results by their own `snapshotId` and never re-labels the older snapshot, never fabricates a result the older snapshot lacks, and refuses a comparison between different domains rather than approximating one.

**Acceptance.** Comparing a parent and child snapshot whose only difference is the corrected launch expression shows the file change and a per-region change from an unwritten-index classification to no violation, with the older result unchanged. Comparing two different domains is refused with the reason named.

**Verification.** Environment: hosted API with the N=1025 and corrected fixtures as two snapshots. Command: `pnpm --filter @pomset/web test -- snapshot-compare`. Observe: diff, per-region verdicts, refusal case.

**Artifacts.** The snapshot diff view and the regression comparison table.

### TASK-WEB-015  Chart measured against estimated with region coverage shown

**Purpose.** Make every performance chart say whether its values are measured or estimated, and what they covered.

**Owns.** `apps/web/src/performance/PerformanceChart.tsx`, `apps/web/src/performance/ChartLegend.tsx`

**Requirement links.** `REQ-PERF-008`, `REQ-PERF-011`, `REQ-UX-013`

**Prerequisites.** `TASK-WEB-008`, `TASK-PRS-004`

**Implementation.** Render measurements and estimates in separate series, labelling each as `measured` or `estimated` on the axis and legend, not only in a tooltip, and showing which configurations and regions produced each point. Points come only from measurements with `measured` evidence class and from explicitly labelled estimates; the chart never draws a point implying coverage of a domain region that was not covered. A causal explanation attached to a chart cites a measured metric, a compilation artifact or a declared resource model and names which, and the chart never presents a slower run as its own explanation. Hardware cohorts stay separate, and a cross-cohort view is labelled a comparison of cohorts.

**Acceptance.** A chart of one measured series and one estimated series labels both on the legend and axis; a chart whose domain coverage is three of eight regions states that and draws no point for the other five; an explanation without a cited metric or artifact is not rendered.

**Verification.** Environment: hosted API with eligible measurements from two cohorts plus one estimate. Command: `pnpm --filter @pomset/web test -- performance-chart`. Observe: series labels, coverage statement, explanation citations.

**Artifacts.** The performance chart and its legend, with measurement-versus-estimate and coverage labelling.

### TASK-WEB-016  Preview and publish while preserving every qualifier

**Purpose.** Make publication a previewed, explicit act whose rendered report keeps every qualifier of the evidence it contains.

**Owns.** `apps/web/src/publication/PublicationDialog.tsx`, `apps/web/src/publication/DisclosurePreviewPanel.tsx`, `apps/web/src/publication/PublicReportView.tsx`

**Requirement links.** `REQ-SHR-002`, `REQ-SHR-003`, `REQ-SHR-009`, `REQ-SHR-010`, `REQ-UX-015`, `REQ-SEC-009`

**Prerequisites.** `TASK-WEB-004`, `TASK-HST-010`

**Implementation.** Provide a publication dialog requiring an explicit snapshot and an explicit artifact set, and render the server-computed disclosure preview enumerating the categories and counts of what would become visible — source text, file paths, logs, compiler artifacts, witness details, hardware metadata, profile revisions, measurements and findings — enabling the publish action only after the caller accepts the current preview; a preview a snapshot change has made stale disables publishing and requests a fresh one. The public report view renders the published snapshot with its coverage, assumptions, budget, evidence class and eligibility intact, states that publication is not an endorsement of correctness, and resolves a replayed link to the snapshot, scenario, profile revision and tool metadata it was created with rather than to the project's current state. Revoking is an explicit action whose wording says access is denied from now on and that already downloaded copies are not recalled. No control on this path edits a snapshot, starts a job or imports a bundle.

**Acceptance.** The preview panel enumerates source text, paths, logs, hardware metadata and witness details before the publish action is enabled; publishing then opening the public view retains every qualifier of the underlying result; revoking shows the honest wording and the subsequent read fails.

**Verification.** Environment: hosted API with a fixture project and one anonymous client, plus an exported bundle. Command: `pnpm --filter @pomset/web test -- publication-flow`. Observe: preview contents, qualifier retention, revocation wording.

**Artifacts.** The publication dialog, the disclosure preview panel, and the public report view preserving qualifiers.

### TASK-WEB-017  Render empty, offline, unknown-profile, budget-limited and partial states

**Purpose.** Replace blank panels and indefinite spinners with the state that actually applies.

**Owns.** `apps/web/src/states/EmptyState.tsx`, `apps/web/src/states/OfflineState.tsx`, `apps/web/src/states/PartialState.tsx`, `apps/web/src/states/UnknownProfileState.tsx`

**Requirement links.** `REQ-UX-016`

**Prerequisites.** `TASK-WEB-005`

**Implementation.** Render an explicit state for each case: an empty result set says no analysis has run for this snapshot and scenario and offers the action that would produce one; an offline or unreachable service says the service cannot be reached and that a local read-only view of exported reports remains available; a wrong or unknown profile renders `PROFILE_NOT_FOUND` with the requested id and no substitute evidence; a budget-limited inconclusive result renders `unknown` with the exhausted limit named and links the assumptions and budget it was taken under; and a partially complete evidence set renders with its completeness qualifier and the count of properties still undecided. No panel shows a blank region or an indefinite spinner in any of these cases, and the read-only local viewer renders the same states from the same components.

**Acceptance.** Opening a snapshot with no results shows the empty state with its action and no spinner. Stopping the local service and reloading shows the offline state naming the local alternative. Requesting a nonexistent profile id shows `PROFILE_NOT_FOUND` with the id and no results. Opening a cancelled job's lane shows the partial state with the completeness qualifier.

**Verification.** Environment: the built app against a stopped service, an empty project, a nonexistent profile id and a cancelled job fixture. Command: `pnpm --filter @pomset/web test -- states`. Observe: the four rendered states and the absence of any indefinite spinner.

**Artifacts.** The empty, offline, unknown-profile and partial-evidence state components shared with the local viewer.

### TASK-WEB-018  Make the workbench responsive, keyboard-operable and named for assistive technology

**Purpose.** Keep the core interaction — navigating evidence — available without a pointer and on a narrow viewport.

**Owns.** `apps/web/src/a11y/`, `apps/web/src/layout/responsive.css`, `packages/ui/src/a11y/names.ts`

**Requirement links.** `REQ-UX-017`

**Prerequisites.** `TASK-WEB-001`

**Implementation.** Define a logical focus order and keyboard bindings for the project tree, the editor, the lane grid, the finding list, the actor and memory views and the event graph, so that selecting a finding can be done, and its linked actors, source ranges and events reached, without a pointer. Give every finding, actor, source range and event a programmatic name built from its role, identity and source location so assistive technology announces something meaningful, wire the semantic status badges to live-region announcements, and reflow the layout at a narrow viewport so that lanes stack and the editor remains usable rather than compressing panels past readability. Colour, hover and pointer-only affordances are never the sole way to reach a state.

**Acceptance.** With the pointer unused, a user can move focus to a finding, open its linked source range and reach its event view using the keyboard alone. Every finding, actor and event exposes a non-empty accessible name. At the narrowest tested viewport the lane grid reflows to stacked lanes with no horizontal scrolling of the editor body.

**Verification.** Environment: the built app with the accessibility assertion suite at two viewport widths. Command: `pnpm --filter @pomset/web test -- a11y`. Observe: keyboard-only traversal result, computed accessible names, reflowed layout.

**Artifacts.** The focus order and key bindings, the responsive layout rules, and the accessible-name helpers shared by hosted and local views.
