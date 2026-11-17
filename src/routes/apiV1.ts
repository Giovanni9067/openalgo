import { Request, Response, Router } from 'express';
import { store } from '../store.js';
import { OrderAction, PriceType, ProductType } from '../types.js';

export const apiV1Router = Router();

function requireApiKey(req: Request, res: Response): boolean {
  const apikey = String(req.body?.apikey || req.query?.apikey || '').trim();
  if (!store.verifyApiKey(apikey)) {
    res.status(403).json({
      status: 'error',
      message: 'Invalid openalgo apikey',
    });
    return false;
  }
  return true;
}

function recordAnalyzer(
  apiType: string,
  reqBody: Record<string, unknown>,
  resBody: Record<string, unknown>
): void {
  const sanitizedReq = { ...reqBody };
  if ('apikey' in sanitizedReq) {
    sanitizedReq.apikey = '***';
  }
  store.logAnalyzerCall({
    api_type: apiType,
    source: String(reqBody.strategy || 'API v1'),
    symbol: reqBody.symbol ? String(reqBody.symbol) : undefined,
    exchange: reqBody.exchange ? String(reqBody.exchange) : undefined,
    action: reqBody.action ? String(reqBody.action) : undefined,
    quantity: reqBody.quantity ? Number(reqBody.quantity) : undefined,
    status: resBody.status === 'error' ? 'error' : 'success',
    request_data: sanitizedReq,
    response_data: resBody,
  });
}

// POST /api/v1/ping
apiV1Router.post('/ping', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const payload = {
    status: 'success',
    data: {
      broker: store.activeBroker,
      analyze_mode: store.analyzeMode,
      message: 'pong',
    },
  };
  recordAnalyzer('ping', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/funds
apiV1Router.post('/funds', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const payload = {
    status: 'success',
    data: store.getFunds(),
  };
  recordAnalyzer('funds', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/placeorder
apiV1Router.post('/placeorder', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const body = req.body || {};
  const result = store.placeOrder({
    symbol: String(body.symbol || ''),
    exchange: String(body.exchange || ''),
    action: String(body.action || '').toUpperCase() as OrderAction,
    quantity: Number(body.quantity),
    price: body.price !== undefined ? Number(body.price) : undefined,
    trigger_price: body.trigger_price !== undefined ? Number(body.trigger_price) : undefined,
    pricetype: (String(body.pricetype || 'MARKET').toUpperCase() as PriceType),
    product: (String(body.product || 'MIS').toUpperCase() as ProductType),
    strategy: body.strategy ? String(body.strategy) : 'API Strategy',
    disclosed_quantity: body.disclosed_quantity !== undefined ? Number(body.disclosed_quantity) : 0,
  });

  if (result.status === 'error') {
    recordAnalyzer('placeorder', body, result);
    res.status(400).json(result);
    return;
  }

  recordAnalyzer('placeorder', body, result);
  res.json(result);
});

// POST /api/v1/modifyorder
apiV1Router.post('/modifyorder', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const body = req.body || {};
  const result = store.modifyOrder(String(body.orderid || ''), {
    price: body.price !== undefined ? Number(body.price) : undefined,
    quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
    pricetype: body.pricetype ? (String(body.pricetype).toUpperCase() as PriceType) : undefined,
    trigger_price: body.trigger_price !== undefined ? Number(body.trigger_price) : undefined,
  });

  recordAnalyzer('modifyorder', body, result);
  res.status(result.status === 'error' ? 400 : 200).json(result);
});

// POST /api/v1/cancelorder
apiV1Router.post('/cancelorder', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const body = req.body || {};
  const result = store.cancelOrder(String(body.orderid || ''));
  recordAnalyzer('cancelorder', body, result);
  res.status(result.status === 'error' ? 400 : 200).json(result);
});

// POST /api/v1/cancelallorder
apiV1Router.post('/cancelallorder', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const result = store.cancelAllOrders();
  recordAnalyzer('cancelallorder', req.body || {}, result);
  res.json(result);
});

// POST /api/v1/closeposition
apiV1Router.post('/closeposition', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const result = store.closeAllPositions();
  recordAnalyzer('closeposition', req.body || {}, result);
  res.json(result);
});

