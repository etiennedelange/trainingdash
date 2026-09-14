CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  object_type TEXT,
  object_id INTEGER,
  aspect_type TEXT,
  owner_id INTEGER,
  outcome TEXT NOT NULL,
  detail TEXT
);

CREATE INDEX webhook_events_received_at_idx ON webhook_events (received_at DESC);
