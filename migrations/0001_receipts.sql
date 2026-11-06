CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  payment_tx TEXT,
  payload TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS receipts_payment_tx
  ON receipts(payment_tx)
  WHERE payment_tx IS NOT NULL;

CREATE INDEX IF NOT EXISTS receipts_created_at
  ON receipts(created_at DESC);
