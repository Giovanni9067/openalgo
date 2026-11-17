import { Router } from 'express';
import { BROKER_PLUGINS } from '../brokers.js';
import { store } from '../store.js';
import { OrderAction, PriceType, ProductType } from '../types.js';

export const webRouter = Router();

function sharedLocals(page: string, title: string) {
  return {
    page,
    title,
    user: store.user,
    activeBroker: store.activeBroker,
    activeBrokerInfo: store.getBroker(store.activeBroker),
    analyzeMode: store.analyzeMode,
    orderMode: store.orderMode,
    pendingCount: store.pendingOrders.filter((p) => p.status === 'pending').length,
  };
}

// Dashboard & Home
webRouter.get(['/', '/dashboard'], (req, res) => {
  const funds = store.getFunds();
  const orderStats = store.getOrderStats();
  const sampleQuotes = [
    store.getQuote('NSE', 'SBIN'),
    store.getQuote('NSE', 'RELIANCE'),
    store.getQuote('NSE', 'TCS'),
    store.getQuote('NSE_INDEX', 'NIFTY'),
  ];
  res.render('dashboard', {
    ...sharedLocals('dashboard', 'Dashboard — OpenAlgo'),
    funds,
    orderStats,
    recentOrders: store.orders.slice(0, 6),
    positions: store.positions.filter((p) => p.quantity !== 0),
    sampleQuotes,
    flash: req.query.msg ? String(req.query.msg) : null,
    flashType: req.query.err ? 'error' : 'success',
  });
});

// Quick order submission from Dashboard
webRouter.post('/orders/quick', (req, res) => {
  const result = store.placeOrder({
    symbol: String(req.body.symbol || ''),
    exchange: String(req.body.exchange || 'NSE'),
    action: String(req.body.action || 'BUY').toUpperCase() as OrderAction,
    quantity: Number(req.body.quantity || 1),
    price: req.body.price ? Number(req.body.price) : undefined,
    pricetype: String(req.body.pricetype || 'MARKET').toUpperCase() as PriceType,
    product: String(req.body.product || 'MIS').toUpperCase() as ProductType,
    strategy: String(req.body.strategy || 'Dashboard'),
  });

  if (result.status === 'error') {
    res.redirect(`/dashboard?err=1&msg=${encodeURIComponent(result.message || 'Order failed')}`);
    return;
  }
  const msg = result.queued
    ? `Order queued in Action Center (${result.pendingId})`
    : `Order placed: ${result.orderid}`;
  res.redirect(`/dashboard?msg=${encodeURIComponent(msg)}`);
});

