"use client";

/**
 * Keeps the finished analysis on screen as a copy under one of the account's
 * scripts. The server reads the document itself; this dialog only names the
 * analysis and the script.
 */

import { useEffect, useId, useState, type FormEvent } from "react";

import { failureMessage } from "../common/http";
import { NativeDialog } from "../ui/NativeDialog";
import { errorText, field, primaryButton, secondaryButton } from "../ui/classes";
import { listScripts, saveResult, type ScriptSummary } from "./scripts-api";

export interface SaveResultDialogProps {
  readonly open: boolean;
  readonly analysisId: string;
  readonly onClose: () => void;
  readonly onSaved: (message: string) => void;
}

export function SaveResultDialog(props: SaveResultDialogProps) {
  return props.open ? <Form {...props} /> : null;
}

/** The scripts offered; the list is one page, which the API caps at 50. */
const OFFERED = 50;

function Form({ analysisId, onClose, onSaved }: SaveResultDialogProps) {
  const titleId = useId();
  const selectId = useId();
  const [scripts, setScripts] = useState<readonly ScriptSummary[]>();
  const [scriptId, setScriptId] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    listScripts(1, OFFERED)
      .then((page) => {
        if (!live) return;
        setScripts(page.items);
        setScriptId(page.items[0]?.id ?? "");
      })
      .catch((failure: unknown) => {
        if (live) setError(failureMessage(failure));
      });
    return () => {
      live = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = scripts?.find((script) => script.id === scriptId);
    if (!chosen) return;
    setBusy(true);
    setError(undefined);
    try {
      await saveResult(chosen.id, analysisId);
      onSaved(`Result saved under ${chosen.title}`);
    } catch (failure) {
      setError(failureMessage(failure));
      setBusy(false);
    }
  }

  return (
    <NativeDialog open labelledBy={titleId} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          Save result
        </h2>
        {scripts && scripts.length === 0 && (
          <p className="text-sm text-muted">Save a script first with Save as script, then keep results against it.</p>
        )}
        {scripts && scripts.length > 0 && (
          <div>
            <label htmlFor={selectId} className="block text-sm font-medium text-ink">
              Script
            </label>
            <select
              id={selectId}
              className={field}
              value={scriptId}
              onChange={(event) => setScriptId(event.target.value)}
              disabled={busy}
            >
              {scripts.map((script) => (
                <option key={script.id} value={script.id}>
                  {script.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={busy || !scripts || scripts.length === 0}>
            {busy ? "Saving…" : "Save result"}
          </button>
        </div>
      </form>
    </NativeDialog>
  );
}
