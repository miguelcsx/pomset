"use client";

import { useSyncExternalStore } from "react";

import type { Session } from "./account";
import { sessionServerSnapshot, sessionSnapshot, subscribeSession } from "./session-store";

export type SessionState =
  | { readonly status: "loading" }
  | { readonly status: "signed-out" }
  | { readonly status: "signed-in"; readonly session: Session };

/**
 * The session as a render sees it. `loading` lasts only until the browser has
 * read storage, so a guarded page shows nothing instead of flashing a redirect.
 */
export function useSession(): SessionState {
  const value = useSyncExternalStore(subscribeSession, sessionSnapshot, sessionServerSnapshot);
  if (value === undefined) return { status: "loading" };
  if (value === null) return { status: "signed-out" };
  return { status: "signed-in", session: value };
}
