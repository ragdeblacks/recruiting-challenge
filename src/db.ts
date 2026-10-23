import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH ?? 'data/dashboard.db';

if (!existsSync(dirname(DB_PATH))) {
  mkdirSync(dirname(DB_PATH), { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * The orders table is the system's ledger: every financial number derives from
 * it, so the schema itself enforces what a valid entry is (STRICT + CHECKs).
 * Route-level validation gives callers good 400s; these constraints are the
 * last gate that no code path — present or future — can skip.
 */
const ORDERS_DDL = `
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      customer_email TEXT NOT NULL CHECK (customer_email LIKE '%_@_%'),
      total_amount INTEGER NOT NULL CHECK (total_amount > 0),
      type TEXT NOT NULL DEFAULT 'sale' CHECK (type IN ('sale', 'refund')),
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT`;

const ORDERS_VALID_ROW = `
      typeof(total_amount) = 'integer' AND total_amount > 0
      AND type IN ('sale', 'refund')
      AND status IN ('completed', 'pending', 'cancelled')
      AND customer_email LIKE '%_@_%'`;

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ${ORDERS_DDL};

    CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  `);
  migrateLegacyOrders();
}

/**
 * Pre-constraint databases have a loose orders table that may hold rows the
 * new schema forbids. Rebuild it under the strict DDL; rows that violate the
 * rules are moved to orders_quarantine for review instead of being dropped —
 * a weird type may be a capture error on a real sale, so we keep the evidence.
 */
function migrateLegacyOrders(): void {
  const master = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'`)
    .get() as { sql: string } | undefined;
  if (!master || master.sql.includes('STRICT')) return;

  db.exec(`
    BEGIN;
    CREATE TABLE IF NOT EXISTS orders_quarantine (
      id TEXT,
      merchant_id TEXT,
      customer_email TEXT,
      total_amount,
      type TEXT,
      status TEXT,
      created_at TEXT,
      quarantined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO orders_quarantine (id, merchant_id, customer_email, total_amount, type, status, created_at)
      SELECT id, merchant_id, customer_email, total_amount, type, status, created_at
      FROM orders WHERE NOT (${ORDERS_VALID_ROW});

    ALTER TABLE orders RENAME TO orders_legacy;
    ${ORDERS_DDL.replace('IF NOT EXISTS orders', 'orders')};
    INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
      SELECT id, merchant_id, customer_email, total_amount, type, status, created_at
      FROM orders_legacy WHERE ${ORDERS_VALID_ROW};
    DROP TABLE orders_legacy;

    CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    COMMIT;
  `);
  const q = db.prepare(`SELECT COUNT(*) AS n FROM orders_quarantine`).get() as { n: number };
  if (q.n > 0) console.log(`[migrate] orders rebuilt with constraints; ${q.n} invalid row(s) moved to orders_quarantine`);
}
