const select = document.getElementById('merchant-select');
const totalOrdersEl = document.getElementById('total-orders');
const uniqueCustomersEl = document.getElementById('unique-customers');
const avgOrderEl = document.getElementById('avg-order');
const revenue30dEl = document.getElementById('revenue-30d');
const ordersTbody = document.getElementById('orders-tbody');
const emailInput = document.getElementById('f-email');
const typePills = document.getElementById('f-type');
const datePills = document.getElementById('f-dates');
const customDates = document.getElementById('custom-dates');
const fromInput = document.getElementById('f-from');
const toInput = document.getElementById('f-to');
const minInput = document.getElementById('f-min');
const maxInput = document.getElementById('f-max');
const chipsEl = document.getElementById('chips');
const resultCountEl = document.getElementById('result-count');
const emptyStateEl = document.getElementById('empty-state');
const pagePrev = document.getElementById('page-prev');
const pageNext = document.getElementById('page-next');
const pageLabel = document.getElementById('page-label');

const PAGE_SIZE = 10; // dashboard page size; the API supports up to 100

// Search state. Dates are UTC calendar days (API contract).
const state = { email: '', type: '', preset: 'all', from: '', to: '', min: '', max: '', page: 1 };

function api(path) {
  return fetch(path, { headers: { 'X-Merchant-Id': select.value } }).then((r) => r.json());
}

function money(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function utcDay(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400e3).toISOString().slice(0, 10);
}

function presetRange(preset) {
  if (preset === 'today') return { from: utcDay(), to: utcDay() };
  if (preset === '7d') return { from: utcDay(-6), to: utcDay() };
  if (preset === '30d') return { from: utcDay(-29), to: utcDay() };
  return { from: '', to: '' };
}

function searchParams() {
  const p = new URLSearchParams();
  if (state.email) p.set('email', state.email);
  if (state.type) p.set('type', state.type);
  const { from, to } = state.preset === 'custom' ? state : presetRange(state.preset);
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  if (state.min !== '') p.set('min_amount', Math.round(Number(state.min) * 100));
  if (state.max !== '') p.set('max_amount', Math.round(Number(state.max) * 100));
  if (state.page > 1) p.set('page', state.page);
  return p;
}

// --- URL state: filters survive a reload and can be shared ---

function syncUrl() {
  const p = searchParams();
  if (state.preset !== 'all' && state.preset !== 'custom') p.set('preset', state.preset);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function restoreFromUrl() {
  const p = new URLSearchParams(location.search);
  state.email = p.get('email') ?? '';
  state.type = p.get('type') ?? '';
  state.page = Math.max(1, Number(p.get('page')) || 1);
  state.min = p.get('min_amount') ? String(Number(p.get('min_amount')) / 100) : '';
  state.max = p.get('max_amount') ? String(Number(p.get('max_amount')) / 100) : '';
  if (p.get('preset')) {
    state.preset = p.get('preset');
  } else if (p.get('from') || p.get('to')) {
    state.preset = 'custom';
    state.from = p.get('from') ?? '';
    state.to = p.get('to') ?? '';
  }
  emailInput.value = state.email;
  minInput.value = state.min;
  maxInput.value = state.max;
  fromInput.value = state.from;
  toInput.value = state.to;
}

// --- Rendering (textContent only: API data must never execute) ---

function renderPills() {
  for (const b of typePills.querySelectorAll('.pill')) {
    b.classList.toggle('active', b.dataset.type === state.type);
  }
  for (const b of datePills.querySelectorAll('.pill')) {
    b.classList.toggle('active', b.dataset.preset === state.preset);
  }
  customDates.hidden = state.preset !== 'custom';
}

function addChip(label, onRemove) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  const text = document.createElement('span');
  text.textContent = label;
  const x = document.createElement('button');
  x.textContent = '✕';
  x.setAttribute('aria-label', `Remove filter: ${label}`);
  x.addEventListener('click', () => { onRemove(); applyFilters(); });
  chip.append(text, x);
  chipsEl.appendChild(chip);
}

