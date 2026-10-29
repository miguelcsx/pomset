/** Draft persistence is local to this browser; it never stores an authorization token. */
import type { Scenario } from "@pomset/contracts";
import type { WorkingCopy } from "./working-copy";
export interface SavedWorkspace { copy: WorkingCopy; scenario: Scenario; }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const open = indexedDB.open("pomset-workspace", 1); open.onupgradeneeded = () => open.result.createObjectStore("drafts"); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
}
/** Takes the workspace an account page staged for the workbench and clears it, so the workbench opens it once. */
export async function takeStagedWorkspace(): Promise<SavedWorkspace | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => { const transaction = db.transaction("drafts", "readwrite"); const store = transaction.objectStore("drafts"); const get = store.get("staged"); get.onsuccess = () => store.delete("staged"); transaction.oncomplete = () => { db.close(); resolve(get.result as SavedWorkspace | undefined); }; transaction.onerror = () => { db.close(); reject(transaction.error); }; });
}
/** Stages one kernel and its scenario for the workbench's next load, which opens them in place of the starter example. */
export async function stageDraft(path: string, source: string, scenario: Scenario): Promise<void> {
  await putWorkspace("staged", { copy: { id: crypto.randomUUID(), files: [{ path, source }] }, scenario });
}
export async function saveWorkspace(value: SavedWorkspace): Promise<void> {
  await putWorkspace("current", value);
}
async function putWorkspace(key: "current" | "staged", value: SavedWorkspace): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => { const transaction = db.transaction("drafts", "readwrite"); transaction.objectStore("drafts").put(value, key); transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(transaction.error); }; });
}
