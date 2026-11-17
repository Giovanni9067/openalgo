export type Exchange =
  | 'NSE'
  | 'BSE'
  | 'NFO'
  | 'BFO'
  | 'CDS'
  | 'BCD'
  | 'MCX'
  | 'NCDEX'
  | 'NCO'
  | 'CRYPTO'
  | 'NSE_INDEX'
  | 'BSE_INDEX'
  | 'MCX_INDEX'
  | 'GLOBAL_INDEX';

export type OrderAction = 'BUY' | 'SELL';
export type ProductType = 'MIS' | 'CNC' | 'NRML';
export type PriceType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type OrderStatus = 'complete' | 'open' | 'cancelled' | 'rejected';
export type OrderMode = 'auto' | 'semi_auto';

export interface BrokerPlugin {
  id: string;
  name: string;
  type: 'IN_stock' | 'crypto';
  leverageConfig: boolean;
  exchanges: string[];
  description: string;
}

export interface OrderRecord {
  orderid: string;
  symbol: string;
  exchange: string;
  action: OrderAction;
  quantity: number;
  price: number;
  trigger_price: number;
  pricetype: PriceType;
  product: ProductType;
  order_status: OrderStatus;
  timestamp: string;
  strategy: string;
  disclosed_quantity: number;
}

export interface TradeRecord {
  orderid: string;
  symbol: string;
  exchange: string;
  product: ProductType;
  action: OrderAction;
  quantity: number;
  average_price: number;
  trade_value: number;
  timestamp: string;
}

export interface PositionRecord {
  symbol: string;
  exchange: string;
  product: ProductType;
  quantity: number;
  average_price: number;
  ltp: number;
  pnl: number;
}

export interface HoldingRecord {
  symbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  ltp: number;
  pnl: number;
  pnlpercent: number;
}

export interface FundsData {
  availablecash: string;
  collateral: string;
  m2munrealized: string;
  m2mrealized: string;
  utiliseddebits: string;
}

export interface QuoteData {
  symbol: string;
  exchange: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  volume: number;
  bid: number;
  ask: number;
  oi: number;
  timestamp: string;
}

export interface PendingOrderRecord {
  id: string;
  api_type: string;
  symbol: string;
  exchange: string;
  action: OrderAction;
  quantity: number;
  price: number;
  pricetype: PriceType;
  product: ProductType;
  strategy: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  payload: Record<string, unknown>;
}

export interface AnalyzerLogRecord {
  id: string;
  timestamp: string;
  api_type: string;
  source: string;
  symbol?: string;
  exchange?: string;
  action?: string;
  quantity?: number;
  status: 'success' | 'error';
  request_data: Record<string, unknown>;
  response_data: Record<string, unknown>;
}

export interface SandboxConfigItem {
  value: string;
  description: string;
  category: 'capital' | 'leverage' | 'square_off' | 'intervals';
}

export interface FlowWorkflow {
  id: number;
  name: string;
  description: string;
  trigger_type: 'webhook' | 'schedule' | 'price_alert';
  is_active: boolean;
  webhook_enabled: boolean;
  webhook_token: string;
  last_execution_status: 'success' | 'idle' | 'error';
  last_run_at: string | null;
  nodes_count: number;
  updated_at: string;
}
