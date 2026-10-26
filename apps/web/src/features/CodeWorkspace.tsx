/** Editor-first working files; no result is inferred from an edit or a compiler artifact. */
import { Icon, type SourceSelection } from "@pomset/ui";
import { Suspense, lazy, useState } from "react";
import { downloadText, editWorkingFile, MAX_SOURCE_BYTES, type WorkingCopy } from "./workspace/working-copy";

const SourceEditor = lazy(() => import("./editor/SourceEditor").then((module) => ({ default: module.SourceEditor })));
export function CodeWorkspace({ copy, theme, onChange, onReturn }: {
  readonly copy: WorkingCopy; readonly theme: "light" | "dark"; readonly onChange: (copy: WorkingCopy) => void; readonly onReturn?: () => void;
}): JSX.Element {
  const [path, setPath] = useState(copy.files[0]?.path ?? "");
  const [selection, setSelection] = useState<SourceSelection>({ path, line: 1 });
  const [error, setError] = useState<string>();
  const current = copy.files.find((file) => file.path === path);
  async function openFiles(files: FileList) {
    setError(undefined);
    try {
      const additions = await Promise.all(Array.from(files).map(async (file) => {
        if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name} exceeds the source byte limit.`);
        return { path: file.name, source: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()) };
      }));
      if (copy.files.length + additions.length > 100) throw new Error("This working copy supports up to 100 files.");
      const paths = new Set(copy.files.map((file) => file.path));
      for (const file of additions) { if (paths.has(file.path)) throw new Error(`File already exists: ${file.path}. Rename the file before importing it.`); paths.add(file.path); }
      onChange({ ...copy, files: [...copy.files, ...additions] });
      if (!current && additions[0]) setPath(additions[0].path);
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  }
  function newFile() {
    if (copy.files.length >= 100) { setError("This working copy supports up to 100 files."); return; }
    const name = `untitled-${crypto.randomUUID().slice(0, 8)}.py`;
    onChange({ ...copy, files: [...copy.files, { path: name, source: "" }] }); setPath(name);
  }
  return <section className="code-workspace" aria-label="Interactive code workspace">
    <div className="workspace-heading"><div><span className="section-label">Working copy · Not analyzed</span><h1>Explore your code.</h1></div><div className="workspace-meta">{onReturn && <button className="quiet-button" onClick={onReturn}><Icon name="branch" size={16} />Return to captured evidence</button>}<label className="open-source"><Icon name="folder" size={16} />Open code<input type="file" multiple accept=".py,.cu,.c,.cpp,.cc,.h,.hpp,.json,.txt" aria-label="Open source files" onChange={(event) => { if (event.currentTarget.files) void openFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label><button className="quiet-button" onClick={newFile}><Icon name="plus" size={16} />New file</button></div></div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="draft-grid"><div className="draft-editor">
      <div className="file-tabs" aria-label="Working files">{copy.files.map((file) => <button key={file.path} aria-pressed={file.path === path} onClick={() => { setPath(file.path); setSelection({ path: file.path, line: 1 }); }}><Icon name="file" size={15} />{file.path}</button>)}</div>
      {current && !current.source && <div className="empty-editor-hint">Paste a kernel or start typing.<br /><span>Open code to work with existing files.</span></div>}
      {current ? <Suspense fallback={<p role="status">Opening editor…</p>}><SourceEditor readOnly={false} theme={theme} source={current.source} selection={{ ...selection, path }} onSelect={setSelection} onChange={(source) => {
        try { onChange(editWorkingFile(copy, path, source)); setError(undefined); } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
      }} /></Suspense> : <div className="start-code"><Icon name="code" size={34} /><h2>Start with code, not setup.</h2><p>Open one or several source files, or create a file and start typing.</p><button onClick={newFile}><Icon name="plus" size={16} />Create a file</button></div>}
      <div className="editor-status"><span>Working files · Browser session</span><span>No execution or upload</span></div>
    </div><aside className="draft-inspector"><div className="panel-heading"><span className="section-label">Analysis</span><Icon name="layers" size={17} /></div><h2>Define the question.</h2><p>Declare the entrypoint, allocations, launch and input domain before analyzing. Different profiles produce separate evidence.</p>
      <button disabled aria-describedby="analysis-unavailable">Analyze working copy</button>
      <div className="unavailable-state" id="analysis-unavailable"><Icon name="cpu" size={28} /><h3>Browser analysis is not implemented</h3><p>The editor works locally in this session. Scenario submission and hosted analysis still need implementation.</p></div>
      {copy.baseSnapshotId && <div className="stale-evidence"><Icon name="branch" size={16} /><p>Previous evidence belongs to snapshot <code>{copy.baseSnapshotId}</code>. It does not validate these working files.</p></div>}
      <details><summary>Analyze with the local CLI</summary><p>Save your working files and declare a scenario. Run locally, then open the new report here.</p><code>pomset analyze --scenario scenario.json --report report.json</code></details>
      {current && <button className="download-source" onClick={() => downloadText(current.path.split("/").at(-1) ?? "source.txt", current.source, "text/plain;charset=utf-8")}><Icon name="external" size={16} />Download current source</button>}
    </aside></div>
  </section>;
}
