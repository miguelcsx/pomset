/** Visual inspection first. Exact evidence remains available without expanding the workspace chrome. */
import { useEffect, useState, type JSX } from "react";
import type { Finding } from "@pomset/contracts";
import type { InspectionDocument, SourceSelection } from "./inspection.js";
import { AccessDiagram } from "./AccessDiagram.js";
import { DomainMap } from "./DomainMap.js";
import { Icon } from "./Icon.js";
import { propertyLabel } from "./property-labels.js";
import { roleFor } from "./report-page.js";
export function EvidencePanel({ document, experience, finding, onFinding, onSource }: {
  readonly document: InspectionDocument; readonly experience: "Explore" | "Validate" | "Optimize";
  readonly finding: Finding | undefined; readonly onFinding: (finding: Finding) => void; readonly onSource: (source: SourceSelection) => void;
}): JSX.Element {
  const { analysis, scenario } = document;
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"memory" | "domain" | "details">("memory");
  const findings = analysis.findings ?? [];
  const witness = analysis.witnesses?.find((item) => item.witnessId === finding?.witnessId);
  useEffect(() => setView(experience === "Validate" ? "domain" : "memory"), [experience]);
  const visibleView = view;
  return <section className="panel evidence-panel visual-inspector" aria-label="Evidence inspector">
    {experience === "Optimize" ? <div className="visual-empty"><Icon name="chart" size={36} /><strong>No measurements</strong><span>This report contains symbolic evidence.</span></div> : <>
      <div className="property-summary">{analysis.propertyResults.map((property) => <button key={property.propertyResultId} className={`property-row outcome ${roleFor(property.outcome)}`} title={`${propertyLabel(property.propertyId)}: ${property.outcome}. ${property.unknownReason ?? property.unsupportedReason ?? "Qualified by the declared model and assumptions."}`} onClick={() => { const first = findings.find((item) => item.propertyId === property.propertyId); if (first) { onFinding(first); setView("memory"); } else setView("domain"); }}>
        <Icon name={property.outcome === "violated" ? "warning" : property.outcome === "established" ? "check" : "info"} size={17} /><span>{propertyLabel(property.propertyId)}<small>{property.outcome === "established" ? "Established · model" : property.outcome}</small></span>
      </button>)}</div>
      <div className="inspector-tabs" role="group" aria-label="Evidence view">{([{ id: "memory", icon: "memory", label: "Memory" }, { id: "domain", icon: "layers", label: "Domain" }, { id: "details", icon: "code", label: "Details" }] as const).map((item) => <button key={item.id} aria-pressed={visibleView === item.id} onClick={() => setView(item.id)}><Icon name={item.icon} size={14} />{item.label}</button>)}<span className="inspector-completeness" title="Job completion is separate from correctness">{analysis.completeness?.kind ?? "Unstated"}</span></div>
      {visibleView === "memory" && <>
        {findings.length > 0 && <div className="finding-selector"><Icon name="warning" size={14} /><select aria-label="Selected finding" value={finding?.findingId ?? ""} onChange={(event) => { const next = findings.find((item) => item.findingId === event.target.value); if (next) onFinding(next); }}>{findings.slice(page * 50, (page + 1) * 50).map((item, index) => <option key={item.findingId} value={item.findingId} title={item.title}>{page * 50 + index + 1} · {propertyLabel(item.propertyId)}{item.sourceRanges[0] ? ` · ${item.sourceRanges[0].path.split("/").at(-1)}:${item.sourceRanges[0].startLine}` : ""}</option>)}</select>{findings.length > 50 && <><button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous findings">‹</button><button disabled={(page + 1) * 50 >= findings.length} onClick={() => setPage(page + 1)} aria-label="Next findings">›</button></>}</div>}
        {finding ? <>
          <AccessDiagram key={finding.findingId} document={document} finding={finding} onSource={onSource} />
          {witness && <div className="witness-inputs" aria-label="Counterexample assignments">{witness.assignments.map((assignment) => <span key={assignment.name}><small>{assignment.name}</small><code>{assignment.value}</code></span>)}</div>}
          <div className="evidence-caption"><span>{finding.evidenceClass}</span><span title={witness?.replay?.note}>Replay: {witness?.replay?.outcome ?? "not recorded"}</span></div>
          <details className="finding-explanation"><summary>Explanation</summary><p>{finding.explanation ?? finding.title}</p>{witness?.replay?.note && <p>{witness.replay.note}</p>}{finding.correctionHint && <code>{finding.correctionHint.suggestion}</code>}</details>
        </> : <><div className="visual-empty"><Icon name={analysis.propertyResults.some((property) => property.outcome === "unsupported") ? "info" : "layers"} size={36} /><strong>{analysis.propertyResults.some((property) => property.outcome === "unsupported") ? "Outside the supported model" : analysis.propertyResults.some((property) => property.outcome === "unknown") ? "Analysis inconclusive" : "No counterexample"}</strong><span>{analysis.propertyResults.find((property) => property.unsupportedReason)?.unsupportedReason ?? analysis.propertyResults.find((property) => property.unknownReason)?.unknownReason ?? "Inspect the domain and assumptions."}</span></div><DomainMap analysis={analysis} /></>}
      </>}
      {visibleView === "domain" && <DomainMap analysis={analysis} />}
      {visibleView === "details" && <div className="exact-evidence">{finding && <><h3>{finding.title}</h3><p>{finding.explanation}</p><div className="source-links">{finding.sourceRanges.map((range, index) => <button key={index} onClick={() => onSource({ path: range.path, line: range.startLine, ranges: finding.sourceRanges })}><Icon name="code" size={14} />{range.path}:{range.startLine}</button>)}</div>{witness && <details><summary>Exact witness & minimization</summary><pre>{JSON.stringify(witness, null, 2)}</pre></details>}<details><summary>Actors, accesses & order</summary><pre>{JSON.stringify({ actors: analysis.actors?.filter((actor) => finding.actorIds.includes(actor.actorId)), events: analysis.events?.filter((event) => finding.eventIds.includes(event.eventId)), order: finding.order }, null, 2)}</pre></details></>}
        {analysis.propertyResults.map((property) => <details key={property.propertyResultId} open={property.outcome === "unsupported" || property.outcome === "unknown"}><summary>{propertyLabel(property.propertyId)} · {property.outcome}</summary><p>{property.method} · {property.evidenceClass}</p><p>{property.unknownReason ?? property.unsupportedReason}</p><p>Model {property.assumptions.model}@{property.assumptions.modelRevision}</p><ul>{property.assumptions.items.map((item) => <li key={item.assumptionId}>{item.statement}</li>)}</ul></details>)}
        <details><summary>Domain, coverage & budget</summary><pre>{JSON.stringify({ domain: scenario.domain, coverage: analysis.coverage, budget: analysis.budget }, null, 2)}</pre></details>
        <details><summary>Profile & provenance</summary><pre>{JSON.stringify({ profile: document.profile, snapshotId: document.snapshot.snapshotId, resultId: analysis.resultId, policy: [analysis.policyId, analysis.policyRevision] }, null, 2)}</pre></details>
      </div>}
      <div className="visual-footnote"><Icon name="info" size={12} /><span>Under the declared model. Completion ≠ correctness.</span></div>
    </>}
  </section>;
}
