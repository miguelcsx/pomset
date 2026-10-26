/** Snapshot, source, profile and evidence share one linked selection. */
import { useState, type ReactNode } from "react";
import type { Finding } from "@pomset/contracts";
import type { InspectionDocument, SourceSelection } from "./inspection.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { Icon } from "./Icon.js";

export interface InspectorProps {
  readonly document: InspectionDocument;
  readonly experience: "Explore" | "Validate" | "Optimize";
  readonly sourceView: (source: string, selection: SourceSelection, select: (value: SourceSelection) => void) => ReactNode;
}
function decoded(encoded: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)));
  } catch { return "This captured file is not UTF-8 source text."; }
}
export function Inspector({ document, experience, sourceView }: InspectorProps): JSX.Element {
  const { analysis, snapshot, profile, scenario } = document;
  const findings = analysis.findings ?? [];
  const first = findings[0];
  const [selection, setSelection] = useState<SourceSelection>({ path: first?.sourceRanges[0]?.path ?? scenario.entrypoint.path, line: first?.sourceRanges[0]?.startLine ?? 1, ...(first ? { ranges: first.sourceRanges } : {}) });
  const [selectedFinding, setSelectedFinding] = useState<string | undefined>(first?.findingId);
  const [navigator, setNavigator] = useState(false);
  const finding = findings.find((candidate) => candidate.findingId === selectedFinding);
  const encoded = document.sourceFiles[selection.path]?.data;
  function selectFinding(value: Finding) {
    setSelectedFinding(value.findingId);
    const range = value.sourceRanges[0];
    if (range) setSelection({ path: range.path, line: range.startLine, ranges: value.sourceRanges });
  }
  function selectSource(value: SourceSelection) {
    const linked = findings.find((candidate) => candidate.sourceRanges.some((range) => range.path === value.path && range.startLine <= value.line && range.endLine >= value.line));
    setSelectedFinding(linked?.findingId);
    setSelection({ ...value, ...(linked ? { ranges: linked.sourceRanges } : {}) });
  }
  return <div className={`workbench-grid ${navigator ? "" : "navigator-hidden"}`}>
    <aside className="panel project-panel" aria-label="Project and snapshot" hidden={!navigator}>
      <div className="panel-heading"><span className="section-label">Project</span><Icon name="folder" size={16} /></div>
      <h2 className="project-name">{scenario.name}</h2>
      <div className="snapshot-marker"><Icon name="branch" size={15} /><span title={snapshot.snapshotId}>Snapshot {snapshot.snapshotId.slice(-8)}</span><span className="badge">Captured</span></div>
      <h3 className="section-label">Files <span className="count">{snapshot.files.length}</span></h3>
      <ul className="file-tree">{snapshot.files.map((file) => <li key={file.path}><button aria-pressed={selection.path === file.path} onClick={() => selectSource({ path: file.path, line: 1 })}><Icon name="file" size={16} /><span>{file.path.split("/").at(-1)}<small>{file.path.split("/").slice(0, -1).join("/") || "Project root"}</small></span></button></li>)}</ul>
      <div className="navigator-footer"><Icon name="lock" size={16} /><p>Original snapshot.<br />Working edits cannot change this evidence.</p></div>
      <details><summary>Project & scenario identity</summary><code>{snapshot.projectId}</code><code>{snapshot.snapshotId}</code><code>{scenario.scenarioId}</code></details>
    </aside>
    <section className="panel source-panel" aria-label="Source inspector">
      <div className="source-toolbar"><button className="icon-button" aria-label={navigator ? "Hide file navigator" : "Show file navigator"} onClick={() => setNavigator(!navigator)}><Icon name={navigator ? "collapse" : "expand"} /></button><Icon name="file" size={16} /><h2>{selection.path.split("/").at(-1)}</h2><span className="source-readonly"><Icon name="lock" size={13} />Read only</span></div>
      <p className="source-path"><span>{selection.path}</span><span>Line {selection.line}</span></p>
      {sourceView(encoded ? decoded(encoded) : "Source not included in this snapshot.", selection, selectSource)}
      <div className="editor-status"><span><Icon name="branch" size={13} />{snapshot.snapshotId.slice(-8)}</span><span>Captured bytes · Source and evidence linked</span></div>
    </section>
    <section className="panel lanes-panel" aria-label="Profile and job">
      <div className="profile-strip"><span className="profile-icon"><Icon name="cpu" size={21} /></span><div><h2>{profile.backend} <span className="muted">/ {analysis.method}</span></h2><p>{profile.platform.os} · {profile.platform.arch} · {profile.components.map((component) => `${component.name} ${component.version}`).join(" / ")}</p></div><span className="badge">{document.job?.state ?? "Job not included"}</span></div>
      <details><summary>Profile, capability & attempt details</summary><code>{profile.profileRevisionId}</code><p>Evidence {analysis.completeness?.kind ?? "completeness not stated"} · origin {analysis.origin}</p>
        {analysis.completeness?.reason && <p>{analysis.completeness.reason}</p>}
        <p className="muted">Capability references are declared; their support records are not included in this report.</p><ul>{profile.capabilityIds.map((id) => <li key={id}><code>{id}</code></li>)}</ul>
        <p className="muted">This viewer is read only. Use <code>pomset validate --scenario &lt;path&gt;</code> locally.</p>
      </details>
    </section>
    <EvidencePanel document={document} experience={experience} finding={finding} onFinding={selectFinding} onSource={selectSource} />
  </div>;
}
