import { Router } from 'express';
import { ordersDal } from '../dal/orders-dal.js';
import { validateNewOrder } from '../lib/order-validation.js';
import { validateOrderSearch, isCalendarDay } from '../lib/search-validation.js';
import { randomUUID } from 'node:crypto';

export const ordersRouter = Router();

ordersRouter.get('/', (req, res) => {
  const errors: string[] = [];
  let limit: number | undefined;
  if (req.query.limit !== undefined) {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      errors.push('limit must be an integer between 1 and 100');
    }
  }
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  if (from !== undefined && !isCalendarDay(from)) errors.push('from must be a calendar day (YYYY-MM-DD)');
  if (to !== undefined && !isCalendarDay(to)) errors.push('to must be a calendar day (YYYY-MM-DD)');
  if (from && to && from > to) errors.push('from must not be after to');
  if (errors.length > 0) {
    res.status(400).json({ error: 'invalid_query', details: errors });
    return;
  }
  const orders = ordersDal.listByMerchant(req.merchantId!, { from, to, limit });
  res.json({ orders });
});

// Registered before '/:id' so Express doesn't treat "search" as an order id.
ordersRouter.get('/search', (req, res) => {
  const result = validateOrderSearch(req.query);
  if (!result.ok) {
    res.status(400).json({ error: 'invalid_query', details: result.errors });
    return;
  }
  const { orders, total } = ordersDal.searchByMerchant(req.merchantId!, result.value);
  res.json({ orders, total, page: result.value.page, page_size: result.value.pageSize });
});

ordersRouter.get('/:id', (req, res) => {
  // 404 (not 403) for another merchant's order: don't reveal that the id exists.
  const order = ordersDal.getById(req.merchantId!, req.params.id);
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ order });
});

ordersRouter.post('/', (req, res) => {
  const result = validateNewOrder(req.body);
  if (!result.ok) {
    res.status(400).json({ error: 'invalid_body', details: result.errors });
    return;
  }
  const order = ordersDal.create({
    id: randomUUID(),
    merchant_id: req.merchantId!,
    ...result.value,
    status: 'completed',
  });
  res.status(201).json({ order });
});
