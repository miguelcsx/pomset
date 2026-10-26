# ADR-0003  Workbench composition

## Context

The mock branch settled the visual language: four panels, comparison lanes,
semantic colour roles, dark and light tokens, source-linked evidence. What the
mock does not settle is the implementation. Its rendering is a single
`innerHTML` rewrite per state change with delegated listeners, its lanes advance
on a fixed 420 ms timer through six staged labels, and two lanes are pre-seeded
as finished so the page opens on a comparison. Those are maquette decisions.

The Compiler Explorer reference offers an alternative: Monaco inside a pane
framework with GoldenLayout, jQuery and an EventHub.

## Decision

- **Code is the starting point.** Open into an editable multi-file working copy,
  without requiring project onboarding. The project remains the ownership and
  storage unit; the navigator is optional. Scenario declarations and profile
  selection belong beside the source. Captured evidence opens read-only, and
  forking it creates separate working files without relabelling the old result.
- **Contextual inspection.** Source occupies the main pane; real findings, actors,
  accesses and coverage occupy the adjacent pane. Wide panes scroll independently;
  narrow layouts reflow. No fabricated causal timeline is introduced.
- **Share discoveries explicitly.** Local disclosure-preview downloads preserve
  original bytes and qualifiers. Hosted links require implemented ownership,
  selected immutable data, publication and revocation; a file download does not
  imply those services exist.
- **React, Monaco and Vite.** Monaco is the editor, mounted in a React
  component. No editor is written from scratch.
- **Bounded CSS-grid panels and comparison lanes**, laid out by the application.
  No GoldenLayout, no jQuery, no EventHub migration. Typed component boundaries
  and explicit state are borrowed as a concept only.
- **Shared semantic tokens** in `packages/ui`: the spacing scale 4, 8, 12, 16, 24,
  32, and the roles `violation`, `caution`, `activity`, `unknown`, `contract`
  with fixed meaning across themes.
- **Real job state, never staged progress.** Lanes are driven by the job event
  stream. A cancelled run stays visible with its partial evidence.
- **Real UI copy starts in English.** The mock's Spanish visible copy is a
  fixture rule for a disposable branch, not a product requirement. Domain
  identifiers such as `runtime`, `Tokio`, `asyncio`, `deadlock` and `snapshot`
  are never translated.
- **Copy the visual intent, not the fixtures.** The mock's source text, profile
  list and evidence rows describe an asyncio scenario that is not part of the
  selected scope, and they are not imported.

## Consequences

- The workbench is a normal React application with a store and typed props,
  which is easier to test and to share with the read-only local viewer.
- The four-lane cap, the spacing scale and the five semantic roles survive as
  product constraints; the mock's markup, timers and seeded results do not.
- Accessibility is a first-class obligation rather than a property of markup
  incidentally produced by a mock: keyboard operation, non-colour-only status,
  responsive reflow, and meaningful names for findings, actors and ranges.

## Validation obligations

- Verify in a browser that a cancelled job, a stale snapshot and an unsupported
  capability each render as distinct states, and that the same components serve
  the hosted and local read-only report routes.
- Verify keyboard-only navigation from a finding to its actors, source ranges,
  memory accesses and events.

## Links

Requirements: [`REQ-UX-001`](../srs/workbench.md) …
`REQ-UX-017`, `REQ-CLI-013`, `REQ-CLI-014`.
Reference: [`../reference/compiler-explorer.md`](../reference/compiler-explorer.md).
Specification: [`../architecture/workbench.md`](../architecture/workbench.md).

Design references: [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout),
[OpenAI canvas](https://openai.com/index/introducing-canvas/),
[Anthropic artifacts](https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them).
These guide hierarchy and content-focused interaction, not copied assets or a chat interface.