// POST /api/v1/orderbook
apiV1Router.post('/orderbook', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const payload = {
    status: 'success',
    data: {
      orders: store.orders,
      statistics: store.getOrderStats(),
    },
  };
  recordAnalyzer('orderbook', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/orderstatus
apiV1Router.post('/orderstatus', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const orderid = String(req.body?.orderid || '');
  const order = store.orders.find((o) => o.orderid === orderid);
  if (!order) {
    const err = { status: 'error', message: `Order ${orderid} not found` };
    recordAnalyzer('orderstatus', req.body || {}, err);
    res.status(404).json(err);
    return;
  }
  const payload = { status: 'success', data: order };
  recordAnalyzer('orderstatus', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/tradebook
apiV1Router.post('/tradebook', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const payload = {
    status: 'success',
    data: store.trades,
  };
  recordAnalyzer('tradebook', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/positionbook
apiV1Router.post('/positionbook', (req, res) => {
  if (!requireApiKey(req, res)) return;
  store.getFunds(); // refreshes LTP & PnL
  const payload = {
    status: 'success',
    data: store.positions,
  };
  recordAnalyzer('positionbook', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/holdings
apiV1Router.post('/holdings', (req, res) => {
  if (!requireApiKey(req, res)) return;
  let totalHoldingValue = 0;
  let totalPnl = 0;
  for (const h of store.holdings) {
    const q = store.getQuote(h.exchange, h.symbol);
    h.ltp = q.ltp;
    h.pnl = Number(((h.ltp - h.average_price) * h.quantity).toFixed(2));
    h.pnlpercent = Number((((h.ltp - h.average_price) / h.average_price) * 100).toFixed(2));
    totalHoldingValue += h.ltp * h.quantity;
    totalPnl += h.pnl;
  }
  const payload = {
    status: 'success',
    data: {
      holdings: store.holdings,
      statistics: {
        totalholdingvalue: Number(totalHoldingValue.toFixed(2)),
        totalinvvalue: Number((totalHoldingValue - totalPnl).toFixed(2)),
        totalprofitandloss: Number(totalPnl.toFixed(2)),
      },
    },
  };
  recordAnalyzer('holdings', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/quotes
apiV1Router.post('/quotes', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const symbol = String(req.body?.symbol || '').trim();
  const exchange = String(req.body?.exchange || 'NSE').trim();
  if (!symbol) {
    res.status(400).json({ status: 'error', message: 'Symbol is required' });
    return;
  }
  const q = store.getQuote(exchange, symbol);
  const payload = { status: 'success', data: q };
  recordAnalyzer('quotes', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/multiquotes
apiV1Router.post('/multiquotes', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const symbols = Array.isArray(req.body?.symbols) ? req.body.symbols : [];
  const results = symbols.map((item: { symbol?: string; exchange?: string }) => ({
    symbol: String(item.symbol || '').toUpperCase(),
    exchange: String(item.exchange || 'NSE').toUpperCase(),
    data: store.getQuote(String(item.exchange || 'NSE'), String(item.symbol || 'SBIN')),
  }));
  const payload = { status: 'success', results };
  recordAnalyzer('multiquotes', req.body || {}, payload);
  res.json(payload);
});

// POST /api/v1/analyzer
apiV1Router.post('/analyzer', (req, res) => {
  if (!requireApiKey(req, res)) return;
  res.json({
    status: 'success',
    data: {
      analyze_mode: store.analyzeMode,
      mode: store.analyzeMode ? 'analyze' : 'live',
      total_logs: store.analyzerLogs.length,
    },
  });
});

// POST /api/v1/analyzer/toggle
apiV1Router.post('/analyzer/toggle', (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (typeof req.body?.mode === 'boolean') {
    store.analyzeMode = req.body.mode;
  } else {
    store.analyzeMode = !store.analyzeMode;
  }
  res.json({
    status: 'success',
    data: {
      analyze_mode: store.analyzeMode,
      mode: store.analyzeMode ? 'analyze' : 'live',
    },
  });
});

// Stub remaining unmigrated /api/v1/* endpoints cleanly with 501
apiV1Router.use((_req, res) => {
  res.status(501).json({ error: 'Not yet migrated' });
});
