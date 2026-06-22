export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL CHECK(direction IN ('TO_SERVER', 'TO_ASPEL')),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('PRODUCT', 'STOCK', 'SALE')),
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','DONE','FAILED')),
  attempts INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_entity ON sync_queue(entity_id, direction);

CREATE TABLE IF NOT EXISTS local_inventory (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  price REAL,
  category TEXT,
  visibility TEXT DEFAULT 'ACTIVE',
  aspel_raw TEXT,
  livecomerce_id TEXT,
  last_synced_at INTEGER,
  last_aspel_at INTEGER,
  last_online_at INTEGER
);

CREATE TABLE IF NOT EXISTS agent_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_map (
  sku TEXT PRIMARY KEY,
  livecomerce_uuid TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL CHECK(origin IN (
    'ONBOARDING',
    'ASPEL_NEW',
    'LIVE_NEW'
  )),
  created_at INTEGER NOT NULL,
  synced_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_identity_uuid ON identity_map(livecomerce_uuid);

CREATE TABLE IF NOT EXISTS sku_sequence (
  category TEXT PRIMARY KEY,
  last_seq INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO sku_sequence (category, last_seq) VALUES
  ('ROP', 0),
  ('COS', 0),
  ('ACC', 0),
  ('HOG', 0),
  ('GEN', 0);
`;

export const PRAGMAS = [
  'PRAGMA journal_mode = WAL;',
  'PRAGMA foreign_keys = ON;',
  'PRAGMA synchronous = NORMAL;'
];
