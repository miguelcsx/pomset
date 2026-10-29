"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { currentPath, nextFromLocation, readFragment } from "./navigation";

export interface BrowserLocation {
  /** The page and query, as a validated `next` value. */
  readonly path: string;
  /** The `#workbench=...` fragment, if the page was opened with one. */
  readonly fragment: string;
  /** The `next` query value of a sign-in page, if it has one. */
  readonly next: string | null;
}

const UNREAD: BrowserLocation = { path: "/", fragment: "", next: null };

/**
 * The browser's location, read after mount. Reading it during render would
 * make the server HTML and the first client render disagree whenever a
 * fragment is present, so links that depend on it wait for the effect.
 */
export function useBrowserLocation(): BrowserLocation {
  const pathname = usePathname();
  const [location, setLocation] = useState<BrowserLocation>(UNREAD);
  useEffect(() => {
    setLocation({ path: currentPath(), fragment: readFragment(), next: nextFromLocation() });
  }, [pathname]);
  return location;
}
