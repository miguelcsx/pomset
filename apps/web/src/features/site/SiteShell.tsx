/**
 * The frame of every account page: the header, then the page in one column.
 * Auth pages pass `compact`, which drops the account controls they would only
 * repeat.
 */

import type { ReactNode } from "react";

import { SiteHeader } from "./SiteHeader";

export function SiteShell({ children, compact = false }: { readonly children: ReactNode; readonly compact?: boolean }) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <SiteHeader compact={compact} />
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
