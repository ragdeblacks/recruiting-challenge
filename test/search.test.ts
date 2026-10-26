// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';
import { validateOrderSearch, DEFAULT_PAGE_SIZE } from '../src/lib/search-validation.js';
import type { OrderSearchFilters } from '../src/lib/search-validation.js';

const MERCHANT = 'm_search';
const defaults: OrderSearchFilters = { page: 1, pageSize: DEFAULT_PAGE_SIZE };

const insertOrder = (opts: {
  email?: string;
  amount?: number;
  type?: string;
  createdAt?: string;
  merchantId?: string;
  id?: string;
}) => {
  db.prepare(
    `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'completed', ?)`,
  ).run(
    opts.id ?? crypto.randomUUID(),
    opts.merchantId ?? MERCHANT,
    opts.email ?? 'cliente@test.com',
    opts.amount ?? 1000,
    opts.type ?? 'sale',
    opts.createdAt ?? '2026-10-10T12:00:00.000Z',
  );
};

beforeEach(() => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES (?, 'Search Test')`).run(MERCHANT);
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_search_other', 'Other')`).run();
  db.prepare(`DELETE FROM orders WHERE merchant_id IN (?, 'm_search_other')`).run(MERCHANT);
});

test('search: email is a contains match, case-insensitive', () => {
  insertOrder({ email: 'ana.garcia@tienda.com' });
  insertOrder({ email: 'bruno@tienda.com' });
  const r = ordersDal.searchByMerchant(MERCHANT, { ...defaults, email: 'GARCIA' });
  assert.equal(r.total, 1);
  assert.equal(r.orders[0]!.customer_email, 'ana.garcia@tienda.com');
});

test('search: LIKE wildcards in the input match literally, not as wildcards', () => {
  insertOrder({ email: 'ana@tienda.com' });
  insertOrder({ email: 'raro%extra@tienda.com' });
  assert.equal(ordersDal.searchByMerchant(MERCHANT, { ...defaults, email: '%' }).total, 1);
  assert.equal(ordersDal.searchByMerchant(MERCHANT, { ...defaults, email: 'a_a' }).total, 0);
});

test('search: filters combine (type + amount range + dates)', () => {
  insertOrder({ amount: 500, type: 'sale', createdAt: '2026-10-05T10:00:00.000Z' });
  insertOrder({ amount: 1500, type: 'sale', createdAt: '2026-10-10T10:00:00.000Z' });
  insertOrder({ amount: 1500, type: 'refund', createdAt: '2026-10-10T11:00:00.000Z' });
  insertOrder({ amount: 1500, type: 'sale', createdAt: '2026-10-20T10:00:00.000Z' });
  const r = ordersDal.searchByMerchant(MERCHANT, {
    ...defaults,
    type: 'sale',
    minAmount: 1000,
    maxAmount: 2000,
    from: '2026-10-08',
    to: '2026-10-15',
  });
  assert.equal(r.total, 1);
  assert.equal(r.orders[0]!.total_amount, 1500);
});

test('search: to is an inclusive calendar day (fix-5 semantics)', () => {
  insertOrder({ createdAt: '2026-10-15T23:59:59.000Z' });
  insertOrder({ createdAt: '2026-10-16T00:00:00.000Z' });
  const r = ordersDal.searchByMerchant(MERCHANT, { ...defaults, to: '2026-10-15' });
  assert.equal(r.total, 1);
});

test('search: never returns another merchant\'s orders', () => {
  insertOrder({ email: 'mio@test.com' });
  insertOrder({ email: 'ajeno@test.com', merchantId: 'm_search_other' });
  const r = ordersDal.searchByMerchant(MERCHANT, { ...defaults, email: 'test.com' });
  assert.equal(r.total, 1);
  assert.equal(r.orders[0]!.customer_email, 'mio@test.com');
});

test('search: pagination is stable — same created_at rows never repeat or skip across pages', () => {
  for (let i = 0; i < 7; i++) {
    insertOrder({ createdAt: '2026-10-10T12:00:00.000Z', amount: 100 + i });
  }
  const page1 = ordersDal.searchByMerchant(MERCHANT, { ...defaults, page: 1, pageSize: 3 });
  const page2 = ordersDal.searchByMerchant(MERCHANT, { ...defaults, page: 2, pageSize: 3 });
  const page3 = ordersDal.searchByMerchant(MERCHANT, { ...defaults, page: 3, pageSize: 3 });
  const ids = [...page1.orders, ...page2.orders, ...page3.orders].map((o) => o.id);
  assert.equal(page1.total, 7);
  assert.equal(ids.length, 7);
  assert.equal(new Set(ids).size, 7);
});

test('search: a page past the end is a valid empty result, not an error', () => {
  insertOrder({});
  const r = ordersDal.searchByMerchant(MERCHANT, { ...defaults, page: 99 });
  assert.equal(r.total, 1);
  assert.deepEqual(r.orders, []);
});

// --- Query-param validation (the 400s) ---

test('search validator: defaults apply when nothing is passed', () => {
  const r = validateOrderSearch({});
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.page, 1);
    assert.equal(r.value.pageSize, DEFAULT_PAGE_SIZE);
  }
});

test('search validator: rejects caller mistakes with named errors', () => {
  for (const query of [
    { type: 'banana' },
    { status: 'weird' },
    { from: '2026-13-99' },
    { from: 'hoy' },
    { from: '2026-10-20', to: '2026-10-01' },
    { min_amount: '5000', max_amount: '100' },
    { min_amount: '12.5' },
    { page: '0' },
    { page: 'abc' },
    { page_size: '1000' },
  ]) {
    const r = validateOrderSearch(query as Record<string, unknown>);
    assert.equal(r.ok, false, `${JSON.stringify(query)} should be rejected`);
  }
});
