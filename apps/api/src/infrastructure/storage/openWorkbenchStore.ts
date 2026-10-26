/**
 * Opens the durable store one workbench owns, and releases it on close.
 *
 * Claiming the store, recovering abandoned leases and failing attempts that were
 * queued when the previous service ended are all part of opening. A second live
 * supervisor is refused rather than allowed to interleave with the first, and a
 * queued attempt that never started fails rather than staying pending forever.
 */

import { LocalStore, recoverAbandoned } from "@pomset/storage";

import { claimWorkbench } from "../workbench-owner.js";

export interface OpenWorkbenchStore {
  readonly store: LocalStore;
  close(): void;
}

export function openWorkbenchStore(directory: string): OpenWorkbenchStore {
  const store = new LocalStore(directory);
  let release: () => void = () => {};
  try {
    release = claimWorkbench(store);
    recoverAbandoned(store);
    for (const row of store.db
      .prepare("SELECT id FROM jobs WHERE json_extract(document, '$.state')='queued'")
      .all())
      store.finish(String(row["id"]), [], {
        code: "ENGINE_FAILED",
        message: "Local service ended before the queued attempt started.",
      });
  } catch (error) {
    release();
    store.close();
    throw error;
  }
  return {
    store,
    close(): void {
      release();
      store.close();
    },
  };
}
