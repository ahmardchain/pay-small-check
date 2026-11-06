export interface StoredReceipt {
  id: string;
  createdAt: string;
  channel: "x" | "instagram";
  handle: string;
  status: "complete" | "failed";
  dryRun: boolean;
  verdict: "safe" | "caution" | "risky" | null;
  summary: string;
  signals: unknown[];
  evidence: unknown[];
  partial: boolean;
  warnings: string[];
  userPayment: {
    rail: "x402" | "transfer" | "dry-run";
    asset: string | null;
    symbol: string | null;
    amount: string | null;
    txHash: string | null;
    payTo: string | null;
    attribution: "erc8021" | "payto-address" | "not-applicable";
    attributionCodes: string[];
  };
  buyCalls: unknown[];
  paymentTx: string | null;
}

export interface ReceiptStore {
  put(receipt: StoredReceipt): Promise<void>;
  get(id: string): Promise<StoredReceipt | null>;
  list(limit: number): Promise<StoredReceipt[]>;
  hasPaymentTx(txHash: string): Promise<boolean>;
  /**
   * Reserve a payment before any paid buy call runs. Returns false when the
   * payment is already reserved, so concurrent replays cannot each spend.
   */
  claimPayment(key: string): Promise<boolean>;
  /** Give a reservation back when the check charged nothing, so the buyer can retry. */
  releasePayment(key: string): Promise<void>;
}

export function memoryStore(): ReceiptStore {
  const rows = new Map<string, StoredReceipt>();
  const claims = new Set<string>();
  return {
    async put(receipt) {
      if (receipt.paymentTx) {
        const existing = [...rows.values()].find(
          (row) => row.paymentTx?.toLowerCase() === receipt.paymentTx?.toLowerCase() && row.id !== receipt.id,
        );
        if (existing) throw new Error("payment_tx_used");
      }
      rows.set(receipt.id, receipt);
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async list(limit) {
      return [...rows.values()]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, limit);
    },
    async hasPaymentTx(txHash) {
      const needle = txHash.toLowerCase();
      return [...rows.values()].some((row) => row.paymentTx?.toLowerCase() === needle);
    },
    async claimPayment(key) {
      const needle = key.toLowerCase();
      if (claims.has(needle)) return false;
      claims.add(needle);
      return true;
    },
    async releasePayment(key) {
      claims.delete(key.toLowerCase());
    },
  };
}

interface D1Like {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } } | unknown>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

export function d1Store(db: D1Like): ReceiptStore {
  return {
    async put(receipt) {
      await db
        .prepare(
          `INSERT INTO receipts (id, created_at, payment_tx, payload)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             payload = excluded.payload,
             payment_tx = excluded.payment_tx`,
        )
        .bind(receipt.id, receipt.createdAt, receipt.paymentTx, JSON.stringify(receipt))
        .run();
    },
    async get(id) {
      const row = await db.prepare(`SELECT payload FROM receipts WHERE id = ?`).bind(id).first<{ payload: string }>();
      return row ? (JSON.parse(row.payload) as StoredReceipt) : null;
    },
    async list(limit) {
      const result = await db
        .prepare(`SELECT payload FROM receipts ORDER BY created_at DESC LIMIT ?`)
        .bind(limit)
        .all<{ payload: string }>();
      return result.results.map((row) => JSON.parse(row.payload) as StoredReceipt);
    },
    async hasPaymentTx(txHash) {
      const row = await db
        .prepare(`SELECT id FROM receipts WHERE lower(payment_tx) = ?`)
        .bind(txHash.toLowerCase())
        .first<{ id: string }>();
      return Boolean(row);
    },
    async claimPayment(key) {
      // The primary key makes this atomic: only one concurrent request inserts.
      const result = (await db
        .prepare(`INSERT OR IGNORE INTO payment_claims (key, created_at) VALUES (?, ?)`)
        .bind(key.toLowerCase(), new Date().toISOString())
        .run()) as { meta?: { changes?: number } };
      return (result?.meta?.changes ?? 0) === 1;
    },
    async releasePayment(key) {
      await db.prepare(`DELETE FROM payment_claims WHERE key = ?`).bind(key.toLowerCase()).run();
    },
  };
}

export function publicReceipt(receipt: StoredReceipt) {
  const { paymentTx: _hidden, ...rest } = receipt;
  return rest;
}
