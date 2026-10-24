# API reference

> Quick-and-dirty. Not complete.

All endpoints require the `X-Merchant-Id` header.

## `GET /api/health`
No auth. Returns `{ ok: true }`.

## `GET /api/orders`
List orders for the authenticated merchant. Optional query: `from`, `to`
(inclusive calendar days, UTC, `YYYY-MM-DD`) and `limit`.

## `GET /api/orders/:id`
Get a single order by ID. Scoped to the authenticated merchant: an id that
belongs to another merchant returns `404`, indistinguishable from an id that
doesn't exist.

## `POST /api/orders`
Body: `{ customer_email, total_amount, type? }`.
- `customer_email` — must look like an email (`something@something.tld`).
- `total_amount` — positive integer, in cents. Decimals, zero, negatives and NaN are rejected.
- `type` — `sale` (default) or `refund`.

Invalid input returns `400` with `{ error: 'invalid_body', details: [...] }` naming
each problem. The same rules are enforced by the database schema (STRICT + CHECK),
so no code path can store an invalid order.

## `GET /api/revenue?from=...&to=...`
**Net** revenue for the merchant: completed sales minus completed refunds.
`from`/`to` are required and are **inclusive calendar days in UTC**
(`YYYY-MM-DD`) — a range ending today includes today's orders. A refund counts
against the period it occurs in, not the period of the original sale, so a
range can be negative. Amounts are integer cents in `revenue_cents`.

## `GET /api/metrics/summary`
Dashboard summary for the merchant, over **completed sales only** (refunds
affect revenue, not order counts or averages):
`{ merchant_id, total_orders, unique_customers, avg_order_value_cents }`.

## `GET /api/metrics/top-customers?limit=5`
Customers ranked by **net spend** (completed sales minus completed refunds):
`{ customers: [{ customer_email, order_count, net_spent_cents }] }`.
`order_count` counts sales. `limit` defaults to 5, capped at 50.
