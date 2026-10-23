export interface NewOrderInput {
  customer_email: string;
  total_amount: number;
  type: 'sale' | 'refund';
}

export type OrderValidation =
  | { ok: true; value: NewOrderInput }
  | { ok: false; errors: string[] };

const ORDER_TYPES = ['sale', 'refund'] as const;

// Deliberately loose: something@something.tld. Strict email regexes reject
// real addresses; the goal here is shape, not RFC compliance.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an untrusted POST /api/orders body. The schema would reject bad
 * rows anyway (STRICT + CHECK); this layer exists so callers get a 400 that
 * names the problem instead of an opaque 500.
 */
export function validateNewOrder(body: unknown): OrderValidation {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof b.customer_email !== 'string' || !EMAIL_SHAPE.test(b.customer_email)) {
    errors.push('customer_email must be an email address');
  }
  // Number.isInteger also rejects NaN and Infinity (typeof NaN === 'number').
  if (typeof b.total_amount !== 'number' || !Number.isInteger(b.total_amount) || b.total_amount <= 0) {
    errors.push('total_amount must be a positive integer amount in cents');
  }
  if (b.type !== undefined && !ORDER_TYPES.includes(b.type as (typeof ORDER_TYPES)[number])) {
    errors.push(`type must be one of: ${ORDER_TYPES.join(', ')}`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      customer_email: b.customer_email as string,
      total_amount: b.total_amount as number,
      type: (b.type as 'sale' | 'refund' | undefined) ?? 'sale',
    },
  };
}
