/**
 * The signed-in session, kept in sessionStorage under one key.
 *
 * Trade-off, stated plainly: the token is readable by any script running on
 * this origin, so a script-injection bug could copy it. The alternatives were
 * judged worse for this product. localStorage survives a closed browser and is
 * shared by every tab, which widens the window a stolen token stays useful.
 * An HttpOnly cookie would keep the token from scripts, but the workbench is a
 * static export that calls its API with a bearer header and no cookie state,
 * so it would bring cookie-based CSRF handling into an otherwise header-based
 * design. sessionStorage ends with the tab, is not shared, and never reaches
 * disk through this code. Passwords are never stored here or anywhere in the
 * browser.
 *
 * If the storage is unavailable (some private modes), the session lives in
 * memory for this page only and the user signs in again after a reload.
 */

import { parseSession, type Session } from "./account";

const KEY = "pomset.session";

type Listener = () => void;

const listeners = new Set<Listener>();
// `undefined` means "not read yet", which is what the server render sees.
let current: Session | null | undefined;

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readStored(): Session | null {
  const area = storage();
  if (!area) return null;
  try {
    const raw = area.getItem(KEY);
    if (raw === null) return null;
    return parseSession(JSON.parse(raw));
  } catch {
    // A corrupt or outdated entry is discarded rather than trusted.
    try {
      area.removeItem(KEY);
    } catch {
      // Nothing more can be done; the entry is ignored either way.
    }
    return null;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** The current session, or null when signed out. Reads storage once per page. */
export function currentSession(): Session | null {
  if (current === undefined) current = readStored();
  return current;
}

export function currentToken(): string | null {
  return currentSession()?.token ?? null;
}

export function saveSession(session: Session): void {
  current = session;
  try {
    storage()?.setItem(KEY, JSON.stringify(session));
  } catch {
    // Kept in memory for this page; see the note at the top of the file.
  }
  notify();
}

export function clearSession(): void {
  const hadSession = currentSession() !== null;
  current = null;
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nothing stored to remove.
  }
  if (hadSession) notify();
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For useSyncExternalStore: `undefined` while loading, otherwise the session or null. */
export function sessionSnapshot(): Session | null | undefined {
  return currentSession();
}

/** The server render has no storage, so it always reports the loading state. */
export function sessionServerSnapshot(): undefined {
  return undefined;
}
