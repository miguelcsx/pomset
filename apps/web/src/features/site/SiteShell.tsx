"use client";

/**
 * The frame of every account page: the header, then the page in one column.
 * Auth pages pass `compact`, which drops the account controls they would only
 * repeat. The `site` wrapper carries the theme palette, so the page follows the
 * same light or dark appearance as the workbench.
 */

import type { ReactNode } from "react";

import { useTheme } from "../theme/use-theme";
import { SiteHeader } from "./SiteHeader";

export function SiteShell({ children, compact = false }: { readonly children: ReactNode; readonly compact?: boolean }) {
  const [theme, setTheme] = useTheme();
  return (
    <div className="site min-h-dvh bg-canvas text-ink" data-theme={theme}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <SiteHeader compact={compact} theme={theme} onThemeChange={setTheme} />
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
