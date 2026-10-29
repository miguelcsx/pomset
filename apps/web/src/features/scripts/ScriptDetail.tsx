"use client";

/**
 * One saved script: its source, its title and the analyses kept against it.
 * The id comes from the query string, so the page is a single static export
 * that serves every script and needs no server rewrite.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { usableScenario } from "../scenario/scenario-draft";
import { stageDraft } from "../workspace/workspace-persistence";
import { downloadText } from "../workspace/working-copy";
import { failureMessage } from "../common/http";
import type { Page } from "../common/page";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Pager } from "../ui/Pager";
import { TextField } from "../ui/TextField";
import {
  compactButton,
  dangerButton,
  emptyState,
  errorText,
  heading,
  lead,
  linkButton,
  outlineDangerButton,
  panel,
  primaryButton,
  secondaryButton,
  tableCell,
  tableHead,
} from "../ui/classes";
import { formatDate } from "./ScriptsPanel";
import {
  deleteResult,
  deleteScript,
  getResult,
  getScript,
  listResults,
  SCRIPTS_PAGE_SIZE,
  type SavedResultSummary,
  type SavedScript,
  TITLE_MAX,
  updateScript,
} from "./scripts-api";

export function ScriptDetail({ id }: { readonly id: string }) {
  const router = useRouter();
  const [script, setScript] = useState<SavedScript>();
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState("");
  const [renameError, setRenameError] = useState<string>();
  const [renaming, setRenaming] = useState(false);
  const [results, setResults] = useState<Page<SavedResultSummary>>();
  const [resultPage, setResultPage] = useState(1);
  const [resultsBusy, setResultsBusy] = useState(false);
  const [removingScript, setRemovingScript] = useState(false);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptError, setScriptError] = useState<string>();
  const [openError, setOpenError] = useState<string>();
  const [removingResult, setRemovingResult] = useState<SavedResultSummary>();
  const [resultBusy, setResultBusy] = useState(false);
  const [resultError, setResultError] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    getScript(id)
      .then((value) => {
        if (!live) return;
        setScript(value);
        setTitle(value.title);
      })
      .catch((failure: unknown) => {
        if (live) setError(failureMessage(failure));
      });
    return () => {
      live = false;
    };
  }, [id, version]);

  useEffect(() => {
    let live = true;
    setResultsBusy(true);
    listResults(id, resultPage, SCRIPTS_PAGE_SIZE)
      .then((value) => {
        if (live) setResults(value);
      })
      .catch((failure: unknown) => {
        if (live) setResultError(failureMessage(failure));
      })
      .finally(() => {
        if (live) setResultsBusy(false);
      });
    return () => {
      live = false;
    };
  }, [id, resultPage, version]);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = title.trim();
    if (next.length === 0) return setRenameError("Enter a title");
    if (next.length > TITLE_MAX) return setRenameError(`Use at most ${TITLE_MAX} characters`);
    setRenaming(true);
    setRenameError(undefined);
    try {
      const saved = await updateScript(id, { title: next });
      setScript(saved);
      setTitle(saved.title);
    } catch (failure) {
      setRenameError(failureMessage(failure));
    } finally {
      setRenaming(false);
    }
  }

  async function openInWorkbench() {
    const scenario = usableScenario(script?.scenario);
    if (!script || !scenario) return;
    try {
      await stageDraft(scenario.entrypoint.path, script.source, scenario);
      router.push(`/${window.location.hash}`);
    } catch (failure) {
      setOpenError(failureMessage(failure));
    }
  }

  async function removeScript() {
    setScriptBusy(true);
    setScriptError(undefined);
    try {
      await deleteScript(id);
      router.replace("/mis-scripts/");
    } catch (failure) {
      setScriptError(failureMessage(failure));
      setScriptBusy(false);
    }
  }

  async function download(summary: SavedResultSummary) {
    setResultError(undefined);
    try {
      const saved = await getResult(id, summary.id);
      downloadText(`${summary.id}.json`, JSON.stringify(saved.document, null, 2), "application/json");
    } catch (failure) {
      setResultError(failureMessage(failure));
    }
  }

  async function confirmRemoveResult() {
    if (!removingResult) return;
    setResultBusy(true);
    setRemoveError(undefined);
    try {
      await deleteResult(id, removingResult.id);
      setRemovingResult(undefined);
      setVersion((value) => value + 1);
    } catch (failure) {
      setRemoveError(failureMessage(failure));
    } finally {
      setResultBusy(false);
    }
  }

  if (error) {
    return (
      <p role="alert" className={errorText}>
        {error}
      </p>
    );
  }
  if (!script) return <p className="text-sm text-muted">Loading script…</p>;

  return (
    <div className="grid gap-8">
      <section aria-labelledby="script-title" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 id="script-title" className={heading}>
            {script.title}
          </h1>
          <p className="text-sm text-muted">Updated {formatDate(script.updatedAt)}</p>
        </div>
        <form onSubmit={rename} className={`${panel} grid gap-3 p-4 sm:max-w-md`} noValidate>
          <TextField
            id="script-rename"
            label="Title"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
            error={renameError}
            disabled={renaming}
          />
          <div>
            <button type="submit" className={primaryButton} disabled={renaming}>
              {renaming ? "Saving…" : "Save title"}
            </button>
          </div>
        </form>
        <div className={`${panel} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Source</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={!usableScenario(script.scenario)}
                onClick={() => void openInWorkbench()}
              >
                Open in workbench
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => downloadText(fileName(script.title), script.source, "text/plain;charset=utf-8")}
              >
                Download source
              </button>
              <button type="button" className={dangerButton} onClick={() => setRemovingScript(true)}>
                Delete script
              </button>
            </div>
          </div>
          {openError && (
            <p role="alert" className={`${errorText} mt-3`}>
              {openError}
            </p>
          )}
          <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-code p-3 font-mono text-xs text-ink">{script.source}</pre>
        </div>
      </section>

      <section aria-labelledby="results-title" className="grid gap-3">
        <h2 id="results-title" className="text-lg font-semibold tracking-tight text-ink">
          Saved results
        </h2>
        <p className={lead}>
          A saved result is a copy of a finished analysis. Download it and open it in the workbench with <em>Open captured report</em>.
        </p>
        {resultError && (
          <p role="alert" className={errorText}>
            {resultError}
          </p>
        )}
        {results && results.items.length === 0 && <p className={emptyState}>No results are saved yet.</p>}
        {results && results.items.length > 0 && (
          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={tableHead}>
                    Saved
                  </th>
                  <th scope="col" className={tableHead}>
                    Analysis
                  </th>
                  <th scope="col" className={tableHead}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.items.map((result) => (
                  <tr key={result.id}>
                    <td className={`${tableCell} text-muted`}>{formatDate(result.createdAt)}</td>
                    <td className={`${tableCell} font-mono text-xs`}>{result.analysisId}</td>
                    <td className={`${tableCell} text-right`}>
                      <span className="inline-flex gap-2">
                        <button type="button" className={compactButton} onClick={() => void download(result)}>
                          Download
                        </button>
                        <button type="button" className={outlineDangerButton} onClick={() => setRemovingResult(result)}>
                          Remove
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {results && results.pagination.totalPages > 1 && (
          <Pager
            page={results.pagination.page}
            totalPages={results.pagination.totalPages}
            total={results.pagination.total}
            busy={resultsBusy}
            onPage={setResultPage}
          />
        )}
        <p className="text-sm">
          <Link className={linkButton} href="/mis-scripts/">
            Back to my scripts
          </Link>
        </p>
      </section>

      <ConfirmDialog
        open={removingScript}
        title="Delete this script?"
        message="The script and all of its saved results are removed. This cannot be undone."
        confirmLabel="Delete script"
        busy={scriptBusy}
        error={scriptError}
        onConfirm={() => void removeScript()}
        onCancel={() => setRemovingScript(false)}
      />
      <ConfirmDialog
        open={removingResult !== undefined}
        title="Remove this saved result?"
        message="The copy of the analysis is removed from this script. The analysis itself is kept."
        confirmLabel="Remove result"
        busy={resultBusy}
        error={removeError}
        onConfirm={() => void confirmRemoveResult()}
        onCancel={() => setRemovingResult(undefined)}
      />
    </div>
  );
}

function fileName(title: string): string {
  const stem = title.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${stem.length > 0 ? stem : "script"}.py`;
}
