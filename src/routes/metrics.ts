import { Router } from 'express';
import { ordersDal } from '../dal/orders-dal.js';

export const metricsRouter = Router();

/**
 * GET /api/metrics/summary
 *
 * Dashboard summary for the authenticated merchant. Figures cover completed
 * sales only — refunds affect revenue, not order counts or averages.
 */
metricsRouter.get('/summary', (req, res) => {
  const summary = ordersDal.summaryByMerchant(req.merchantId!);
  res.json({ merchant_id: req.merchantId, ...summary });
});

/**
 * GET /api/metrics/top-customers?limit=5
 *
 * Customers ranked by net spend (completed sales minus completed refunds).
 */
metricsRouter.get('/top-customers', (req, res) => {
  const limit = Number(req.query.limit ?? 5);
  const customers = ordersDal.topCustomersByMerchant(req.merchantId!, limit);
  res.json({ customers });
});