function renderChips() {
  chipsEl.replaceChildren();
  const active = [];
  if (state.email) active.push([`email contains "${state.email}"`, () => { state.email = ''; emailInput.value = ''; }]);
  if (state.type) active.push([state.type === 'sale' ? 'sales only' : 'refunds only', () => { state.type = ''; }]);
  if (state.preset !== 'all') {
    const { from, to } = state.preset === 'custom' ? state : presetRange(state.preset);
    active.push([`dates: ${from || '…'} – ${to || '…'}`, () => {
      state.preset = 'all'; state.from = ''; state.to = ''; fromInput.value = ''; toInput.value = '';
    }]);
  }
  if (state.min !== '') active.push([`min ${money(Number(state.min) * 100)}`, () => { state.min = ''; minInput.value = ''; }]);
  if (state.max !== '') active.push([`max ${money(Number(state.max) * 100)}`, () => { state.max = ''; maxInput.value = ''; }]);

  for (const [label, remove] of active) addChip(label, remove);
  if (active.length > 1) {
    const clear = document.createElement('button');
    clear.className = 'chip';
    clear.textContent = 'Clear all';
    clear.addEventListener('click', clearAllFilters);
    chipsEl.appendChild(clear);
  }
}

function renderOrders(res) {
  ordersTbody.replaceChildren();
  const orders = res.orders ?? [];
  for (const o of orders) {
    const tr = document.createElement('tr');
    for (const value of [
      new Date(o.created_at).toLocaleDateString(),
      o.customer_email,
      o.type,
      money(o.total_amount),
    ]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    }
    ordersTbody.appendChild(tr);
  }

  const total = res.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  emptyStateEl.hidden = total !== 0;
  resultCountEl.textContent = res.error
    ? `Invalid filters: ${(res.details ?? []).join('; ')}`
    : `${total} order${total === 1 ? '' : 's'} found`;
  pageLabel.textContent = `Page ${state.page} of ${totalPages}`;
  pagePrev.disabled = state.page <= 1;
  pageNext.disabled = state.page >= totalPages;
}

async function runSearch() {
  const p = searchParams();
  p.set('page', state.page);
  p.set('page_size', PAGE_SIZE);
  renderPills();
  renderChips();
  syncUrl();
  renderOrders(await api(`/api/orders/search?${p.toString()}`));
}

function applyFilters() {
  state.page = 1;
  runSearch();
}

function clearAllFilters() {
  Object.assign(state, { email: '', type: '', preset: 'all', from: '', to: '', min: '', max: '', page: 1 });
  emailInput.value = minInput.value = maxInput.value = fromInput.value = toInput.value = '';
  runSearch();
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// --- Summary cards (unchanged behavior) ---

async function refreshSummary() {
  const summary = await api('/api/metrics/summary');
  totalOrdersEl.textContent = summary.total_orders ?? '—';
  uniqueCustomersEl.textContent = summary.unique_customers ?? '—';
  avgOrderEl.textContent = money(summary.avg_order_value_cents ?? 0);
  const revenue = await api(`/api/revenue?from=${utcDay(-29)}&to=${utcDay()}`);
  revenue30dEl.textContent = money(revenue.revenue_cents ?? 0);
}

// --- Wiring ---

emailInput.addEventListener('input', debounce(() => { state.email = emailInput.value.trim(); applyFilters(); }, 300));
minInput.addEventListener('input', debounce(() => { state.min = minInput.value; applyFilters(); }, 300));
maxInput.addEventListener('input', debounce(() => { state.max = maxInput.value; applyFilters(); }, 300));
fromInput.addEventListener('change', () => { state.from = fromInput.value; applyFilters(); });
toInput.addEventListener('change', () => { state.to = toInput.value; applyFilters(); });
typePills.addEventListener('click', (e) => {
  const pill = e.target.closest('.pill');
  if (pill) { state.type = pill.dataset.type; applyFilters(); }
});
datePills.addEventListener('click', (e) => {
  const pill = e.target.closest('.pill');
  if (pill) { state.preset = pill.dataset.preset; applyFilters(); }
});
document.getElementById('empty-clear').addEventListener('click', clearAllFilters);
pagePrev.addEventListener('click', () => { state.page -= 1; runSearch(); });
pageNext.addEventListener('click', () => { state.page += 1; runSearch(); });
select.addEventListener('change', () => { state.page = 1; refreshSummary(); runSearch(); });

restoreFromUrl();
refreshSummary();
runSearch();
