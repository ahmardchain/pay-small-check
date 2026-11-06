-- One row per buyer payment that has started a check. Inserted before any
-- paid buy call, so a replayed transfer hash or x402 authorization cannot
-- trigger a second round of spending.
CREATE TABLE IF NOT EXISTS payment_claims (
  key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
