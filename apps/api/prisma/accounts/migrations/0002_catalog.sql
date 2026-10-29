-- The catalog of curated examples, and the link from a saved script back to the
-- catalog item it was copied from (SQLite).
--
-- Reviewed SQL, applied once after 0001 and recorded in `PRAGMA user_version`.
-- The Prisma schema beside it is the model the client is generated from; this
-- file is what actually changes the tables, and the two must agree.

CREATE TABLE IF NOT EXISTS catalog_items (
  id              TEXT     PRIMARY KEY NOT NULL,
  title           TEXT     NOT NULL,
  summary         TEXT     NOT NULL,
  kind            TEXT     NOT NULL CHECK (kind IN ('defect', 'control')),
  source          TEXT     NOT NULL,
  scenario        TEXT     NOT NULL,
  expectedOutcome TEXT     NOT NULL,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL
);

-- A copy keeps a link to its catalog item. The link is cleared, not cascaded, when
-- the item is removed: the person's script is theirs and outlives the catalog entry.
ALTER TABLE scripts ADD COLUMN catalogItemId TEXT REFERENCES catalog_items (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scripts_catalogItemId ON scripts (catalogItemId);
