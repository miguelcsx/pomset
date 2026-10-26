/** Draft persistence is local to this browser; it never stores an authorization token. */
import type { Scenario } from "@pomset/contracts";
import type { WorkingCopy } from "./working-copy";
export interface SavedWorkspace { copy: WorkingCopy; scenario: Scenario; }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const open = indexedDB.open("pomset-workspace", 1); open.onupgradeneeded = () => open.result.createObjectStore("drafts"); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
}
export async function readWorkspace(): Promise<SavedWorkspace | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => { const transaction = db.transaction("drafts", "readonly"); const get = transaction.objectStore("drafts").get("current"); get.onsuccess = () => resolve(get.result as SavedWorkspace | undefined); get.onerror = () => reject(get.error); transaction.oncomplete = () => db.close(); });
}
export async function saveWorkspace(value: SavedWorkspace): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => { const transaction = db.transaction("drafts", "readwrite"); transaction.objectStore("drafts").put(value, "current"); transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(transaction.error); }; });
}
