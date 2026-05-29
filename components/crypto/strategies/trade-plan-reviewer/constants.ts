import type { TradeDirection, TradePlan, TradeTimeframe } from "./types";

export const initialTradePlan: TradePlan = {
  symbol: "BTCUSDT",
  direction: "long",
  timeframe: "15m",
  accountBalance: "1000",
  positionSize: "100",
  entryPrice: "",
  stopLoss: "",
  takeProfit: "",
};

export const directionOptions: Array<{
  label: string;
  value: TradeDirection;
}> = [
  { label: "Long", value: "long" },
  { label: "Short", value: "short" },
];

export const timeframeOptions: Array<{
  label: string;
  value: TradeTimeframe;
}> = [
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
];
