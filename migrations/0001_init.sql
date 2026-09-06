CREATE TABLE athlete (
  id            INTEGER PRIMARY KEY,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  connected     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE activities (
  id                   INTEGER PRIMARY KEY,
  name                 TEXT    NOT NULL,
  sport_type           TEXT    NOT NULL,
  start_date           TEXT    NOT NULL,
  local_date           TEXT    NOT NULL,
  elapsed_time         INTEGER NOT NULL,
  moving_time          INTEGER NOT NULL,
  distance             REAL    NOT NULL,
  total_elevation_gain REAL,
  average_speed        REAL,
  average_heartrate    REAL,
  suffer_score         INTEGER,
  polyline             TEXT,
  raw                  TEXT    NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX activities_local_date ON activities(local_date);
CREATE INDEX activities_sport_type ON activities(sport_type);

CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
