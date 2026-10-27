import { Router } from 'express';
import { ordersDal } from '../dal/orders-dal.js';
import { isCalendarDay } from '../lib/search-validation.js';

export const revenueRouter = Router();

/**
 * GET /api/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns net revenue for the authenticated merchant: completed sales minus
 * completed refunds. from/to are inclusive calendar days (UTC), so a range
 * ending today includes today's orders. A refund counts against the period
 * it occurs in, not the period of the original sale, so a range with more
 * refunds than sales yields a negative number.
 */
revenueRouter.get('/', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  if (!from || !to) {
    res.status(400).json({ error: 'missing_date_range', detail: 'from and to are required (YYYY-MM-DD)' });
    return;
  }
  // A malformed date must be a 400, never a silent $0 (same contract as /search).
  if (!isCalendarDay(from) || !isCalendarDay(to) || from > to) {
    res.status(400).json({
      error: 'invalid_date_range',
      detail: 'from and to must be calendar days (YYYY-MM-DD) with from not after to',
    });
    return;
  }

  const total = ordersDal.revenueByMerchant(req.merchantId!, from, to);
  res.json({
    merchant_id: req.merchantId,
    from,
    to,
    revenue_cents: total,
    revenue: total / 100,
  });
});
