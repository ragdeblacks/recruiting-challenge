// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';

const MERCHANT = 'm_metrics';

const insertOrder = (email: string, amount: number, type: 'sale' | 'refund' = 'sale') => {
  ordersDal.create({
    id: crypto.randomUUID(),
    merchant_id: MERCHANT,
    customer_email: email,
    total_amount: amount,
    type,
    status: 'completed',
  });
};

beforeEach(() => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES (?, 'Metrics Test')`).run(MERCHANT);
  db.prepare(`DELETE FROM orders WHERE merchant_id = ?`).run(MERCHANT);
});

test('summary: refunds do not count as orders nor move the average', () => {
  insertOrder('a@test.com', 1000);
  insertOrder('a@test.com', 3000);
  insertOrder('b@test.com', 50000, 'refund'); // must not touch any figure

  const s = ordersDal.summaryByMerchant(MERCHANT);
  assert.equal(s.total_orders, 2);
  assert.equal(s.unique_customers, 1);
  assert.equal(s.avg_order_value_cents, 2000);
});

test('summary: a merchant with no sales reports zeros', () => {
  const s = ordersDal.summaryByMerchant(MERCHANT);
  assert.deepEqual(s, { total_orders: 0, unique_customers: 0, avg_order_value_cents: 0 });
});

test('top customers: the customer who returned everything ranks last, not first', () => {
  insertOrder('fiel@test.com', 5000);
  insertOrder('devolvedor@test.com', 5000);
  insertOrder('devolvedor@test.com', 5000, 'refund');

  const top = ordersDal.topCustomersByMerchant(MERCHANT, 5);
  assert.equal(top[0]!.customer_email, 'fiel@test.com');
  assert.equal(top[0]!.net_spent_cents, 5000);
  assert.equal(top[1]!.customer_email, 'devolvedor@test.com');
  assert.equal(top[1]!.net_spent_cents, 0);
  assert.equal(top[1]!.order_count, 1); // the refund is not an order
});

test('top customers: limit is sanitized (NaN, negative, huge)', () => {
  insertOrder('a@test.com', 1000);
  assert.equal(ordersDal.topCustomersByMerchant(MERCHANT, Number('abc')).length, 1);
  assert.equal(ordersDal.topCustomersByMerchant(MERCHANT, -3).length, 1);
  assert.doesNotThrow(() => ordersDal.topCustomersByMerchant(MERCHANT, 999999999));
});

test('metrics never mix merchants', () => {
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_other_metrics', 'Other')`).run();
  insertOrder('a@test.com', 1000);
  ordersDal.create({
    id: crypto.randomUUID(),
    merchant_id: 'm_other_metrics',
    customer_email: 'ajeno@test.com',
    total_amount: 77777,
    type: 'sale',
    status: 'completed',
  });

  assert.equal(ordersDal.summaryByMerchant(MERCHANT).total_orders, 1);
  const top = ordersDal.topCustomersByMerchant(MERCHANT, 5);
  assert.equal(top.length, 1);
  assert.equal(top[0]!.customer_email, 'a@test.com');
});
