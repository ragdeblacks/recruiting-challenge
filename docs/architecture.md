# Architecture (DRAFT — needs love)

> This file was started a while ago and hasn't been kept up to date.
> Treat as partial. Update what you change.

## Modules

- **`server.ts`** — Express bootstrapper. Wires routers to paths.
- **`db.ts`** — SQLite connection + schema init. Single shared `db` instance.
- **`auth.ts`** — request authentication. Today: trusts `X-Merchant-Id` header.
  Eventually this becomes a real signed token; the header shape is a placeholder.
- **`dal/`** — data-access layer. All order queries route through `ordersDal`:
  it is the single owner of the business rules (net revenue, tenancy scoping,
  what counts as an order) and the one place to add auditing or caching.
  No route opens its own DB connection or queries `orders` directly.
- **`routes/`** — Express routers, one file per resource.
- **`lib/`** — shared helpers. Currently: `order-validation.ts` (request-body
  validation for order creation).

## Data model

Two tables: `merchants`, `orders`. See `db.ts` for the canonical DDL.

`orders.type` is one of `'sale' | 'refund'`. A refund row records that a sale
was reversed; it does not by itself reverse the sale row.

The `orders` table is the system's ledger, and the schema enforces what a valid
entry is: `STRICT` typing plus `CHECK` constraints (positive integer amounts in
cents, type/status against their catalogs, email shape). Databases created
before these constraints are migrated on startup; rows that violate the rules
are moved to `orders_quarantine` for manual review rather than deleted.

## Open items

- ~~Wire `dashboard.tsx` once we pick a frontend framework~~ — went with static HTML+fetch instead. Doc stale.
- Decide whether `analytics-events` is its own service or a route here.
- Audit logging — TBD where it lives.
