/** Access connections are not temporal order. Only recorded actors and events are drawn. */
import type { JSX } from "react";
import type { Finding } from "@pomset/contracts";
import type { InspectionDocument, SourceSelection } from "./inspection.js";
import { Icon } from "./Icon.js";

export function MemoryEvidence({ document, finding, onSource }: { readonly document: InspectionDocument; readonly finding: Finding; readonly onSource: (selection: SourceSelection) => void }): JSX.Element {
  const { analysis, scenario } = document;
  const actors = (analysis.actors ?? []).filter((actor) => finding.actorIds.includes(actor.actorId));
  const events = (analysis.events ?? []).filter((event) => finding.eventIds.includes(event.eventId));
  return <div className="memory-evidence">
    <p className="graph-qualifier">These connections show accesses, not an execution timeline.</p>
    <div className="actor-cards">{actors.map((actor) => <div className="actor-card" key={actor.actorId}><Icon name={actor.kind === "symbolic-domain" ? "layers" : "cpu"} size={16} /><div><strong>{actor.label}</strong>{actor.coordinates && <dl>{Object.entries(actor.coordinates).map(([name, value]) => <div key={name}><dt>{name}</dt><dd><code>{JSON.stringify(value)}</code></dd></div>)}</dl>}</div></div>)}</div>
    {events.map((event) => {
      const allocation = scenario.allocations.find((item) => item.allocationId === event.allocationId);
      const ranges = event.sourceRanges ?? [];
      const source = ranges[0];
      return <div className="access-card" key={event.eventId}>
        <div className="access-connection"><span>{actors.find((actor) => actor.actorId === event.actorId)?.label ?? event.actorId}</span><Icon name="arrow" size={16} /><span><Icon name="memory" size={15} />{allocation?.name ?? "Synchronization event"}</span></div>
        <div className="access-qualifiers"><span>{analysis.method === "symbolic" || analysis.method === "static" ? "Modeled" : "Recorded"} {event.operation} · {event.scope}</span>{allocation && <span>{allocation.role} · {allocation.dtype}</span>}</div>
        <dl><dt>Address</dt><dd><code>{event.addressConcrete ? event.addressConcrete.display ?? `${event.addressConcrete.bytes} bytes` : event.addressExpr}</code></dd><dt>Mask</dt><dd><code>{event.maskExpr ?? "Not specified"}</code></dd></dl>
        {source && <button onClick={() => onSource({ path: source.path, line: source.startLine, ranges })}><Icon name="code" size={14} />{source.path.split("/").at(-1)}:{source.startLine}</button>}
      </div>;
    })}
  </div>;
}
