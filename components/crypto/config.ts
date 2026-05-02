import type {
  CryptoInterval,
  LargeTradeThreshold,
  MarketType,
} from "./types";

export const spotPresetSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "SUIUSDT",
  "PEPEUSDT",
  "SHIBUSDT",
] as const;

export const futuresPresetSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "SUIUSDT",
  "WIFUSDT",
  "PNUTUSDT",
  "FARTCOINUSDT",
  "POPCATUSDT",
  "1000BONKUSDT",
] as const;

export const intervalOptions: readonly CryptoInterval[] = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
] as const;

export const largeTradeThresholds: readonly LargeTradeThreshold[] = [
  25000,
  50000,
  100000,
  250000,
  500000,
] as const;

export const klineHistoryLimit = 10000;
export const restBackupRefreshMs = 15_000;
export const staleStreamMs = 25_000;
export const wallSyncThrottleMs = 1_200;
export const bookTickerThrottleMs = 500;
export const maxTradeMarkers = 30;
export const weeklySnapshotVersion = "v1";

export const visibleBarsByInterval: Record<CryptoInterval, number> = {
  "1m": 360,
  "5m": 420,
  "15m": 420,
  "1h": 360,
  "4h": 240,
};

export const marketOptions: readonly { value: MarketType; label: string }[] = [
  {
    value: "spot",
    label: "Spot",
  },
  {
    value: "futures",
    label: "Futures",
  },
] as const;

export function getRestBase(marketType: MarketType) {
  return marketType === "spot"
    ? "https://api.binance.com/api/v3"
    : "https://fapi.binance.com/fapi/v1";
}
