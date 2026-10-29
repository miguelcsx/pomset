"use client";

/**
 * A confirmation that names the thing being removed and says what happens.
 * It is a dialog, not `window.confirm`, so it can carry a busy state and an
 * error from the request it guards.
 */

import { useId } from "react";

import { NativeDialog } from "./NativeDialog";
import { dangerButton, errorText, secondaryButton } from "./classes";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <NativeDialog open={props.open} labelledBy={titleId} onClose={props.onCancel}>
      <h2 id={titleId} className="text-base font-semibold">
        {props.title}
      </h2>
      <p className="mt-2 text-sm text-muted">{props.message}</p>
      {props.error && (
        <p role="alert" className={`${errorText} mt-3`}>
          {props.error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={props.onCancel} disabled={props.busy}>
          Cancel
        </button>
        <button type="button" className={dangerButton} onClick={props.onConfirm} disabled={props.busy}>
          {props.busy ? "Working…" : props.confirmLabel}
        </button>
      </div>
    </NativeDialog>
  );
}
