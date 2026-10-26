-- The hosted record store.
--
-- Documents are validated against the canonical contracts before they are
-- written, so these tables hold them as `jsonb` rather than restating their
-- fields: `packages/contracts` is the one schema authority (ADR-0004), and a
-- column per field would be a second answer to what a job is.

CREATE TABLE IF NOT EXISTS records (
  kind     text  NOT NULL,
  id       text  NOT NULL,
  document jsonb NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id       text  PRIMARY KEY,
  document jsonb NOT NULL
);

-- Durable and append-only, ordered per job from 1. Progress and accepted
-- evidence are never modified or retracted.
CREATE TABLE IF NOT EXISTS events (
  "jobId"  text    NOT NULL,
  sequence integer NOT NULL,
  document jsonb   NOT NULL,
  PRIMARY KEY ("jobId", sequence)
);
