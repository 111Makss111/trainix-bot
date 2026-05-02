import type { CryptoWeeklyZone } from "@/lib/crypto-zones";

export type BinanceRestKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export type LargeTrade = {
  id: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  notional: number;
  time: number;
};

export type OrderWall = {
  side: "bid" | "ask";
  price: number;
  quantity: number;
  notional: number;
};

export type DayTickerStats = {
  priceChangePercent: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
};

export type TopBook = {
  bid: number | null;
  ask: number | null;
};

export type MarketType = "spot" | "futures";
export type CryptoInterval = "1m" | "5m" | "15m" | "1h" | "4h";
export type LargeTradeThreshold = 25000 | 50000 | 100000 | 250000 | 500000;

export type WeeklyZonesResponse = {
  weekKey: string;
  generatedAt: string;
  currentPrice: number | null;
  zones: CryptoWeeklyZone[];
};
