import type { Candle } from "@/lib/crypto-zone-engine";
import type { UTCTimestamp } from "lightweight-charts";
import type { BinanceRestKline } from "./types";

export function parseKlines(rows: BinanceRestKline[]): Candle[] {
  return rows.map((row) => ({
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

export function toChartTime(value: number) {
  return Math.floor(value / 1000) as UTCTimestamp;
}
