/** One local service owns the store, including the queued-to-running crash window. */
import { processIdentity, type LocalStore, type ProcessIdentity } from "@pomset/storage";
export function claimWorkbench(store: LocalStore): () => void {
  const identity = processIdentity();
  if (!identity) throw new Error("Cannot identify the local workbench supervisor");
  store.db.exec("CREATE TABLE IF NOT EXISTS workbench_owner (singleton INTEGER PRIMARY KEY CHECK(singleton=1), document TEXT NOT NULL)");
  const document = JSON.stringify(identity);
  store.transaction(() => {
    const row = store.db.prepare("SELECT document FROM workbench_owner WHERE singleton=1").get();
    if (row) {
      const owner = JSON.parse(String(row["document"])) as ProcessIdentity;
      if (owner.host !== identity.host || processIdentity(owner.pid)?.started === owner.started) throw new Error("Another workbench owns this store. Use its URL or a separate data directory.");
    }
    store.db.prepare("INSERT OR REPLACE INTO workbench_owner VALUES(1,?)").run(document);
  });
  return () => { store.db.prepare("DELETE FROM workbench_owner WHERE document=?").run(document); };
}
