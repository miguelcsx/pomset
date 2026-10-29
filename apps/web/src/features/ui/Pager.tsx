"use client";

import { secondaryButton } from "./classes";

export interface PagerProps {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly busy: boolean;
  readonly onPage: (page: number) => void;
}

export function Pager({ page, totalPages, total, busy, onPage }: PagerProps) {
  const noun = total === 1 ? "item" : "items";
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <span>
        {total} {noun} · Page {page} of {Math.max(totalPages, 1)}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          onClick={() => onPage(page - 1)}
          disabled={busy || page <= 1}
        >
          Previous
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => onPage(page + 1)}
          disabled={busy || page >= totalPages}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
