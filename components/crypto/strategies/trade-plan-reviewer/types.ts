export type TradeDirection = "long" | "short";

export type TradeTimeframe = "5m" | "15m" | "1h" | "4h";

export type TrendDirection = "up" | "down" | "sideways";

export type BtcBias = "bullish" | "bearish" | "neutral";

export type VolatilityState = "quiet" | "normal" | "high" | "extreme";

export type ReviewGrade = "ready" | "review" | "weak" | "no-trade";

export type ReviewStatus = "pass" | "warning" | "fail";

export type ZoneKind = "support" | "resistance";

export type TradePlan = {
  symbol: string;
  direction: TradeDirection;
  timeframe: TradeTimeframe;
  accountBalance: string;
  positionSize: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
};

export type MarketZone = {
  kind: ZoneKind;
  label: string;
  price: number;
  strength: number;
};

export type MarketSource = "live" | "fallback";

export type MarketSnapshot = {
  symbol: string;
  timeframe: TradeTimeframe;
  currentPrice: number;
  trend: TrendDirection;
  trendStrength: number;
  btcBias: BtcBias;
  averageRangePercent: number;
  rangeWidthPercent: number;
  rangeToNoiseRatio: number;
  volatilityState: VolatilityState;
  volumeState: string;
  nearestSupport: MarketZone;
  nearestResistance: MarketZone;
  zones: MarketZone[];
  updatedAt: string;
  source: MarketSource;
  candleCount: number;
};

export type ReviewMetric = {
  label: string;
  value: string;
  detail: string;
  status: ReviewStatus;
};

export type ReviewItem = {
  id: string;
  label: string;
  detail: string;
  status: ReviewStatus;
};

export type ReviewResult = {
  grade: ReviewGrade;
  title: string;
  summary: string;
  metrics: ReviewMetric[];
  signals: ReviewItem[];
  nextActions: string[];
};
