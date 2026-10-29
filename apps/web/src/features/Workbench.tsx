"use client";

/** Editor, scenario and immutable evidence remain visible in one compact workspace. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import dynamic from "next/dynamic";
import { EvidencePanel, Icon, type IconName, type InspectionDocument, type SourceSelection, type StatusRole } from "@pomset/ui";
import type { Finding, Job, Scenario } from "@pomset/contracts";
import { inspectionDocument } from "./evidence/document";
import { downloadText, editWorkingFile, forkReport, MAX_SOURCE_BYTES, type WorkingCopy } from "./workspace/working-copy";
import { inputIdentity } from "./analysis/input-identity";
import { FileTabs } from "./editor/FileTabs";
import { closeTabs, openTab, type Tabs, type CloseMode } from "./editor/tab-state";
import { RenameFile } from "./editor/RenameFile";
import { ScenarioEditor } from "./scenario/ScenarioEditor";
import { newScenario, parseScenario } from "./scenario/scenario-draft";
import { Splitter } from "./editor/Splitter";
import { ReportExport } from "./evidence/ReportExport";
import { connect, request, submit, terminal, unwrap, workbenchToken, type Connection } from "./analysis/workbench-client";
import { observeJob } from "./analysis/poll-job";
import { readWorkspace, saveWorkspace } from "./workspace/workspace-persistence";
import { WorkbenchAccount } from "./scripts/WorkbenchAccount";
// Monaco touches `self` as it loads, so it is kept out of the server render
// entirely and mounted only once the browser has the editor.
const SourceEditor = dynamic(() => import("./editor/SourceEditor").then((module) => module.SourceEditor), { ssr: false, loading: () => <div className="pane-empty">Opening editor…</div> });
export interface WorkbenchProps { readonly statusRoles: readonly StatusRole[]; }
function Tool({ icon, label, onClick, pressed, disabled }: { icon: IconName; label: string; onClick: () => void; pressed?: boolean; disabled?: boolean }) {
  return <button className="icon-button" title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}><Icon name={icon} size={17} /></button>;
}
function decode(document: InspectionDocument, path: string): string { const file = document.sourceFiles[path]; return file ? new TextDecoder().decode(Uint8Array.from(atob(file.data), (character) => character.charCodeAt(0))) : ""; }
export function Workbench(_props: WorkbenchProps): JSX.Element {
  const [copy, setCopy] = useState<WorkingCopy>(() => ({ id: crypto.randomUUID(), files: [{ path: "untitled.py", source: "" }] }));
  const [scenario, setScenario] = useState<Scenario>(() => newScenario("untitled.py"));
  const [tabs, setTabs] = useState<Tabs>({ closed: [], recent: [] });
  const [path, setPath] = useState("untitled.py");
  const [selection, setSelection] = useState<SourceSelection>({ path: "untitled.py", line: 1 });
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mode, setMode] = useState<"Explore" | "Validate" | "Optimize">("Explore");
  const [configuration, setConfiguration] = useState(false);
  const [connection, setConnection] = useState<Connection>();
  const [profileId, setProfileId] = useState("");
  const [solverTimeMs, setSolverTimeMs] = useState(5000);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState(false);
  const [documents, setDocuments] = useState<InspectionDocument[]>([]);
  const [document, setDocument] = useState<InspectionDocument>();
  const [findingId, setFindingId] = useState<string>();
  const [captured, setCaptured] = useState(false);
  const [split, setSplit] = useState(56);
  const [renaming, setRenaming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();
  const [configError, setConfigError] = useState<string>();
  const [active, setActive] = useState<Job>();
  const [auto, setAuto] = useState(false);
  const [lastInput, setLastInput] = useState("");
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("Restoring…");
  /** The job behind the document on screen; undefined when the document came from a file. */
  const [documentJob, setDocumentJob] = useState<string>();
  const sourceInput = useRef<HTMLInputElement>(null);
  const reportInput = useRef<HTMLInputElement>(null);
  const scenarioInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const observation = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => observation.current?.abort(), []);
  const attempted = useRef("");
  const currentInput = useMemo(() => inputIdentity(copy, scenario, profileId, solverTimeMs), [copy, scenario, profileId, solverTimeMs]);
  const currentFile = copy.files.find((file) => file.path === path) ?? copy.files[0]!;
  const sourceMatches = useMemo(() => !!document && copy.files.every((file) => document.sourceFiles[file.path] && decode(document, file.path) === file.source), [copy.files, document]);
  const stale = !!document && (lastInput ? lastInput !== currentInput : !sourceMatches);
  const finding = document?.analysis.findings?.find((item) => item.findingId === findingId);
  function acceptDocument(value: InspectionDocument, job?: string) { setDocumentJob(job); setLastInput(inputIdentity({ id: "captured", files: value.snapshot.files.filter((file) => file.role !== "config").map((file) => ({ path: file.path, source: decode(value, file.path) })) }, value.scenario, value.profile.profileRevisionId, value.analysis.budget.solverTimeMs ?? solverTimeMs)); setDocument(value); setDocuments((previous) => [...previous.filter((item) => item.analysis.resultId !== value.analysis.resultId), value].slice(-100)); setFindingId(value.analysis.findings?.[0]?.findingId); }
  function editDocument(value: InspectionDocument) {
    const next = forkReport(value); const configs = new Set(value.snapshot.files.filter((file) => file.role === "config").map((file) => file.path));
    setCopy({ ...next, files: next.files.filter((file) => !configs.has(file.path)) }); setScenario(value.scenario); setPath(value.scenario.entrypoint.path); setSelection({ path: value.scenario.entrypoint.path, line: 1 }); setCaptured(false); setLastInput(inputIdentity({ ...next, files: next.files.filter((file) => !configs.has(file.path)) }, value.scenario, value.profile.profileRevisionId, value.analysis.budget.solverTimeMs ?? solverTimeMs));
  }
  useEffect(() => {
    let live = true;
    void readWorkspace().then((value) => { if (live && !new URLSearchParams(location.hash.slice(1)).has("capability") && value?.copy?.files.length && value.scenario) { setCopy(value.copy); setScenario(value.scenario); setPath(value.copy.files[0]!.path); setSelection({ path: value.copy.files[0]!.path, line: 1 }); } }).catch(() => { if (live) setSaved("Browser storage unavailable"); }).finally(() => { if (live) setReady(true); });
    void connect().then((value) => { if (live) { setConnection(value); setProfileId(value.profile.profileRevisionId); setJobs(value.jobs); } }).catch((failure: unknown) => { if (live) setError(String(failure)); });
    const capability = new URLSearchParams(location.hash.slice(1)).get("capability");
    if (capability) void fetch(`/api/report?capability=${encodeURIComponent(capability)}`).then(async (response) => { if (!response.ok) throw new Error(`Report transport returned ${response.status}`); const raw: unknown = await response.json(); if (raw) { const value = await inspectionDocument(unwrap(raw)); if (live) { acceptDocument(value); editDocument(value); } } }).catch((failure: unknown) => { if (live) setError(String(failure)); });
    return () => { live = false; };
  }, []);
  useEffect(() => { if (!ready) return; setSaved("Unsaved changes"); const timer = setTimeout(() => { void saveWorkspace({ copy, scenario }).then(() => setSaved("Saved locally")).catch(() => setSaved("Not saved · storage full or unavailable")); }, 400); return () => clearTimeout(timer); }, [copy, scenario, ready]);
  useEffect(() => {
    const latest = connection?.jobs[0];
    if (!latest || busy.current) return;
    busy.current = true;
    void (async () => {
      try {
        const controller = new AbortController(); observation.current = controller;
        const raw = await observeJob(latest, (job) => {
          if (!terminal(job)) setActive(job);
          setJobs((previous) => previous.map((item) => item.jobId === job.jobId ? job : item));
          if (job.failure) setError(`${job.failure.code}: ${job.failure.message}`);
        }, controller.signal);
        if (raw && typeof raw === "object" && "analysis" in raw) acceptDocument(await inspectionDocument(raw), latest.jobId);
      } catch (failure) { setError(String(failure)); }
      finally { busy.current = false; setActive(undefined); }
    })();
  }, [connection]);
  const analyze = useCallback(async () => {
    if (busy.current || !connection || configError) return;
    busy.current = true; setError(undefined); const inputKey = inputIdentity(copy, scenario, profileId, solverTimeMs); attempted.current = inputKey;
    try {
      const valid = parseScenario(JSON.stringify(scenario));
      const parent = document && jobs.some((job) => job.snapshotId === document.snapshot.snapshotId) ? document.snapshot.snapshotId : undefined;
      const job = await submit({ files: copy.files, scenario: valid, profileRevisionId: profileId, solverTimeMs, ...(parent ? { parentSnapshotId: parent } : {}) });
      setActive(job); setJobs((previous) => [job, ...previous]);
      const controller = new AbortController(); observation.current = controller;
      const response = await observeJob(job, (next) => {
        setActive(next); setJobs((previous) => previous.map((item) => item.jobId === next.jobId ? next : item));
        if (next.failure) setError(`${next.failure.code}: ${next.failure.message}`);
      }, controller.signal);
      if (response && typeof response === "object" && "analysis" in response) { acceptDocument(await inspectionDocument(response), job.jobId); setLastInput(inputKey); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { busy.current = false; setActive(undefined); }
  }, [connection, configError, copy, scenario, profileId, solverTimeMs, document, jobs]);
  useEffect(() => { if (!auto || !ready || active || busy.current || currentInput === lastInput || currentInput === attempted.current || !copy.files.some((file) => file.source.trim())) return; const timer = setTimeout(() => void analyze(), 700); return () => clearTimeout(timer); }, [auto, ready, active, currentInput, lastInput, analyze, copy.files]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void analyze(); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [analyze]);
  async function openSource(files: FileList) {
    try { const additions = await Promise.all(Array.from(files).map(async (file) => { if (file.size > MAX_SOURCE_BYTES) throw new Error("Source exceeds one megabyte"); return { path: file.name, source: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()) }; }));
      const existing = copy.files.filter((file) => file.source || file.path !== "untitled.py");
      const paths = new Set(existing.map((file) => file.path));
      for (const file of additions) { if (paths.has(file.path)) throw new Error(`File already exists: ${file.path}`); paths.add(file.path); }
      if (paths.size > 100) throw new Error("The workspace supports up to 100 files");
      setCopy({ ...copy, files: [...existing, ...additions] }); if (additions[0]) { setPath(additions[0].path); setSelection({ path: additions[0].path, line: 1 }); if (!scenario.entrypoint.symbol) setScenario({ ...scenario, entrypoint: { ...scenario.entrypoint, path: additions[0].path } }); } setCaptured(false);
    } catch (failure) { setError(String(failure)); }
  }
  async function openReport(file: File) { try { if (file.size > 16_777_216) throw new Error("Report exceeds 16 MiB"); const value = await inspectionDocument(JSON.parse(await file.text())); acceptDocument(value); setCaptured(true); setPath(value.scenario.entrypoint.path); setSelection({ path: value.scenario.entrypoint.path, line: 1 });  setError(undefined); } catch (failure) { setError(String(failure)); } }
  async function selectJob(job: Job) { try { const value = await request(`/api/analyses/${encodeURIComponent(job.jobId)}`); if (job.resultIds?.length) { acceptDocument(await inspectionDocument(value), job.jobId); } else setError(job.failure?.message ?? `${job.state}: no analysis result`); } catch (failure) { setError(String(failure)); } }
  function selectFinding(value: Finding) { setFindingId(value.findingId); const range = value.sourceRanges[0]; if (range) selectSource({ path: range.path, line: range.startLine, ranges: value.sourceRanges }); }
  function selectSource(value: SourceSelection) { setTabs((state) => openTab(state, value.path)); if (document && (!sourceMatches || !copy.files.some((file) => file.path === value.path))) setCaptured(true); setPath(value.path); setSelection(value); }
  function activateFile(path: string) { setTabs((state) => openTab(state, path)); setPath(path); setSelection({ path, line: 1 }); setCaptured(false); }
  function closeFile(target: string, mode: CloseMode) { const next = closeTabs(tabs, copy.files.map((file) => file.path), path, target, mode); setTabs(next.state); setCaptured(false); if (next.active) { setPath(next.active); setSelection({ path: next.active, line: 1 }); } }
  const hasEditor = captured || !tabs.closed.includes(currentFile.path);
  const editorPath = captured ? path : currentFile.path;
  const editorSource = captured && document ? decode(document, path) : currentFile.source;
  return <main className="ide" data-theme={theme}>
    <header className="ide-topbar"><span className="ide-logo" title="Pomset"><Icon name="layers" size={20} /></span><Tool icon="settings" label="Configure scenario" pressed={configuration} onClick={() => setConfiguration(!configuration)} /><Tool icon="folder" label="Open source files" onClick={() => sourceInput.current?.click()} /><Tool icon="plus" label="New file" onClick={() => { if (copy.files.length >= 100) { setError("The workspace supports up to 100 files"); return; } let index = 1; while (copy.files.some((file) => file.path === `untitled-${index}.py`)) index++; const name = `untitled-${index}.py`; setCopy({ ...copy, files: [...copy.files, { path: name, source: "" }] }); setPath(name); setSelection({ path: name, line: 1 }); setTabs((state) => openTab(state, name)); setCaptured(false); }} />
      <div className="experience-tools" role="group" aria-label="Experiences">{([{ name: "Explore", icon: "explore" }, { name: "Validate", icon: "validate" }, { name: "Optimize", icon: "chart" }] as const).map(({ name, icon }) => <Tool key={name} icon={icon} label={name} pressed={mode === name} onClick={() => setMode(name)} />)}</div>
      <div className="ide-top-actions"><Tool icon="upload" label="Open captured report" onClick={() => reportInput.current?.click()} /><Tool icon="download" label="Download current source" disabled={!hasEditor} onClick={() => downloadText(editorPath.split("/").at(-1)!, editorSource, "text/plain;charset=utf-8")} /><Tool icon="external" label="Share captured result" disabled={!document} onClick={() => setExporting(true)} /><Tool icon="history" label="Analysis history" pressed={history} onClick={() => setHistory(!history)} /><Tool icon={theme === "dark" ? "sun" : "moon"} label={theme === "dark" ? "Use light appearance" : "Use dark appearance"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} /><WorkbenchAccount source={copy.files.find((file) => file.path === scenario.entrypoint.path)?.source ?? ""} scenario={scenario} fileCount={copy.files.length} analysisId={documentJob} /></div>
    </header>
    <input hidden ref={sourceInput} type="file" multiple aria-label="Source files" onChange={(e) => { if (e.currentTarget.files) void openSource(e.currentTarget.files); e.currentTarget.value = ""; }} />
    <input hidden ref={reportInput} type="file" accept=".json" onChange={(e) => { if (e.currentTarget.files?.[0]) void openReport(e.currentTarget.files[0]); e.currentTarget.value = ""; }} />
    <input hidden ref={scenarioInput} type="file" accept=".json" onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) void file.text().then((text) => { setScenario({ ...parseScenario(text), scenarioId: `scn_${crypto.randomUUID()}` }); setConfigError(undefined); setConfiguration(true); }).catch((failure: unknown) => setError(String(failure))); e.currentTarget.value = ""; }} />
    {error && <div className="ide-error" role="alert"><Icon name="warning" size={15} /><span>{error}</span><Tool icon="close" label="Dismiss error" onClick={() => setError(undefined)} /></div>}
    <div className="ide-body">{<div className="scenario-host" hidden={!configuration}><ScenarioEditor key={scenario.scenarioId} scenario={scenario} paths={copy.files.map((file) => file.path)} onChange={setScenario} onClose={() => setConfiguration(false)} onInvalid={setConfigError} /></div>}
      <div className="ide-split" style={{ "--editor-split": `${split}%` } as CSSProperties}>
        <section className="ide-editor" aria-label="Code editor"><FileTabs paths={copy.files.map((file) => file.path)} closed={tabs.closed} active={editorPath} onSelect={activateFile} onClose={closeFile} canReopen={tabs.recent.some((path) => copy.files.some((file) => file.path === path))} onReopen={() => { const last = tabs.recent.findLast((path) => copy.files.some((file) => file.path === path)); if (last) activateFile(last); }} onImportScenario={() => scenarioInput.current?.click()} />
          {hasEditor && <div className="editor-breadcrumb"><button title="Rename file" aria-label="Rename current file" disabled={captured} onClick={() => setRenaming(true)}>{editorPath}</button>{captured ? <button onClick={() => setCaptured(false)}>Captured · return to working code</button> : <span>{stale ? "Modified" : "Working copy"}</span>}</div>}
          {hasEditor && !editorSource && <div className="ide-editor-empty"><Icon name="code" size={22} /><span>Start typing or open a source file</span></div>}
          {hasEditor ? <SourceEditor theme={theme} readOnly={captured} source={editorSource} selection={{ ...selection, path: editorPath, ...(stale && !captured ? { ranges: [] } : {}) }} onSelect={(value) => { setSelection(value); if (sourceMatches || captured) setFindingId(document?.analysis.findings?.find((item) => item.sourceRanges.some((range) => range.path === value.path && range.startLine <= value.line && range.endLine >= value.line))?.findingId); }} onChange={(source) => { try { setCopy(editWorkingFile(copy, editorPath, source)); } catch (failure) { setError(String(failure)); } }} /> : <div className="pane-empty"><Icon name="code" size={24} /><span>No open editors</span><button onClick={() => activateFile(currentFile.path)}>Reopen file</button></div>}
        </section>
        <Splitter value={split} onChange={setSplit} />
        <section className="ide-results" aria-label="Analysis results"><div className="pane-toolbar analysis-toolbar"><Icon name="cpu" size={15} /><select aria-label="Analysis profile" value={profileId} onChange={(e) => setProfileId(e.target.value)}>{connection ? <option value={connection.profile.profileRevisionId}>Triton · symbolic · Z3 {connection.profile.components.find((item) => item.name === "z3")?.version}</option> : <option value="">Read-only viewer</option>}{connection?.unavailable.map((item) => <option key={item.backend} disabled title={item.reason}>{item.backend} · unavailable</option>)}</select>
          <Tool icon={active ? "stop" : "play"} label={active ? "Cancel analysis" : "Analyze (⌘/Ctrl Enter)"} disabled={!active && (!connection || !!configError)} onClick={() => { if (active) void request(`/api/analyses/${active.jobId}/cancel`, {}).catch((failure: unknown) => setError(String(failure))); else void analyze(); }} /><label className="auto-analysis" title="Analyze after edits settle"><input type="checkbox" checked={auto} disabled={!connection} onChange={(e) => setAuto(e.target.checked)} />Auto</label></div>
          <div className="result-controls"><span>{active ? active.state : document?.job?.state ?? "No analysis"}{stale && document ? " · inputs changed" : ""}</span><label>Budget <input aria-label="Solver budget milliseconds" type="number" min={1} max={connection?.maxSolverTimeMs ?? 30000} value={solverTimeMs} onChange={(e) => setSolverTimeMs(Number(e.target.value))} /> ms</label></div>
          {document ? <EvidencePanel key={document.analysis.resultId} document={document} experience={mode} finding={finding} onFinding={selectFinding} onSource={selectSource} /> : <div className="pane-empty"><Icon name="layers" size={26} /><strong>No results yet</strong><button onClick={() => setConfiguration(true)}>Configure scenario</button>{!connection && workbenchToken() && <code>nix develop -c pnpm workbench</code>}</div>}
          {history && <aside className="ide-history" aria-label="Analysis history"><div className="pane-toolbar"><strong>History</strong><Tool icon="close" label="Close history" onClick={() => setHistory(false)} /></div>{jobs.map((job) => <button key={job.jobId} onClick={() => void selectJob(job)}><Icon name="branch" size={14} /><span>{new Date(job.createdAt).toLocaleTimeString()} · {job.state}<small>{job.snapshotId.slice(-8)}</small></span></button>)}{documents.filter((item) => !jobs.some((job) => job.jobId === item.analysis.jobId)).map((item) => <button key={item.analysis.resultId} onClick={() => { acceptDocument(item);  }}><Icon name="file" size={14} />{item.scenario.name}</button>)}</aside>}
        </section>
      </div>
    </div>
    <footer className="ide-statusbar"><Icon name="branch" size={12} /><span title={document?.snapshot.snapshotId}>{document ? document.snapshot.snapshotId.slice(-8) : "Working copy"}</span><span>{saved}</span><span className="status-spacer" /><span>{active ? `Analysis ${active.state}` : connection ? "Local symbolic" : "Report viewer"}</span><span>Ln {selection.line}</span><span>{copy.files.length} files</span></footer>
    {renaming && <RenameFile path={currentFile.path} paths={copy.files.map((file) => file.path)} onClose={() => setRenaming(false)} onRename={(next) => { const old = currentFile.path; setCopy({ ...copy, files: copy.files.map((file) => file.path === old ? { ...file, path: next } : file) }); setScenario({ ...scenario, entrypoint: { ...scenario.entrypoint, path: scenario.entrypoint.path === old ? next : scenario.entrypoint.path }, ...(scenario.reference?.path === old ? { reference: { ...scenario.reference, path: next } } : {}) }); setPath(next); setSelection({ path: next, line: 1 }); }} />}
    {exporting && document && <ReportExport document={document} onClose={() => setExporting(false)} />}
  </main>;
}
