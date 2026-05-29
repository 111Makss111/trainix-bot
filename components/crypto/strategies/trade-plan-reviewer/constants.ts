import type { TradeDirection, TradePlan, TradeSetup } from "./types";

export const initialTradePlan: TradePlan = {
  symbol: "BTCUSDT",
  direction: "long",
  setup: "manual",
  accountBalance: "1000",
  positionSize: "100",
  entryPrice: "",
  stopLoss: "",
  takeProfit: "",
  entryReason: "",
  marketContext: "",
  invalidation: "",
};

export const directionOptions: Array<{
  label: string;
  value: TradeDirection;
}> = [
  { label: "Long", value: "long" },
  { label: "Short", value: "short" },
];

export const setupOptions: Array<{
  label: string;
  value: TradeSetup;
}> = [
  { label: "Manual idea", value: "manual" },
  { label: "BTC Decoupling", value: "btc-decoupling" },
  { label: "Range Touch", value: "range-touch" },
];
