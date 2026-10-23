// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';

const MERCHANT = 'm_rev';
const OTHER_MERCHANT = 'm_rev_other';

const insertOrder = (opts: {
  amount: number;
  type?: string;
  status?: string;
  createdAt?: string;
  merchantId?: string;
}) => {
  db.prepare(
    `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    opts.merchantId ?? MERCHANT,
    'rev@test.com',
    opts.amount,
    opts.type ?? 'sale',
    opts.status ?? 'completed',
    opts.createdAt ?? '2026-10-10T12:00:00.000Z',
  );
};

beforeEach(() => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES (?, 'Rev Test')`).run(MERCHANT);
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES (?, 'Rev Other')`).run(OTHER_MERCHANT);
  db.prepare(`DELETE FROM orders WHERE merchant_id IN (?, ?)`).run(MERCHANT, OTHER_MERCHANT);
});

test('revenue: sales add up', () => {
  insertOrder({ amount: 1000 });
  insertOrder({ amount: 2500 });
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), 3500);
});

test('revenue: refunds subtract (net, not gross)', () => {
  insertOrder({ amount: 10000, type: 'sale' });
  insertOrder({ amount: 9000, type: 'refund' });
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), 1000);
});

test('revenue: a range with more refunds than sales is negative', () => {
  insertOrder({ amount: 1000, type: 'sale' });
  insertOrder({ amount: 4000, type: 'refund' });
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), -3000);
});

test('revenue: unknown order types cannot even enter the ledger', () => {
  // revenueByMerchant ignores unknown types (ELSE 0) as a safety net, but the
  // schema CHECK makes such rows impossible to insert in the first place.
  insertOrder({ amount: 1000, type: 'sale' });
  assert.throws(() => insertOrder({ amount: 99999, type: 'banana' }), /CHECK/);
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), 1000);
});

test('revenue: only completed orders count', () => {
  insertOrder({ amount: 1000, status: 'completed' });
  insertOrder({ amount: 5000, status: 'pending' });
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), 1000);
});

test('revenue: respects the [from, to) date range', () => {
  insertOrder({ amount: 1000, createdAt: '2026-09-30T23:59:59.000Z' });
  insertOrder({ amount: 2000, createdAt: '2026-10-15T12:00:00.000Z' });
  insertOrder({ amount: 4000, createdAt: '2026-11-01T00:00:00.000Z' });
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), 2000);
});

test('revenue: never mixes merchants', () => {
  insertOrder({ amount: 1000 });
  insertOrder({ amount: 7777, merchantId: OTHER_MERCHANT });
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), 1000);
});

test('revenue: empty range is 0, not null', () => {
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), 0);
});

test('revenue: invariant — equals sum(sales) minus sum(refunds) for random data', () => {
  let expected = 0;
  for (let i = 0; i < 200; i++) {
    const amount = Math.floor(Math.random() * 20000) + 1;
    const type = Math.random() < 0.3 ? 'refund' : 'sale';
    insertOrder({ amount, type });
    expected += type === 'sale' ? amount : -amount;
  }
  assert.equal(ordersDal.revenueByMerchant(MERCHANT, '2026-10-01', '2026-11-01'), expected);
});
