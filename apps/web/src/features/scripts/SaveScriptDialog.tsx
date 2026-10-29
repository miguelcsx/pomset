"use client";

/**
 * Names a script and saves the workbench's source and scenario under that name.
 * Mounted only while open, so each time it appears the title starts from the
 * suggestion again.
 */

import { useId, useState, type FormEvent } from "react";

import { failureMessage } from "../common/http";
import type { JsonObject } from "../common/json";
import { NativeDialog } from "../ui/NativeDialog";
import { TextField } from "../ui/TextField";
import { errorText, primaryButton, secondaryButton } from "../ui/classes";
import { createScript, TITLE_MAX, type SavedScript } from "./scripts-api";

export interface SaveScriptDialogProps {
  readonly open: boolean;
  readonly suggestedTitle: string;
  /** Shown under the description, for example when only part of the workspace is kept. */
  readonly note?: string | undefined;
  readonly source: string;
  readonly scenario: JsonObject;
  readonly onSaved: (script: SavedScript) => void;
  readonly onClose: () => void;
}

export function SaveScriptDialog(props: SaveScriptDialogProps) {
  return props.open ? <Form {...props} /> : null;
}

function Form({ suggestedTitle, note, source, scenario, onSaved, onClose }: SaveScriptDialogProps) {
  const titleId = useId();
  const fieldId = useId();
  const [title, setTitle] = useState(suggestedTitle);
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0) return setFieldError("Enter a title");
    if (trimmed.length > TITLE_MAX) return setFieldError(`Use at most ${TITLE_MAX} characters`);
    setBusy(true);
    setError(undefined);
    setFieldError(undefined);
    try {
      onSaved(await createScript({ title: trimmed, source, scenario }));
    } catch (failure) {
      setError(failureMessage(failure));
      setBusy(false);
    }
  }

  return (
    <NativeDialog open labelledBy={titleId} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          Save as script
        </h2>
        <p className="text-sm text-muted">The source and the scenario are copied into your account.</p>
        {note && <p className="text-sm text-muted">{note}</p>}
        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}
        <TextField
          id={fieldId}
          label="Title"
          value={title}
          maxLength={TITLE_MAX}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
          error={fieldError}
          disabled={busy}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </NativeDialog>
  );
}
