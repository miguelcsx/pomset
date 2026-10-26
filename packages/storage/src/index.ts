/**
 * Local SQLite lifecycle and filesystem content-addressed storage.
 * Hosted PostgreSQL/object storage remains an unimplemented target.
 */

/** Retention classes an artifact manifest may declare. */
export const RETENTION_CLASSES = ["job", "project", "publication", "permanent"] as const;

export type RetentionClass = (typeof RETENTION_CLASSES)[number];
export { LocalStore } from "./local.js";

export { recoverAbandoned, recordEngineProcess, processIdentity, type ProcessIdentity } from "./recovery.js";
