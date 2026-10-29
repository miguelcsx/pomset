-- Accounts, saved scripts and results, and analysis ownership (SQLite).
--
-- Reviewed SQL, applied once at startup and recorded in `PRAGMA user_version`.
-- The Prisma schema beside it is the model the client is generated from; this
-- file is what actually creates the tables, and the two must agree.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT     PRIMARY KEY NOT NULL,
  email         TEXT     NOT NULL UNIQUE,
  displayName   TEXT     NOT NULL,
  passwordHash  TEXT     NOT NULL,
  role          TEXT     NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scripts (
  id        TEXT     PRIMARY KEY NOT NULL,
  userId    TEXT     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title     TEXT     NOT NULL,
  source    TEXT     NOT NULL,
  scenario  TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS scripts_userId_updatedAt ON scripts (userId, updatedAt);

CREATE TABLE IF NOT EXISTS saved_results (
  id          TEXT     PRIMARY KEY NOT NULL,
  scriptId    TEXT     NOT NULL REFERENCES scripts (id) ON DELETE CASCADE,
  analysisId  TEXT     NOT NULL,
  job         TEXT     NOT NULL,
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (scriptId, analysisId)
);

CREATE TABLE IF NOT EXISTS analysis_owners (
  analysisId  TEXT     PRIMARY KEY NOT NULL,
  userId      TEXT     NOT NULL,
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS analysis_owners_userId ON analysis_owners (userId);
