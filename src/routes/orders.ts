import { Router } from 'express';
import { ordersDal } from '../dal/orders-dal.js';
import { validateNewOrder } from '../lib/order-validation.js';
import { randomUUID } from 'node:crypto';

export const ordersRouter = Router();

ordersRouter.get('/', (req, res) => {
  const orders = ordersDal.listByMerchant(req.merchantId!, {
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
  });
  res.json({ orders });
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
