"use client";

/** Monaco and its workers are bundled locally; no CDN or analysis service. */
import { useEffect, useRef, type JSX } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import type { SourceSelection } from "@pomset/ui";

/**
 * The workers are declared as `new Worker(new URL(…))` because that is the form
 * a bundler can see statically. This module therefore touches `self` at import
 * time and is only ever reached from the client.
 */
if (typeof self !== "undefined") self.MonacoEnvironment = { getWorker: (_moduleId, label) => label === "json" ? new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker.js", import.meta.url)) : new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url)) };
monaco.editor.defineTheme("pomset-dark", { base: "vs-dark", inherit: true, rules: [], colors: { "editor.background": "#201e24", "editor.foreground": "#e5e0e7", "editorLineNumber.foreground": "#80748a", "editor.lineHighlightBackground": "#25232a", "editor.selectionBackground": "#463753" } });
monaco.editor.defineTheme("pomset-light", { base: "vs", inherit: true, rules: [], colors: { "editor.background": "#ffffff", "editor.foreground": "#302934", "editor.selectionBackground": "#ede3f4" } });
export function SourceEditor({ theme, source, selection, onSelect, readOnly = true, onChange }: { readonly readOnly?: boolean; readonly onChange?: (source: string) => void; readonly theme: "light" | "dark"; readonly source: string; readonly selection: SourceSelection; readonly onSelect: (selection: SourceSelection) => void }): JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
  const synchronizing = useRef(false);
  const change = useRef(onChange);
  change.current = onChange;
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!container.current) return;
    const editor = monaco.editor.create(container.current, { value: source, language: selection.path.endsWith(".py") ? "python" : /\.(c|cc|cpp|cu|h|hpp)$/.test(selection.path) ? "cpp" : selection.path.endsWith(".json") ? "json" : "plaintext",
      theme: `pomset-${theme}`, readOnly, automaticLayout: true,
      minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, padding: { top: 12 },
      ariaLabel: readOnly ? "Captured source. Press Enter to select linked evidence for the current line." : "Working source editor. Edits do not change captured evidence.", });
    instance.current = editor;
    const content = editor.onDidChangeModelContent(() => { if (!readOnly && !synchronizing.current) change.current?.(editor.getValue()); });
    const cursor = editor.onDidChangeCursorPosition((event) => { if (event.source === "keyboard" || event.source === "mouse") select.current({ path: selection.path, line: event.position.lineNumber }); });
    const mouse = editor.onMouseDown((event) => { if (event.target.position) select.current({ path: selection.path, line: event.target.position.lineNumber }); });
    const keyboard = editor.onKeyDown((event) => { if (readOnly && event.keyCode === monaco.KeyCode.Enter) { event.preventDefault(); const line = editor.getPosition()?.lineNumber; if (line) select.current({ path: selection.path, line }); } });
    return () => { content.dispose(); cursor.dispose(); mouse.dispose(); keyboard.dispose(); editor.getModel()?.dispose(); editor.dispose(); instance.current = undefined; };
  }, [selection.path, readOnly]);
  useEffect(() => { monaco.editor.setTheme(`pomset-${theme}`); }, [theme]);
  useEffect(() => {
    const editor = instance.current;
    if (!editor) return;
    if (editor.getValue() !== source) { synchronizing.current = true; try { editor.setValue(source); } finally { synchronizing.current = false; } }
    if (readOnly || selection.ranges?.length) {
      editor.revealLineInCenter(selection.line);
      editor.setSelection(new monaco.Range(selection.line, 1, selection.line, 1));
    }
    const decorations = editor.createDecorationsCollection((selection.ranges ?? []).filter((range) => range.path === selection.path).map((range) => ({
      range: new monaco.Range(range.startLine, range.startColumn + 1, range.endLine, range.endColumn + 1),
      options: { isWholeLine: true, className: "evidence-source-range", overviewRuler: { color: "#c3a6e6", position: monaco.editor.OverviewRulerLane.Full } },
    })));
    return () => decorations.clear();
  }, [source, selection.line, selection.path, selection.ranges, readOnly]);
  return <div className="source-editor" ref={container} />;
}
