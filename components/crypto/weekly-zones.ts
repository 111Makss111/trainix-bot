import {
  evaluateZoneStatus,
  generateWeeklyZonesFromCandles,
  getIsoWeekKey,
  getWeekStartUtc,
  type CryptoZoneDraft,
} from "@/lib/crypto-zone-engine";
import type { CryptoWeeklyZone } from "@/lib/crypto-zones";
import { getRestBase, weeklySnapshotVersion } from "./config";
import { parseKlines } from "./market-data";
import type { BinanceRestKline, MarketType, WeeklyZonesResponse } from "./types";

function getWeeklySnapshotStorageKey(
  marketType: MarketType,
  symbol: string,
  weekKey: string,
) {
  return `crypto-weekly-zones:${weeklySnapshotVersion}:${marketType}:${symbol}:${weekKey}`;
}

export function getZoneStatusLabel(status: CryptoWeeklyZone["status"]) {
  switch (status) {
    case "touched":
      return "Торкнулась";
    case "broken":
      return "Зламана";
    case "completed":
      return "Відпрацювала";
    default:
      return "Активна";
  }
}

export function getZoneColor(zone: CryptoWeeklyZone) {
  if (zone.zoneKind === "zero_trend") {
    return zone.status === "broken"
      ? "rgba(125, 211, 252, 0.38)"
      : "rgba(125, 211, 252, 0.58)";
  }

  if (zone.bias === "support" || zone.bias === "breakout-up") {
    return zone.status === "completed"
      ? "rgba(52, 211, 153, 0.72)"
      : zone.status === "broken"
        ? "rgba(52, 211, 153, 0.32)"
        : "rgba(52, 211, 153, 0.58)";
  }

  return zone.status === "completed"
    ? "rgba(251, 146, 60, 0.68)"
    : zone.status === "broken"
      ? "rgba(248, 113, 113, 0.34)"
      : "rgba(248, 113, 113, 0.56)";
}

export async function buildClientWeeklyZonesSnapshot(
  activeMarketType: MarketType,
  activeSymbol: string,
): Promise<WeeklyZonesResponse> {
  const now = new Date();
  const weekKey = getIsoWeekKey(now);
  const generatedAt = now.toISOString();
  const storageKey = getWeeklySnapshotStorageKey(
    activeMarketType,
    activeSymbol,
    weekKey,
  );
  const restBase = getRestBase(activeMarketType);

  let snapshot: CryptoZoneDraft[] | null = null;

  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(storageKey);

    if (raw) {
      try {
        snapshot = JSON.parse(raw) as CryptoZoneDraft[];
      } catch (error) {
        console.error("Failed to parse local weekly snapshot", error);
        window.localStorage.removeItem(storageKey);
      }
    }
  }

  if (!snapshot || !snapshot.length) {
    const sourceResponse = await fetch(
      `${restBase}/klines?symbol=${activeSymbol}&interval=4h&limit=120`,
      {
        cache: "no-store",
      },
    );

    if (!sourceResponse.ok) {
      throw new Error("Failed to load browser-side klines for weekly zones");
    }

    const sourceRows = (await sourceResponse.json()) as BinanceRestKline[];
    snapshot = generateWeeklyZonesFromCandles(parseKlines(sourceRows));

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    }
  }

  const statusResponse = await fetch(
    `${restBase}/klines?symbol=${activeSymbol}&interval=1h&startTime=${getWeekStartUtc(now).getTime()}&limit=240`,
    {
      cache: "no-store",
    },
  );

  if (!statusResponse.ok) {
    throw new Error("Failed to load browser-side status candles for weekly zones");
  }

  const statusRows = (await statusResponse.json()) as BinanceRestKline[];
  const statusCandles = parseKlines(statusRows);
  const currentWeeklyPrice =
    statusCandles[statusCandles.length - 1]?.close ?? null;

  return {
    weekKey,
    generatedAt,
    currentPrice: currentWeeklyPrice,
    zones: snapshot
      .map((zone) => {
        const statusState = evaluateZoneStatus(zone, statusCandles);
        const midPrice = (zone.priceFrom + zone.priceTo) / 2;
        const distancePercent =
          currentWeeklyPrice && currentWeeklyPrice > 0
            ? Math.abs(midPrice - currentWeeklyPrice) / currentWeeklyPrice
            : null;

        return {
          id: `${weekKey}-${zone.label}-${zone.bias}`,
          marketType: activeMarketType,
          symbol: activeSymbol,
          weekKey,
          zoneKind: zone.zoneKind,
          bias: zone.bias,
          label: zone.label,
          priceFrom: zone.priceFrom,
          priceTo: zone.priceTo,
          confidence: zone.confidence,
          status: statusState.status,
          sourceInterval: zone.sourceInterval,
          generatedAt,
          updatedAt: generatedAt,
          touchedAt: statusState.touchedAt,
          brokenAt: statusState.brokenAt,
          completedAt: statusState.completedAt,
          currentPrice: currentWeeklyPrice,
          distancePercent,
        } satisfies CryptoWeeklyZone;
      })
      .sort((left, right) => {
        const leftDistance = left.distancePercent ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.distancePercent ?? Number.POSITIVE_INFINITY;

        return leftDistance - rightDistance;
      }),
  };
}
