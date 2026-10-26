export interface OrderSearchFilters {
  email?: string;
  type?: 'sale' | 'refund';
  status?: 'completed' | 'pending' | 'cancelled';
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  page: number;
  pageSize: number;
}

export type SearchValidation =
  | { ok: true; value: OrderSearchFilters }
  | { ok: false; errors: string[] };

const ORDER_TYPES = ['sale', 'refund'] as const;
const ORDER_STATUSES = ['completed', 'pending', 'cancelled'] as const;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// A calendar day must both match the shape and be a real date ('2026-13-99' is not).
function isCalendarDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parsePositiveInt(raw: unknown, name: string, max: number, fallback: number, errors: string[]): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    errors.push(`${name} must be an integer between 1 and ${max}`);
    return fallback;
  }
  return n;
}

/**
 * Validates GET /api/orders/search query params. Caller mistakes (bad enum,
 * malformed date, min > max, bad page) are 400s with a message naming the
 * problem — never a 500, and never silently reinterpreted.
 */
export function validateOrderSearch(query: Record<string, unknown>): SearchValidation {
  const errors: string[] = [];
  const value: OrderSearchFilters = {
    page: parsePositiveInt(query.page, 'page', Number.MAX_SAFE_INTEGER, 1, errors),
    pageSize: parsePositiveInt(query.page_size, 'page_size', MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE, errors),
  };

  if (query.email !== undefined) {
    if (typeof query.email !== 'string' || query.email.trim() === '' || query.email.length > 200) {
      errors.push('email must be a non-empty string (max 200 chars)');
    } else {
      value.email = query.email.trim();
    }
  }
  if (query.type !== undefined) {
    if (!ORDER_TYPES.includes(query.type as (typeof ORDER_TYPES)[number])) {
      errors.push(`type must be one of: ${ORDER_TYPES.join(', ')}`);
    } else {
      value.type = query.type as OrderSearchFilters['type'];
    }
  }
  if (query.status !== undefined) {
    if (!ORDER_STATUSES.includes(query.status as (typeof ORDER_STATUSES)[number])) {
      errors.push(`status must be one of: ${ORDER_STATUSES.join(', ')}`);
    } else {
      value.status = query.status as OrderSearchFilters['status'];
    }
  }
  for (const name of ['from', 'to'] as const) {
    const raw = query[name];
    if (raw === undefined) continue;
    if (typeof raw !== 'string' || !isCalendarDay(raw)) {
      errors.push(`${name} must be a calendar day (YYYY-MM-DD)`);
    } else {
      value[name] = raw;
    }
  }
  if (value.from && value.to && value.from > value.to) {
    errors.push('from must not be after to');
  }
  for (const [param, key] of [['min_amount', 'minAmount'], ['max_amount', 'maxAmount']] as const) {
    const raw = query[param];
    if (raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      errors.push(`${param} must be a non-negative integer amount in cents`);
    } else {
      value[key] = n;
    }
  }
  if (value.minAmount !== undefined && value.maxAmount !== undefined && value.minAmount > value.maxAmount) {
    errors.push('min_amount must not be greater than max_amount');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}
