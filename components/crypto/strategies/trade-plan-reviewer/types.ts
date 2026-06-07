export type TradeDirection = "long" | "short";

export type TradeTimeframe = "5m" | "15m" | "1h" | "4h";

export type MarketAnalysisTimeframe = TradeTimeframe | "1d";

export type TrendDirection = "up" | "down" | "sideways";

export type BtcBias = "bullish" | "bearish" | "neutral";

export type VolatilityState = "quiet" | "normal" | "high" | "extreme";

export type ReviewGrade = "ready" | "review" | "weak" | "no-trade";

export type ReviewStatus = "pass" | "warning" | "fail";

export type ZoneKind = "support" | "resistance";

export type EntryMode = "market" | "limit" | "momentum" | "distant" | "custom";

export type PriceActionMode =
  | "range"
  | "support-reaction"
  | "resistance-reaction"
  | "impulse-up"
  | "impulse-down"
  | "overextended-up"
  | "overextended-down";

export type ZoneReactionStrength = "strong" | "medium" | "weak" | "none";

export type ZoneReactionBehavior =
  | "buyback"
  | "rejection"
  | "breakdown"
  | "breakout"
  | "noise"
  | "none";

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
  low: number;
  high: number;
  price: number;
  strength: number;
  timeframes: MarketAnalysisTimeframe[];
  sourceCount: number;
  isMultiTimeframe: boolean;
};

export type MarketZoneReaction = {
  zoneKind: ZoneKind;
  zoneLabel: string;
  zoneLow: number;
  zoneHigh: number;
  strength: ZoneReactionStrength;
  behavior: ZoneReactionBehavior;
  score: number;
  touchedAt: string | null;
  wickPercent: number;
  closeReturned: boolean;
  summary: string;
  detail: string;
};

export type PriceActionState = {
  mode: PriceActionMode;
  direction: TradeDirection | "neutral";
  label: string;
  summary: string;
  strength: number;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
};

export type MarketSource =
  | "spot"
  | "futures"
  | "bybit"
  | "bitget"
  | "okx"
  | "fallback";

export type MarketDataDiagnosticStatus = "ok" | "partial" | "failed";

export type MarketDataDiagnosticCheck = {
  timeframe: MarketAnalysisTimeframe;
  status: "ok" | "failed";
  candleCount: number;
  source: Exclude<MarketSource, "fallback"> | null;
  error: string | null;
};

export type MarketDataDiagnostic = {
  symbol: string;
  venue: string;
  source: Exclude<MarketSource, "fallback">;
  status: MarketDataDiagnosticStatus;
  selectedTimeframe: TradeTimeframe;
  selectedCandleCount: number;
  selectedError: string | null;
  checks: MarketDataDiagnosticCheck[];
};

export type MarketSnapshot = {
  symbol: string;
  timeframe: TradeTimeframe;
  currentPrice: number;
  trend: TrendDirection;
  trendStrength: number;
  btcBias: BtcBias;
  averageRangePercent: number;
  atr: number;
  atrPercent: number;
  rangeWidthPercent: number;
  rangeToNoiseRatio: number;
  volatilityState: VolatilityState;
  volumeState: string;
  nearestSupport: MarketZone;
  nearestResistance: MarketZone;
  priceAction: PriceActionState;
  zoneReactions: {
    support: MarketZoneReaction;
    resistance: MarketZoneReaction;
  };
  zones: MarketZone[];
  updatedAt: string;
  source: MarketSource;
  candleCount: number;
  analyzedTimeframes: MarketAnalysisTimeframe[];
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

export type ReviewLevels = {
  currentPrice: number;
  entryPrice: number;
  entryMode: EntryMode;
  entryDistanceFromMarketPercent: number;
  entryDistanceFromMarketAtr: number | null;
  stopLoss: number;
  takeProfit: number;
  riskDistancePercent: number;
  rewardDistancePercent: number;
  targetSpacePercent: number;
  zoneDistancePercent: number;
  pricePositionPercent: number;
  accountRiskPercent: number | null;
  rewardToRisk: number | null;
  stopAtrMultiple: number | null;
  targetAtrMultiple: number | null;
  priceAction: PriceActionState;
  zoneReaction: MarketZoneReaction;
};

export type ReviewResult = {
  grade: ReviewGrade;
  title: string;
  summary: string;
  levels: ReviewLevels;
  metrics: ReviewMetric[];
  signals: ReviewItem[];
  nextActions: string[];
};

export type DirectionCandidate = {
  direction: TradeDirection;
  label: string;
  score: number;
  status: ReviewStatus;
  review: ReviewResult;
  reasons: string[];
};

export type DirectionPriority = {
  preferredDirection: TradeDirection | "wait";
  title: string;
  summary: string;
  candidates: DirectionCandidate[];
};
