/** A graph of recorded access relationships; its geometry encodes no time or coverage. */
import { useState } from "react";
import type { Finding } from "@pomset/contracts";
import type { InspectionDocument, SourceSelection } from "./inspection.js";
import { Icon } from "./Icon.js";
export function AccessDiagram({ document, finding, onSource }: { document: InspectionDocument; finding: Finding; onSource: (value: SourceSelection) => void }) {
  const { analysis, scenario } = document;
  const events = (analysis.events ?? []).filter((event) => finding.eventIds.includes(event.eventId));
  const [selected, setSelected] = useState(events[0]?.eventId);
  const event = events.find((item) => item.eventId === selected) ?? events[0];
  if (!events.length) return <div className="visual-empty"><Icon name="layers" size={32} /><span>No access graph recorded</span></div>;
  const height = Math.max(190, events.length * 106 + 55);
  const witness = analysis.witnesses?.find((item) => item.witnessId === finding.witnessId);
  return <div className="access-visual">
    <div className="visual-caption"><span>{analysis.method === "symbolic" ? "Symbolic access graph" : "Recorded access graph"}</span><span title="Connections are accesses, not a timeline or measured traffic."><Icon name="info" size={13} /></span></div>
    <svg className="access-diagram" viewBox={`0 0 540 ${height}`} role="group" aria-label={`${events.length} access relationships for ${finding.title}`}>
      <text className="diagram-column" x="25" y="22">ACTOR</text><text className="diagram-column" x="374" y="22">ALLOCATION</text>
      {events.map((item, index) => {
        const actor = analysis.actors?.find((actor) => actor.actorId === item.actorId);
        const allocation = scenario.allocations.find((allocation) => allocation.allocationId === item.allocationId);
        const y = 45 + index * 106;
        const coordinates = actor?.coordinates ? Object.entries(actor.coordinates).map(([key, value]) => `${key} ${JSON.stringify(value)}`).join(" · ") : "";
        const range = item.sourceRanges?.[0];
        const activate = () => { setSelected(item.eventId); if (range) onSource({ path: range.path, line: range.startLine, ranges: item.sourceRanges ?? [] }); };
        return <g key={item.eventId} className={`diagram-access ${item.eventId === event?.eventId ? "is-selected" : ""}`} tabIndex={0} role="button" aria-label={`${item.operation} ${allocation?.name ?? "synchronization"}${range ? ` at ${range.path}:${range.startLine}` : ""}`} onClick={activate} onKeyDown={(key) => { if (key.key === "Enter" || key.key === " ") { key.preventDefault(); activate(); } }}>
          <title>{actor?.label ?? item.actorId}{coordinates ? `; ${coordinates}` : ""}; {item.addressExpr}; mask: {item.maskExpr ?? "unstated"}</title>
          <rect className="diagram-node" x="18" y={y} width="174" height="70" rx="8" />
          <text className="diagram-label" x="33" y={y + 27}>{actor?.kind === "symbolic-domain" ? "Symbolic domain" : actor?.kind ?? "Actor"}</text>
          <text className="diagram-meta" x="33" y={y + 49}>{coordinates.length > 23 ? `${coordinates.slice(0, 22)}…` : coordinates || "No concrete actor"}</text>
          <path className="diagram-edge" d={`M192 ${y + 35} H348 m-7 -5 l7 5 -7 5`} />
          <circle className="diagram-operation" cx="270" cy={y + 35} r="19" />
          <text className="diagram-op-text" x="270" y={y + 40} textAnchor="middle">{item.operation.includes("write") ? "W" : item.operation.includes("read") ? "R" : "S"}</text>
          <text className="diagram-meta" x="270" y={y + 77} textAnchor="middle">{witness?.kind === "output-index" ? "no enabled writer" : item.addressConcrete ? `${item.addressConcrete.bytes} B` : "symbolic address"}</text>
          <rect className="diagram-node target-node" x="348" y={y} width="174" height="70" rx="8" />
          <text className="diagram-label" x="364" y={y + 27}>{allocation?.name ?? "Synchronization"}</text>
          <text className="diagram-meta" x="364" y={y + 49}>{allocation ? `${allocation.role} · ${allocation.dtype}` : item.scope}</text>
        </g>;
      })}
    </svg>
    {witness?.kind === "output-index" && <div className="witness-marker"><Icon name="warning" size={15} /><span>Unwritten output</span>{witness.assignments.filter((item) => item.name === "outputIndex").map((item) => <code key={item.name}>index {item.value}</code>)}</div>}
    {event && <div className="selected-access"><code title={event.addressExpr}>{event.addressExpr}</code>{event.sourceRanges?.[0] && <button title="Reveal source" onClick={() => onSource({ path: event.sourceRanges![0]!.path, line: event.sourceRanges![0]!.startLine, ranges: event.sourceRanges ?? [] })}><Icon name="code" size={14} />L{event.sourceRanges[0].startLine}</button>}</div>}
  </div>;
}