// Orderbook
webRouter.get('/orderbook', (req, res) => {
  res.render('orderbook', {
    ...sharedLocals('orderbook', 'Orderbook — OpenAlgo'),
    orders: store.orders,
    orderStats: store.getOrderStats(),
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.post('/orderbook/cancel/:orderid', (req, res) => {
  const result = store.cancelOrder(req.params.orderid);
  const msg = result.status === 'success' ? `Cancelled ${req.params.orderid}` : result.message || 'Cancel failed';
  res.redirect(`/orderbook?msg=${encodeURIComponent(msg)}`);
});

webRouter.get('/orderbook/export', (_req, res) => {
  const headers = ['Trading Symbol', 'Exchange', 'Transaction Type', 'Quantity', 'Price', 'Trigger Price', 'Order Type', 'Product Type', 'Order ID', 'Status', 'Time'];
  const rows = store.orders.map((o) => [
    o.symbol,
    o.exchange,
    o.action,
    o.quantity,
    o.price,
    o.trigger_price,
    o.pricetype,
    o.product,
    o.orderid,
    o.order_status,
    o.timestamp,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=orderbook.csv');
  res.send(csv);
});

// Tradebook
webRouter.get('/tradebook', (_req, res) => {
  res.render('tradebook', {
    ...sharedLocals('tradebook', 'Tradebook — OpenAlgo'),
    trades: store.trades,
  });
});

webRouter.get('/tradebook/export', (_req, res) => {
  const headers = ['Trading Symbol', 'Exchange', 'Product Type', 'Transaction Type', 'Fill Size', 'Fill Price', 'Trade Value', 'Order ID', 'Fill Time'];
  const rows = store.trades.map((t) => [
    t.symbol,
    t.exchange,
    t.product,
    t.action,
    t.quantity,
    t.average_price,
    t.trade_value,
    t.orderid,
    t.timestamp,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=tradebook.csv');
  res.send(csv);
});

// Positions
webRouter.get('/positions', (req, res) => {
  const funds = store.getFunds();
  res.render('positions', {
    ...sharedLocals('positions', 'Positions — OpenAlgo'),
    positions: store.positions,
    funds,
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.post('/positions/close', (_req, res) => {
  const result = store.closeAllPositions();
  res.redirect(`/positions?msg=${encodeURIComponent(`Closed ${result.count} open position(s)`)}`);
});

webRouter.get('/positions/export', (_req, res) => {
  store.getFunds();
  const headers = ['Symbol', 'Exchange', 'Product Type', 'Net Qty', 'Avg Price', 'LTP', 'P&L'];
  const rows = store.positions.map((p) => [p.symbol, p.exchange, p.product, p.quantity, p.average_price, p.ltp, p.pnl]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=positions.csv');
  res.send(csv);
});

// Holdings
webRouter.get('/holdings', (_req, res) => {
  let totalValue = 0;
  let totalPnl = 0;
  for (const h of store.holdings) {
    const q = store.getQuote(h.exchange, h.symbol);
    h.ltp = q.ltp;
    h.pnl = Number(((h.ltp - h.average_price) * h.quantity).toFixed(2));
    h.pnlpercent = Number((((h.ltp - h.average_price) / h.average_price) * 100).toFixed(2));
    totalValue += h.ltp * h.quantity;
    totalPnl += h.pnl;
  }
  res.render('holdings', {
    ...sharedLocals('holdings', 'Holdings — OpenAlgo'),
    holdings: store.holdings,
    totalValue: totalValue.toFixed(2),
    totalPnl: totalPnl.toFixed(2),
  });
});

// Action Center (Semi-Auto Queue)
webRouter.get('/action-center', (req, res) => {
  res.render('action_center', {
    ...sharedLocals('action-center', 'Action Center — OpenAlgo'),
    pendingOrders: store.pendingOrders,
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.post('/action-center/approve/:id', (req, res) => {
  const result = store.approvePendingOrder(req.params.id);
  const msg = result.status === 'success' ? `Approved and executed order ${result.orderid}` : result.message || 'Approval failed';
  res.redirect(`/action-center?msg=${encodeURIComponent(msg)}`);
});

webRouter.post('/action-center/reject/:id', (req, res) => {
  const result = store.rejectPendingOrder(req.params.id);
  res.redirect(`/action-center?msg=${encodeURIComponent(result.message)}`);
});

// Brokers
webRouter.get(['/broker', '/broker/config'], (req, res) => {
  const filter = String(req.query.q || '').trim().toLowerCase();
  const typeFilter = String(req.query.type || 'all');
  const filtered = BROKER_PLUGINS.filter((b) => {
    const matchesQuery =
      !filter ||
      b.name.toLowerCase().includes(filter) ||
      b.id.toLowerCase().includes(filter) ||
      b.exchanges.some((e) => e.toLowerCase().includes(filter));
    const matchesType = typeFilter === 'all' || b.type === typeFilter;
    return matchesQuery && matchesType;
  });

  res.render('brokers', {
    ...sharedLocals('broker', 'Broker Plugins — OpenAlgo'),
    brokers: filtered,
    totalCount: BROKER_PLUGINS.length,
    filter,
    typeFilter,
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.get('/api/broker/list', (_req, res) => {
  res.json({
    status: 'success',
    active: store.activeBroker,
    brokers: BROKER_PLUGINS.map((b) => ({
      ...b,
      active: b.id === store.activeBroker,
    })),
  });
});

webRouter.post('/api/broker/select', (req, res) => {
  const brokerId = String(req.body.broker || '').trim().toLowerCase();
  const broker = store.getBroker(brokerId);
  if (!broker) {
    if (req.accepts('json') && !req.is('application/x-www-form-urlencoded')) {
      res.status(400).json({ status: 'error', message: 'Unknown broker plugin' });
      return;
    }
    res.redirect('/broker?msg=Unknown+broker');
    return;
  }
  store.activeBroker = broker.id;
  if (req.is('application/json')) {
    res.json({ status: 'success', active: broker.id, name: broker.name });
    return;
  }
  res.redirect(`/broker?msg=${encodeURIComponent(`Switched active broker to ${broker.name}`)}`);
});

// API Key management
webRouter.get('/apikey', (req, res) => {
  if (req.headers.accept === 'application/json') {
    res.json({
      login_username: store.user.username,
      has_api_key: true,
      api_key: store.apiKey,
      order_mode: store.orderMode,
    });
    return;
  }
  res.render('apikey', {
    ...sharedLocals('apikey', 'API Key — OpenAlgo'),
    apiKey: store.apiKey,
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.post('/apikey', (req, res) => {
  const newKey = store.regenerateApiKey();
  if (req.is('application/json')) {
    res.json({ message: 'API key updated successfully.', api_key: newKey });
    return;
  }
  res.redirect('/apikey?msg=API+key+regenerated');
});

webRouter.post('/apikey/mode', (req, res) => {
  const mode = String(req.body.mode || '');
  if (mode !== 'auto' && mode !== 'semi_auto') {
    res.status(400).json({ error: 'Invalid mode. Must be "auto" or "semi_auto"' });
    return;
  }
  store.orderMode = mode;
  if (req.is('application/json')) {
    res.json({ message: `Order mode updated to ${mode}`, mode });
    return;
  }
  res.redirect(`/apikey?msg=${encodeURIComponent(`Order mode updated to ${mode}`)}`);
});

// Sandbox Config
webRouter.get('/sandbox', (req, res) => {
  const configs = Array.from(store.sandboxConfigs.entries()).map(([key, item]) => ({
    key,
    ...item,
  }));
  res.render('sandbox', {
    ...sharedLocals('sandbox', 'Sandbox Configuration — OpenAlgo'),
    configs,
    funds: store.getFunds(),
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.post('/sandbox/config', (req, res) => {
  for (const [key, val] of Object.entries(req.body || {})) {
    const existing = store.sandboxConfigs.get(key);
    if (existing && typeof val === 'string') {
      existing.value = val.trim();
    }
  }
  res.redirect('/sandbox?msg=Sandbox+configuration+saved');
});

webRouter.post('/sandbox/reset', (_req, res) => {
  store.resetSandbox();
  res.redirect('/sandbox?msg=Sandbox+capital+and+books+reset');
});

// Analyzer & Mode Toggle
webRouter.get('/analyzer', (req, res) => {
  res.render('analyzer', {
    ...sharedLocals('analyzer', 'API Analyzer — OpenAlgo'),
    logs: store.analyzerLogs,
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.get('/settings/analyze-mode', (_req, res) => {
  res.json({ analyze_mode: store.analyzeMode });
});

webRouter.post('/settings/analyze-mode/:mode', (req, res) => {
  const mode = req.params.mode === '1' || req.params.mode === 'true';
  store.analyzeMode = mode;
  if (req.is('application/json') || req.headers.accept?.includes('application/json')) {
    res.json({
      success: true,
      analyze_mode: store.analyzeMode,
      message: `Switched to ${store.analyzeMode ? 'Analyze' : 'Live'} Mode`,
    });
    return;
  }
  res.redirect(req.get('referer') || '/analyzer');
});

// API Playground
webRouter.get('/playground', (_req, res) => {
  res.render('playground', {
    ...sharedLocals('playground', 'API Playground — OpenAlgo'),
    apiKey: store.apiKey,
  });
});

// Flow Visual Automation
webRouter.get('/flow', (req, res) => {
  res.render('flow', {
    ...sharedLocals('flow', 'Flow Automation — OpenAlgo'),
    workflows: store.workflows,
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.get('/flow/api/workflows', (_req, res) => {
  res.json(store.workflows);
});

webRouter.post('/flow/api/workflows', (req, res) => {
  const name = String(req.body.name || 'Untitled Workflow');
  const description = String(req.body.description || '');
  const triggerType = (req.body.trigger_type || 'webhook') as 'webhook' | 'schedule' | 'price_alert';
  const wf = store.createWorkflow(name, description, triggerType);
  if (req.is('application/json')) {
    res.json(wf);
    return;
  }
  res.redirect(`/flow?msg=${encodeURIComponent(`Created workflow "${wf.name}"`)}`);
});

webRouter.post('/flow/api/workflows/:id/toggle', (req, res) => {
  const wf = store.toggleWorkflow(Number(req.params.id));
  if (!wf) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  if (req.is('application/json')) {
    res.json(wf);
    return;
  }
  res.redirect(`/flow?msg=${encodeURIComponent(`${wf.name} is now ${wf.is_active ? 'active' : 'paused'}`)}`);
});

webRouter.post('/flow/api/workflows/:id/trigger', (req, res) => {
  const wf = store.triggerWorkflow(Number(req.params.id));
  if (!wf) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  if (req.is('application/json')) {
    res.json({ status: 'success', workflow: wf });
    return;
  }
  res.redirect(`/flow?msg=${encodeURIComponent(`Triggered workflow "${wf.name}"`)}`);
});

// Auth pages
webRouter.get('/login', (req, res) => {
  res.render('auth', {
    ...sharedLocals('login', 'Sign In — OpenAlgo'),
    mode: 'login',
    flash: req.query.msg ? String(req.query.msg) : null,
  });
});

webRouter.post('/auth/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  if (username) {
    store.user.username = username;
    store.user.loggedIn = true;
  }
  res.redirect('/dashboard?msg=Signed+in+to+OpenAlgo');
});

webRouter.get('/setup', (_req, res) => {
  res.render('auth', {
    ...sharedLocals('setup', 'Admin Setup — OpenAlgo'),
    mode: 'setup',
    flash: null,
  });
});

webRouter.post('/setup', (req, res) => {
  const username = String(req.body.username || 'trader').trim();
  const email = String(req.body.email || 'trader@openalgo.local').trim();
  store.user.username = username;
  store.user.email = email;
  store.user.loggedIn = true;
  res.redirect('/dashboard?msg=Admin+account+configured');
});

webRouter.post('/auth/logout', (_req, res) => {
  store.user.loggedIn = false;
  res.redirect('/login?msg=Signed+out');
});

// Health checks
webRouter.get(['/health', '/api/health'], (_req, res) => {
  res.json({
    status: 'healthy',
    runtime: 'nodejs',
    broker: store.activeBroker,
    analyze_mode: store.analyzeMode,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// Stub remaining unmigrated routes from original Python app
const UNMIGRATED_PREFIXES = [
  '/historify',
  '/chartink',
  '/python',
  '/agent',
  '/strategy',
  '/strategybuilder',
  '/volsurface',
  '/gex',
  '/optionchain',
  '/ivchart',
  '/oitracker',
  '/maxpain',
  '/straddle',
  '/straddlepnl',
  '/scalping',
  '/trading',
  '/telegram',
  '/whatsapp',
  '/alerts',
  '/admin',
  '/logs',
  '/traffic',
  '/latency',
  '/gammadensity',
  '/strikeprofile',
  '/ivsmile',
  '/oiprofile',
  '/arbitrage',
];

for (const prefix of UNMIGRATED_PREFIXES) {
  webRouter.use(prefix, (_req, res) => {
    res.status(501).json({ error: 'Not yet migrated' });
  });
}
