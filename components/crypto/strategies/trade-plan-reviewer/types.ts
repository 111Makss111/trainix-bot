export type TradeDirection = "long" | "short";

export type TradeSetup = "btc-decoupling" | "range-touch" | "manual";

export type TradePlan = {
  symbol: string;
  direction: TradeDirection;
  setup: TradeSetup;
  accountBalance: string;
  positionSize: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  entryReason: string;
  marketContext: string;
  invalidation: string;
};

export type ReviewGrade = "ready" | "review" | "weak" | "no-trade";

export type ReviewStatus = "pass" | "warning" | "fail";

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
  checklist: ReviewItem[];
  positives: string[];
  warnings: string[];
  nextActions: string[];
};
