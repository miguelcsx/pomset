# Editor-first workstation review

The editor is the primary surface. A new browser workspace starts with an empty
file, not an example or invented result. Source, scenario declarations, profiles
and captured evidence remain separate. The user requested an IDE layout and then
asked to retain it while replacing the blue palette and text-heavy inspector.
The current palette uses warm neutral surfaces and violet interaction accents.

The review covered the SRS, architecture, ADR, delivery, evaluation, contracts
and reference documents, including the Compiler Explorer disposition and
`inspo/` editor/pane implementation. No Compiler Explorer source was copied.
[ADR-0003](../adr/0003-workbench-composition.md) records the composition references;
[ADR-0013](../adr/0013-local-symbolic-workstation.md) records the explicitly
launched local symbolic application and its execution boundary.

## Implemented interaction loop

- Full-height Monaco and evidence panes share a keyboard-resizable divider.
  Icon controls stay in a compact top toolbar; a thin bottom bar shows actual
  save state, analysis mode, file count and source location.
- Working files can be opened, edited, added, renamed and downloaded. Scenarios
  can be imported or configured using fields and canonical JSON. Runtime profiles
  come from actual probes; unavailable native adapters explain their limitation.
- Submission captures source and declaration bytes into SQLite/CAS snapshots.
  Analysis uses the shared parser, Z3 queries, process supervisor and contracts.
  Cancellation persists before signalling the process. Automatic reruns are opt-in.
- Browser drafts persist in IndexedDB. Reconnection reads actual job state and
  previous results. Historical source links show captured bytes read-only while
  the working editor retains its edits.
- The inspector renders recorded access relationships, witness assignments and
  region/property classifications. Identical constraint sets can share a row;
  conflicting classifications are never merged. Graph layout has no time meaning
  and cells do not imply measured coverage percentages.
- Explanation, exact witnesses, assumptions, model revisions, source links and
  provenance remain available through Details. Unsupported and budget-exhausted
  queries stay explicit; no GPU run or numerical measurement is invented.
- Disclosure preview precedes local portable-report download. Hosted publication
  is not implemented and this action creates no public link.

The later [editor and kernel review](editor-and-kernel-review.md) records file-tab
closing, additional soundness fixes and updated verification counts.

## Local evidence

The complete aggregate command passes 161 TypeScript tests and 31 Python tests.
New tests cover the real HTTP/engine loop, origin/host/capability rejection,
invalid submissions, exact profiles, immutable defect/control snapshots,
cancellation, non-execution of top-level Python, store ownership, expression
parsing, semantic input identity and conservative region grouping.

Internal-browser observations on the built application:

- Imported the owned transform fixture and canonical scenario, then explicitly
  matched workspace paths. The floor-grid scenario produced a source-linked
  output-coverage counterexample. Editing Grid 0 to `ceildiv(N, BLOCK)` produced
  established coverage under the model in a new snapshot.
- Editing source triggered opt-in automatic analysis. Invalid indentation failed
  explicitly; a left-associated pointer expression was explicitly unsupported;
  a more complex quantified query exhausted its 5000 ms solver budget and
  produced unknown outcomes. These are real limitations, not successful checks.
- At 390 × 844, editor and inspector stack; document dimensions were exactly
  390 × 844 with no document overflow. Light/dark layouts were inspected and the
  temporary viewport override was reset. This is not full accessibility certification.
- Keyboard activation of a graph access opened its captured source; arrow keys
  resized the split from 56% to 58% and back.
- Historical evidence remained readable beside changed working code. A source
  link opened the original captured file. The downloaded report passed the CLI's
  canonical, semantic, provenance and source-hash checks.

This is regression and interaction evidence, not ACC-001 through ACC-010 closure.
The owned fixture is a reconstruction of a public failure pattern, not evidence
that an exact upstream checkout was reproduced. Independent comparisons, strategy
measurements and the feasibility go/no-go obligations remain open. The lazy Monaco
bundle still produces a size warning; application performance budgets, full
screen-reader evaluation, native adapters, hosted deployment and Linux containment
remain unverified or incomplete as recorded in the
[implementation audit](implementation-audit.md).

The [verification record](reports/workbench-verification.json),
[complete command log](reports/workbench-ci.log) and
[browser capture](reports/workbench-visual.jpg) retain this run’s evidence.
