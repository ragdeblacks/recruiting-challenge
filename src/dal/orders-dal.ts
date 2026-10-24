import { db } from '../db.js';

export interface OrderRow {
  id: string;
  merchant_id: string;
  customer_email: string;
  total_amount: number;
  type: 'sale' | 'refund';
  status: string;
  created_at: string;
}

/**
 * Data-access layer for orders. All order queries should go through here.
 *
 * - centralized place for query patterns
 * - the place to add auditing, caching, tenancy filters
 * - the seam for swapping the underlying store
 */
export const ordersDal = {
  listByMerchant(merchantId: string, opts: { from?: string; to?: string; limit?: number } = {}): OrderRow[] {
    const limit = opts.limit ?? 100;
    if (opts.from && opts.to) {
      // from/to are inclusive calendar days (UTC): 'to' covers up to the end
      // of that day, so the current day's orders are included.
      return db
        .prepare(
          `SELECT * FROM orders
           WHERE merchant_id = ? AND created_at >= ? AND created_at < date(?, '+1 day')
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(merchantId, opts.from, opts.to, limit) as OrderRow[];
    }
    return db
      .prepare(`SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(merchantId, limit) as OrderRow[];
  },

  /**
   * Every read is scoped to a merchant: there is deliberately no way to fetch
   * an order without saying whose it is. An id that exists but belongs to
   * another merchant returns undefined, same as a missing id.
   */
  getById(merchantId: string, id: string): OrderRow | undefined {
    return db
      .prepare(`SELECT * FROM orders WHERE merchant_id = ? AND id = ?`)
      .get(merchantId, id) as OrderRow | undefined;
  },

  create(order: Omit<OrderRow, 'created_at'>): OrderRow {
    db.prepare(
      `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(order.id, order.merchant_id, order.customer_email, order.total_amount, order.type, order.status);
    return this.getById(order.merchant_id, order.id)!;
  },

  /**
   * Dashboard summary for a merchant. All three figures are over completed
   * sales only: a refund is a reversal event, not an order a customer placed,
   * so it belongs in revenue (where it subtracts) and not in order counts or
   * the average order value.
   */
  summaryByMerchant(merchantId: string): {
    total_orders: number;
    unique_customers: number;
    avg_order_value_cents: number;
  } {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS total_orders,
                COUNT(DISTINCT customer_email) AS unique_customers,
                COALESCE(AVG(total_amount), 0) AS avg
         FROM orders
         WHERE merchant_id = ? AND status = 'completed' AND type = 'sale'`,
      )
      .get(merchantId) as { total_orders: number; unique_customers: number; avg: number };
    return {
      total_orders: row.total_orders,
      unique_customers: row.unique_customers,
      avg_order_value_cents: Math.round(row.avg),
    };
  },

  /**
   * Customers ranked by what they actually left in the business: completed
   * sales minus completed refunds. A customer who returned everything ranks
   * at the bottom, not the top. order_count counts their sales.
   */
  topCustomersByMerchant(
    merchantId: string,
    limit: number,
  ): Array<{ customer_email: string; order_count: number; net_spent_cents: number }> {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 5;
    return db
      .prepare(
        `SELECT customer_email,
                SUM(CASE WHEN type = 'sale' THEN 1 ELSE 0 END) AS order_count,
                SUM(CASE WHEN type = 'sale' THEN total_amount ELSE -total_amount END) AS net_spent_cents
         FROM orders
         WHERE merchant_id = ? AND status = 'completed'
         GROUP BY customer_email
         ORDER BY net_spent_cents DESC
         LIMIT ?`,
      )
      .all(merchantId, safeLimit) as Array<{
      customer_email: string;
      order_count: number;
      net_spent_cents: number;
    }>;
  },

  /**
   * Net revenue for a merchant: completed sales minus completed refunds.
   * This is the single definition of "revenue" in the system; any consumer that needs
   * revenue must go through here instead of summing total_amount directly.
   *
   * from/to are inclusive calendar days in UTC (YYYY-MM-DD): to='2026-10-23'
   * covers the whole 23rd, so "today" is never silently excluded.
   *
   * Rows with an unknown type are ignored (ELSE 0); the schema is expected to make
   * those impossible — see the input-validation fix.
   */
  revenueByMerchant(merchantId: string, from: string, to: string): number {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(CASE
             WHEN type = 'sale' THEN total_amount
             WHEN type = 'refund' THEN -total_amount
             ELSE 0
           END), 0) AS total
         FROM orders
         WHERE merchant_id = ? AND status = 'completed'
           AND created_at >= ? AND created_at < date(?, '+1 day')`,
      )
      .get(merchantId, from, to) as { total: number };
    return row.total;
  },
};
