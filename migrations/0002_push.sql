CREATE TABLE push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  keys       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
