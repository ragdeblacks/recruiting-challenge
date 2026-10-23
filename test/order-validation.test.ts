// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { validateNewOrder } from '../src/lib/order-validation.js';

// --- Route-layer validator: good 400s before the schema ever sees the data ---

test('validator: accepts a well-formed order and defaults type to sale', () => {
  const r = validateNewOrder({ customer_email: 'a@b.com', total_amount: 5000 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.type, 'sale');
});

test('validator: rejects negative, zero, decimal and NaN amounts', () => {
  for (const total_amount of [-99999, 0, 24682.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = validateNewOrder({ customer_email: 'a@b.com', total_amount });
    assert.equal(r.ok, false, `amount ${total_amount} should be rejected`);
  }
});

test('validator: rejects unknown order types', () => {
  const r = validateNewOrder({ customer_email: 'a@b.com', total_amount: 100, type: 'banana' });
  assert.equal(r.ok, false);
});

test('validator: rejects strings without email shape, keeps loose shapes', () => {
  assert.equal(validateNewOrder({ customer_email: 'not-an-email', total_amount: 100 }).ok, false);
  assert.equal(validateNewOrder({ customer_email: '<img src=x>', total_amount: 100 }).ok, false);
  // Real-world addresses that strict regexes often break on must pass:
  assert.equal(validateNewOrder({ customer_email: 'name+tag@sub.empresa.com.mx', total_amount: 100 }).ok, true);
});

test('validator: rejects a missing or non-object body', () => {
  assert.equal(validateNewOrder(undefined).ok, false);
  assert.equal(validateNewOrder('{}').ok, false);
});

// --- Schema constraints: the last gate, for code paths that skip the route ---

const rawInsert = (amount: unknown, type = 'sale', status = 'completed', email = 'a@b.com') =>
  db
    .prepare(
      `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status)
       VALUES (?, 'm_schema', ?, ?, ?, ?)`,
    )
    .run(crypto.randomUUID(), email, amount, type, status);

test('schema: the ledger itself rejects garbage, no matter who inserts', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_schema', 'Schema')`).run();

  assert.throws(() => rawInsert(-99999), /CHECK/, 'negative amount must not be storable');
  assert.throws(() => rawInsert(0), /CHECK/, 'zero amount must not be storable');
  assert.throws(() => rawInsert(24682.5), /INTEGER/, 'fractional cents must not be storable');
  assert.throws(() => rawInsert(100, 'banana'), /CHECK/, 'unknown type must not be storable');
  assert.throws(() => rawInsert(100, 'sale', 'weird'), /CHECK/, 'unknown status must not be storable');
  assert.throws(() => rawInsert(100, 'sale', 'completed', 'no-arroba'), /CHECK/, 'non-email must not be storable');

  // And a valid row still goes through:
  rawInsert(100);
});
