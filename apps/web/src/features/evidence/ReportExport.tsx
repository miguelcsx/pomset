/** A local disclosure preview and file download; hosted publication is a separate act. */
import { useEffect, useRef, type JSX } from "react";
import { Icon, type InspectionDocument } from "@pomset/ui";
import { downloadText } from "../workspace/working-copy";

export function ReportExport({ document, onClose }: { readonly document: InspectionDocument; readonly onClose: () => void }): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const { snapshot, scenario, analysis, profile, job, sourceFiles } = document;
  const categories = [
    ["Source files & file paths", snapshot.files.length],
    ["Source bytes", snapshot.files.reduce((sum, file) => sum + file.bytes, 0)],
    ["Findings", analysis.findings?.length ?? 0],
    ["Witnesses & assignments", analysis.witnesses?.length ?? 0],
    ["Actors & memory events", (analysis.actors?.length ?? 0) + (analysis.events?.length ?? 0)],
    ["Profile revisions & environment", 1],
    ["Scenario & declared domain", 1],
  ] as const;
  function download() {
    const report = {
      schemaVersion: 1, tool: { name: "@pomset/web", version: process.env.NEXT_PUBLIC_POMSET_WEB_VERSION ?? "0.0.0" },
      jobId: analysis.jobId, scenarioId: analysis.scenarioId, snapshotId: analysis.snapshotId, profileRevisionId: analysis.profileRevisionId,
      policyId: analysis.policyId, policyRevision: analysis.policyRevision,
      properties: analysis.propertyResults.map(({ propertyId, outcome, method, evidenceClass, unknownReason, unsupportedReason }) => ({ propertyId, outcome, method, evidenceClass, ...(unknownReason ? { unknownReason } : {}), ...(unsupportedReason ? { unsupportedReason } : {}) })),
      qualifiers: { coverage: analysis.coverage.denominator, assumptions: [...new Set(analysis.propertyResults.flatMap((item) => item.assumptions.items.map((assumption) => assumption.statement)))], budget: analysis.budget },
      events: [], snapshot, scenario, analysis, profile, ...(job ? { job } : {}), sourceFiles,
    };
    downloadText(`pomset-${analysis.resultId}.json`, JSON.stringify(report, null, 2) + "\n", "application/json");
    onClose();
  }
  return <dialog ref={dialog} className="disclosure-dialog" aria-labelledby="export-title" onCancel={onClose} onClose={onClose}>
    <div className="panel-heading"><span className="section-label">Share an experiment</span><button className="icon-button" aria-label="Close export preview" onClick={onClose}><Icon name="close" /></button></div>
    <h2 id="export-title">Review what you’ll share.</h2><p>Download a portable report, then choose who receives it. Nothing is uploaded or published by this action.</p>
    <code className="export-snapshot">{snapshot.snapshotId}</code>
    <dl className="disclosure-counts">{categories.map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count.toLocaleString("en-US")}</dd></div>)}</dl>
    <p className="muted">Includes model, assumptions, coverage, budget and exact profile data. Source and hardware metadata may be private. Compiler logs and external artifacts are not included.</p>
    <div className="dialog-actions"><button onClick={onClose}>Cancel</button><button className="primary-button" onClick={download}><Icon name="external" size={16} />Download report</button></div>
  </dialog>;
}
