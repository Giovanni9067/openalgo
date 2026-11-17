import crypto from 'node:crypto';
import { BROKER_PLUGINS } from './brokers.js';
import {
  AnalyzerLogRecord,
  BrokerPlugin,
  FlowWorkflow,
  FundsData,
  HoldingRecord,
  OrderAction,
  OrderMode,
  OrderRecord,
  PendingOrderRecord,
  PositionRecord,
  PriceType,
  ProductType,
  QuoteData,
  SandboxConfigItem,
  TradeRecord,
} from './types.js';

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function generateHexKey(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function nextOrderId(): string {
  return `OA${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;
}

// Seeded quotes map keyed by `${exchange}:${symbol}`
const quotesStore = new Map<string, QuoteData>([
  [
    'NSE:SBIN',
    {
      symbol: 'SBIN',
      exchange: 'NSE',
      ltp: 842.5,
      open: 835.0,
      high: 846.8,
      low: 832.15,
      prev_close: 834.9,
      volume: 12485320,
      bid: 842.4,
      ask: 842.55,
      oi: 0,
      timestamp: nowTimestamp(),
    },
  ],
  [
    'NSE:RELIANCE',
    {
      symbol: 'RELIANCE',
      exchange: 'NSE',
      ltp: 1284.75,
      open: 1278.0,
      high: 1291.4,
      low: 1274.2,
      prev_close: 1276.5,
      volume: 8942100,
      bid: 1284.6,
      ask: 1284.85,
      oi: 0,
      timestamp: nowTimestamp(),
    },
  ],
  [
    'NSE:TCS',
    {
      symbol: 'TCS',
      exchange: 'NSE',
      ltp: 4118.3,
      open: 4095.0,
      high: 4135.0,
      low: 4088.5,
      prev_close: 4092.1,
      volume: 2154900,
      bid: 4118.0,
      ask: 4118.6,
      oi: 0,
      timestamp: nowTimestamp(),
    },
  ],
  [
    'NSE:INFY',
    {
      symbol: 'INFY',
      exchange: 'NSE',
      ltp: 1864.2,
      open: 1850.0,
      high: 1872.0,
      low: 1846.4,
      prev_close: 1849.8,
      volume: 5421800,
      bid: 1864.0,
      ask: 1864.35,
      oi: 0,
      timestamp: nowTimestamp(),
    },
  ],
  [
    'NSE:NHPC',
    {
      symbol: 'NHPC',
      exchange: 'NSE',
      ltp: 86.45,
      open: 85.9,
      high: 87.2,
      low: 85.4,
      prev_close: 85.85,
      volume: 18340200,
      bid: 86.4,
      ask: 86.5,
      oi: 0,
      timestamp: nowTimestamp(),
    },
  ],
  [
    'NSE_INDEX:NIFTY',
    {
      symbol: 'NIFTY',
      exchange: 'NSE_INDEX',
      ltp: 24385.6,
      open: 24310.0,
      high: 24420.5,
      low: 24275.0,
      prev_close: 24298.4,
      volume: 0,
      bid: 24385.6,
      ask: 24385.6,
      oi: 0,
      timestamp: nowTimestamp(),
    },
  ],
  [
    'NSE_INDEX:BANKNIFTY',
    {
      symbol: 'BANKNIFTY',
      exchange: 'NSE_INDEX',
      ltp: 52140.25,
      open: 51980.0,
      high: 52265.0,
      low: 51890.0,
      prev_close: 51955.8,
      volume: 0,
      bid: 52140.25,
      ask: 52140.25,
      oi: 0,
      timestamp: nowTimestamp(),
    },
  ],
  [
    'CRYPTO:BTCUSD',
    {
      symbol: 'BTCUSD',
      exchange: 'CRYPTO',
      ltp: 91450.0,
      open: 90200.0,
      high: 92100.0,
      low: 89850.0,
      prev_close: 90150.0,
      volume: 42510,
      bid: 91448.0,
      ask: 91452.0,
      oi: 184200,
      timestamp: nowTimestamp(),
    },
  ],
]);

// State object
class OpenAlgoStore {
  public user = {
    username: 'trader',
    email: 'trader@openalgo.local',
    isAdmin: true,
    loggedIn: true,
  };

  public apiKey: string = generateHexKey(32);
  public orderMode: OrderMode = 'auto';
  public analyzeMode: boolean = true;
  public activeBroker: string = 'dhan_sandbox';

  public sandboxConfigs = new Map<string, SandboxConfigItem>([
    ['starting_capital', { value: '10000000.00', description: 'Starting sandbox capital in INR', category: 'capital' }],
    ['reset_day', { value: 'Never', description: 'Day of week for automatic fund reset', category: 'capital' }],
    ['reset_time', { value: '00:00', description: 'Time for automatic fund reset (IST)', category: 'capital' }],
    ['equity_mis_leverage', { value: '5', description: 'Leverage multiplier for equity MIS', category: 'leverage' }],
    ['equity_cnc_leverage', { value: '1', description: 'Leverage multiplier for equity CNC', category: 'leverage' }],
    ['futures_leverage', { value: '10', description: 'Leverage multiplier for futures', category: 'leverage' }],
    ['option_buy_leverage', { value: '1', description: 'Leverage for buying options', category: 'leverage' }],
    ['option_sell_leverage', { value: '1', description: 'Leverage for selling options', category: 'leverage' }],
    ['nse_bse_square_off_time', { value: '15:15', description: 'Square-off time for NSE/BSE MIS', category: 'square_off' }],
    ['cds_bcd_square_off_time', { value: '16:45', description: 'Square-off time for CDS/BCD MIS', category: 'square_off' }],
    ['mcx_square_off_time', { value: '23:30', description: 'Square-off time for MCX MIS', category: 'square_off' }],
    ['ncdex_square_off_time', { value: '17:00', description: 'Square-off time for NCDEX MIS', category: 'square_off' }],
    ['order_check_interval', { value: '5', description: 'Interval to check pending orders (1-30 sec)', category: 'intervals' }],
    ['mtm_update_interval', { value: '5', description: 'Interval to update MTM P&L (1-30 sec)', category: 'intervals' }],
  ]);

  public cashBalance = 9954625.0;
  public collateral = 0.0;
  public realisedM2M = 1245.5;

  public orders: OrderRecord[] = [
    {
      orderid: 'OA261116001',
      symbol: 'SBIN',
      exchange: 'NSE',
      action: 'BUY',
      quantity: 50,
      price: 838.4,
      trigger_price: 0,
      pricetype: 'MARKET',
      product: 'MIS',
      order_status: 'complete',
      timestamp: nowTimestamp(),
      strategy: 'ORB Breakout',
      disclosed_quantity: 0,
    },
    {
      orderid: 'OA261116002',
      symbol: 'RELIANCE',
      exchange: 'NSE',
      action: 'BUY',
      quantity: 20,
      price: 1280.5,
      trigger_price: 0,
      pricetype: 'LIMIT',
      product: 'CNC',
      order_status: 'complete',
      timestamp: nowTimestamp(),
      strategy: 'Swing Alpha',
      disclosed_quantity: 0,
    },
    {
      orderid: 'OA261116003',
      symbol: 'TCS',
      exchange: 'NSE',
      action: 'SELL',
      quantity: 5,
      price: 4145.0,
      trigger_price: 0,
      pricetype: 'LIMIT',
      product: 'MIS',
      order_status: 'open',
      timestamp: nowTimestamp(),
      strategy: 'Mean Reversion',
      disclosed_quantity: 0,
    },
  ];

  public trades: TradeRecord[] = [
    {
      orderid: 'OA261116001',
      symbol: 'SBIN',
      exchange: 'NSE',
      product: 'MIS',
      action: 'BUY',
      quantity: 50,
      average_price: 838.4,
      trade_value: 41920.0,
      timestamp: nowTimestamp(),
    },
    {
      orderid: 'OA261116002',
      symbol: 'RELIANCE',
      exchange: 'NSE',
      product: 'CNC',
      action: 'BUY',
      quantity: 20,
      average_price: 1280.5,
      trade_value: 25610.0,
      timestamp: nowTimestamp(),
    },
  ];

  public positions: PositionRecord[] = [
    {
      symbol: 'SBIN',
      exchange: 'NSE',
      product: 'MIS',
      quantity: 50,
      average_price: 838.4,
      ltp: 842.5,
      pnl: 205.0,
    },
    {
      symbol: 'RELIANCE',
      exchange: 'NSE',
      product: 'CNC',
      quantity: 20,
      average_price: 1280.5,
      ltp: 1284.75,
      pnl: 85.0,
    },
  ];

  public holdings: HoldingRecord[] = [
    {
      symbol: 'INFY',
      exchange: 'NSE',
      quantity: 40,
      average_price: 1790.0,
      ltp: 1864.2,
      pnl: 2968.0,
      pnlpercent: 4.15,
    },
    {
      symbol: 'NHPC',
      exchange: 'NSE',
      quantity: 500,
      average_price: 82.1,
      ltp: 86.45,
      pnl: 2175.0,
      pnlpercent: 5.3,
    },
  ];

  public pendingOrders: PendingOrderRecord[] = [];
  public analyzerLogs: AnalyzerLogRecord[] = [];

  public workflows: FlowWorkflow[] = [
    {
      id: 1,
      name: 'TradingView EMA Crossover',
      description: 'Receives TradingView webhook alerts and routes validated MIS orders to active broker.',
      trigger_type: 'webhook',
      is_active: true,
      webhook_enabled: true,
      webhook_token: generateHexKey(12),
      last_execution_status: 'success',
      last_run_at: nowTimestamp(),
      nodes_count: 5,
      updated_at: nowTimestamp(),
    },
    {
      id: 2,
      name: 'NIFTY 09:20 Short Straddle Guard',
      description: 'Checks market open volatility at 09:20 IST and logs signal into Analyzer.',
      trigger_type: 'schedule',
      is_active: false,
      webhook_enabled: false,
      webhook_token: generateHexKey(12),
      last_execution_status: 'idle',
      last_run_at: null,
      nodes_count: 7,
      updated_at: nowTimestamp(),
    },
  ];

  private nextWorkflowId = 3;

  public getBroker(id: string): BrokerPlugin | undefined {
    return BROKER_PLUGINS.find((b) => b.id === id.toLowerCase());
  }

  public getQuote(exchange: string, symbol: string): QuoteData {
    const exch = exchange.toUpperCase();
    const sym = symbol.toUpperCase();
    const key = `${exch}:${sym}`;
    const existing = quotesStore.get(key);
    if (existing) {
      // Subtle realistic tick jitter on LTP
      const delta = (Math.random() - 0.5) * existing.ltp * 0.0008;
      const ltp = Number((existing.ltp + delta).toFixed(2));
      const updated: QuoteData = {
        ...existing,
        ltp,
        bid: Number((ltp - 0.05).toFixed(2)),
        ask: Number((ltp + 0.05).toFixed(2)),
        timestamp: nowTimestamp(),
      };
      quotesStore.set(key, updated);
      return updated;
    }

    // Generate deterministic base price for unknown symbols so any symbol works in Sandbox
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) % 3500;
    }
    const base = Math.max(45, hash + 50);
    const created: QuoteData = {
      symbol: sym,
      exchange: exch,
      ltp: base,
      open: Number((base * 0.992).toFixed(2)),
      high: Number((base * 1.012).toFixed(2)),
      low: Number((base * 0.986).toFixed(2)),
      prev_close: Number((base * 0.995).toFixed(2)),
      volume: 254000,
      bid: Number((base - 0.1).toFixed(2)),
      ask: Number((base + 0.1).toFixed(2)),
      oi: exch === 'NFO' || exch === 'CRYPTO' ? 45000 : 0,
      timestamp: nowTimestamp(),
    };
    quotesStore.set(key, created);
    return created;
  }

  public getFunds(): FundsData {
    let unrealized = 0;
    let utilised = 0;

    for (const pos of this.positions) {
      const q = this.getQuote(pos.exchange, pos.symbol);
      pos.ltp = q.ltp;
      pos.pnl = Number(((q.ltp - pos.average_price) * pos.quantity).toFixed(2));
      unrealized += pos.pnl;
      if (pos.quantity !== 0) {
        const leverage = pos.product === 'MIS' ? 5 : 1;
        utilised += (Math.abs(pos.quantity) * pos.average_price) / leverage;
      }
    }

    return {
      availablecash: this.cashBalance.toFixed(2),
      collateral: this.collateral.toFixed(2),
      m2munrealized: unrealized.toFixed(2),
      m2mrealized: this.realisedM2M.toFixed(2),
      utiliseddebits: utilised.toFixed(2),
    };
  }

  public getOrderStats() {
    const stats = {
      total_buy_orders: 0,
      total_sell_orders: 0,
      total_completed_orders: 0,
      total_open_orders: 0,
      total_rejected_orders: 0,
    };
    for (const o of this.orders) {
      if (o.action === 'BUY') stats.total_buy_orders++;
      if (o.action === 'SELL') stats.total_sell_orders++;
      if (o.order_status === 'complete') stats.total_completed_orders++;
      else if (o.order_status === 'open') stats.total_open_orders++;
      else if (o.order_status === 'rejected') stats.total_rejected_orders++;
    }
    return stats;
  }

  public verifyApiKey(key?: string): boolean {
    if (!key) return false;
    return key === this.apiKey;
  }

  public regenerateApiKey(): string {
    this.apiKey = generateHexKey(32);
    return this.apiKey;
  }

  public logAnalyzerCall(entry: Omit<AnalyzerLogRecord, 'id' | 'timestamp'>): void {
    this.analyzerLogs.unshift({
      id: generateHexKey(6),
      timestamp: nowTimestamp(),
      ...entry,
    });
    if (this.analyzerLogs.length > 200) {
      this.analyzerLogs.length = 200;
    }
  }

  public placeOrder(input: {
    symbol: string;
    exchange: string;
    action: OrderAction;
    quantity: number;
    price?: number;
    trigger_price?: number;
    pricetype?: PriceType;
    product?: ProductType;
    strategy?: string;
    disclosed_quantity?: number;
    bypassSemiAuto?: boolean;
  }): { status: 'success' | 'error'; orderid?: string; queued?: boolean; pendingId?: string; message?: string } {
    const symbol = input.symbol.trim().toUpperCase();
    const exchange = input.exchange.trim().toUpperCase();
    const action = input.action;
    const quantity = Number(input.quantity);
    const pricetype: PriceType = input.pricetype || 'MARKET';
    const product: ProductType = input.product || 'MIS';
    const strategy = (input.strategy || 'Manual').trim();
    const trigger_price = Number(input.trigger_price || 0);
    const disclosed_quantity = Number(input.disclosed_quantity || 0);

    if (!symbol || !exchange || !['BUY', 'SELL'].includes(action) || !Number.isFinite(quantity) || quantity <= 0) {
      return { status: 'error', message: 'Invalid order parameters (symbol, exchange, action, positive quantity required).' };
    }

    const quote = this.getQuote(exchange, symbol);
    const execPrice = pricetype === 'MARKET' || !input.price || Number(input.price) <= 0 ? quote.ltp : Number(input.price);

    // Semi-auto Action Center queuing
    if (this.orderMode === 'semi_auto' && !input.bypassSemiAuto) {
      const pendingId = `PEND-${Date.now().toString().slice(-6)}`;
      this.pendingOrders.unshift({
        id: pendingId,
        api_type: 'placeorder',
        symbol,
        exchange,
        action,
        quantity,
        price: execPrice,
        pricetype,
        product,
        strategy,
        status: 'pending',
        created_at: nowTimestamp(),
        payload: { ...input },
      });
      return {
        status: 'success',
        queued: true,
        pendingId,
        orderid: pendingId,
        message: 'Order queued in Action Center (semi_auto mode)',
      };
    }

    const orderid = nextOrderId();
    const isImmediateFill = pricetype === 'MARKET' || (action === 'BUY' && execPrice >= quote.ltp) || (action === 'SELL' && execPrice <= quote.ltp);
    const orderStatus = isImmediateFill ? 'complete' : 'open';

    const order: OrderRecord = {
      orderid,
      symbol,
      exchange,
      action,
      quantity,
      price: Number(execPrice.toFixed(2)),
      trigger_price,
      pricetype,
      product,
      order_status: orderStatus,
      timestamp: nowTimestamp(),
      strategy,
      disclosed_quantity,
    };

    this.orders.unshift(order);

    if (isImmediateFill) {
      const fillPrice = pricetype === 'MARKET' ? quote.ltp : Number(execPrice.toFixed(2));
      const tradeValue = Number((fillPrice * quantity).toFixed(2));
      this.trades.unshift({
        orderid,
        symbol,
        exchange,
        product,
        action,
        quantity,
        average_price: fillPrice,
        trade_value: tradeValue,
        timestamp: nowTimestamp(),
      });

      this.applyFillToPositions(symbol, exchange, product, action, quantity, fillPrice);
    }

    return { status: 'success', orderid };
  }

  private applyFillToPositions(
    symbol: string,
    exchange: string,
    product: ProductType,
    action: OrderAction,
    quantity: number,
    fillPrice: number
  ): void {
    const signedQty = action === 'BUY' ? quantity : -quantity;
    const existing = this.positions.find(
      (p) => p.symbol === symbol && p.exchange === exchange && p.product === product
    );

    const leverage = product === 'MIS' ? Number(this.sandboxConfigs.get('equity_mis_leverage')?.value || 5) : 1;
    const marginDelta = (fillPrice * quantity) / leverage;

    if (!existing) {
      this.positions.unshift({
        symbol,
        exchange,
        product,
        quantity: signedQty,
        average_price: fillPrice,
        ltp: fillPrice,
        pnl: 0,
      });
      this.cashBalance = Math.max(0, this.cashBalance - marginDelta);
      return;
    }

    const oldQty = existing.quantity;
    const newQty = oldQty + signedQty;

    // Closing or reducing existing position realizes PnL
    if ((oldQty > 0 && signedQty < 0) || (oldQty < 0 && signedQty > 0)) {
      const closedQty = Math.min(Math.abs(oldQty), Math.abs(signedQty));
      const direction = oldQty > 0 ? 1 : -1;
      const realized = (fillPrice - existing.average_price) * closedQty * direction;
      this.realisedM2M += realized;
      this.cashBalance += (existing.average_price * closedQty) / leverage + realized;
    } else {
      this.cashBalance = Math.max(0, this.cashBalance - marginDelta);
    }

    if (newQty === 0) {
      existing.quantity = 0;
      existing.pnl = 0;
    } else if ((oldQty >= 0 && newQty > 0) || (oldQty <= 0 && newQty < 0)) {
      if (Math.abs(newQty) > Math.abs(oldQty)) {
        const totalCost = Math.abs(oldQty) * existing.average_price + Math.abs(signedQty) * fillPrice;
        existing.average_price = Number((totalCost / Math.abs(newQty)).toFixed(2));
      }
      existing.quantity = newQty;
    } else {
      // Flipped direction
      existing.quantity = newQty;
      existing.average_price = fillPrice;
    }
    existing.ltp = fillPrice;
    existing.pnl = Number(((existing.ltp - existing.average_price) * existing.quantity).toFixed(2));
  }

  public modifyOrder(orderid: string, updates: { price?: number; quantity?: number; pricetype?: PriceType; trigger_price?: number }) {
    const order = this.orders.find((o) => o.orderid === orderid);
    if (!order) {
      return { status: 'error' as const, message: `Order ${orderid} not found` };
    }
    if (order.order_status !== 'open') {
      return { status: 'error' as const, message: `Cannot modify order in '${order.order_status}' state` };
    }
    if (updates.price !== undefined) order.price = Number(updates.price);
    if (updates.quantity !== undefined && Number(updates.quantity) > 0) order.quantity = Number(updates.quantity);
    if (updates.pricetype) order.pricetype = updates.pricetype;
    if (updates.trigger_price !== undefined) order.trigger_price = Number(updates.trigger_price);
    order.timestamp = nowTimestamp();
    return { status: 'success' as const, orderid };
  }

  public cancelOrder(orderid: string) {
    const order = this.orders.find((o) => o.orderid === orderid);
    if (!order) {
      return { status: 'error' as const, message: `Order ${orderid} not found` };
    }
    if (order.order_status !== 'open') {
      return { status: 'error' as const, message: `Order ${orderid} is already ${order.order_status}` };
    }
    order.order_status = 'cancelled';
    order.timestamp = nowTimestamp();
    return { status: 'success' as const, orderid };
  }

  public cancelAllOrders() {
    const cancelled: string[] = [];
    for (const order of this.orders) {
      if (order.order_status === 'open') {
        order.order_status = 'cancelled';
        order.timestamp = nowTimestamp();
        cancelled.push(order.orderid);
      }
    }
    return { status: 'success' as const, canceled_orders: cancelled, count: cancelled.length };
  }

  public closeAllPositions() {
    const closed: string[] = [];
    for (const pos of [...this.positions]) {
      if (pos.quantity !== 0) {
        const action: OrderAction = pos.quantity > 0 ? 'SELL' : 'BUY';
        const res = this.placeOrder({
          symbol: pos.symbol,
          exchange: pos.exchange,
          action,
          quantity: Math.abs(pos.quantity),
          pricetype: 'MARKET',
          product: pos.product,
          strategy: 'ClosePosition',
          bypassSemiAuto: true,
        });
        if (res.orderid) closed.push(res.orderid);
      }
    }
    return { status: 'success' as const, closed_orders: closed, count: closed.length };
  }

  public approvePendingOrder(id: string) {
    const item = this.pendingOrders.find((p) => p.id === id);
    if (!item || item.status !== 'pending') {
      return { status: 'error' as const, message: 'Pending order not found or already processed' };
    }
    item.status = 'approved';
    return this.placeOrder({
      symbol: item.symbol,
      exchange: item.exchange,
      action: item.action,
      quantity: item.quantity,
      price: item.price,
      pricetype: item.pricetype,
      product: item.product,
      strategy: item.strategy,
      bypassSemiAuto: true,
    });
  }

  public rejectPendingOrder(id: string) {
    const item = this.pendingOrders.find((p) => p.id === id);
    if (!item || item.status !== 'pending') {
      return { status: 'error' as const, message: 'Pending order not found or already processed' };
    }
    item.status = 'rejected';
    return { status: 'success' as const, message: 'Order rejected' };
  }

  public resetSandbox() {
    const startingCap = Number(this.sandboxConfigs.get('starting_capital')?.value || 10000000);
    this.cashBalance = startingCap;
    this.collateral = 0;
    this.realisedM2M = 0;
    this.orders = [];
    this.trades = [];
    this.positions = [];
    this.pendingOrders = [];
  }

  public createWorkflow(name: string, description: string, triggerType: FlowWorkflow['trigger_type']) {
    const wf: FlowWorkflow = {
      id: this.nextWorkflowId++,
      name: name.trim() || 'Untitled Workflow',
      description: description.trim() || 'Custom automated trading workflow',
      trigger_type: triggerType,
      is_active: false,
      webhook_enabled: triggerType === 'webhook',
      webhook_token: generateHexKey(12),
      last_execution_status: 'idle',
      last_run_at: null,
      nodes_count: 3,
      updated_at: nowTimestamp(),
    };
    this.workflows.unshift(wf);
    return wf;
  }

  public toggleWorkflow(id: number): FlowWorkflow | undefined {
    const wf = this.workflows.find((w) => w.id === id);
    if (wf) {
      wf.is_active = !wf.is_active;
      wf.updated_at = nowTimestamp();
    }
    return wf;
  }

  public triggerWorkflow(id: number): FlowWorkflow | undefined {
    const wf = this.workflows.find((w) => w.id === id);
    if (wf) {
      wf.last_execution_status = 'success';
      wf.last_run_at = nowTimestamp();
      wf.updated_at = nowTimestamp();
    }
    return wf;
  }
}

export const store = new OpenAlgoStore();
