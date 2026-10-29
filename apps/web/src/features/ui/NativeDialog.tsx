"use client";

/**
 * A modal built on the platform `<dialog>`, which provides focus trapping,
 * Escape handling and the backdrop. The content mounts only while open, so a
 * form inside it starts blank every time it is shown.
 */

import { useEffect, useRef, type ReactNode } from "react";

export interface NativeDialogProps {
  readonly open: boolean;
  readonly labelledBy: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function NativeDialog({ open, labelledBy, onClose, children }: NativeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      className="w-[min(420px,calc(100vw-32px))] rounded-lg bg-surface p-5 text-ink shadow-xl"
    >
      {open ? children : null}
    </dialog>
  );
}
