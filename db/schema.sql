CREATE TABLE IF NOT EXISTS parks (
  id        uuid PRIMARY KEY,
  name      text NOT NULL,
  timezone  text NOT NULL DEFAULT 'America/New_York'
);

CREATE TABLE IF NOT EXISTS attractions (
  id       uuid PRIMARY KEY,
  park_id  uuid REFERENCES parks(id),
  name     text NOT NULL
);

CREATE TABLE IF NOT EXISTS wait_snapshots (
  id               bigserial PRIMARY KEY,
  attraction_id    uuid NOT NULL REFERENCES attractions(id),
  captured_at      timestamptz NOT NULL DEFAULT now(),
  status           text NOT NULL,          -- OPERATING | DOWN | REFURBISHMENT
  standby_wait_min integer                 -- null when no posted wait
);

CREATE INDEX IF NOT EXISTS idx_snapshots_attraction_time
  ON wait_snapshots (attraction_id, captured_at);
