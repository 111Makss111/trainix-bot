import type { LargeTrade, OrderWall, TopBook } from "./types";

export function buildAttentionScore(input: {
  largeTrades: LargeTrade[];
  walls: OrderWall[];
  currentPrice: number | null;
}) {
  if (!input.currentPrice) {
    return 0;
  }

  const recentNotional = input.largeTrades
    .slice(0, 8)
    .reduce((sum, trade) => sum + trade.notional, 0);
  const strongestWall = input.walls[0]?.notional ?? 0;
  const nearestWallDistance = input.walls[0]
    ? Math.abs(input.walls[0].price - input.currentPrice) / input.currentPrice
    : 1;
  const tradeScore = Math.min(45, recentNotional / 15000);
  const wallScore = Math.min(35, strongestWall / 25000);
  const proximityScore = Math.max(0, 20 - nearestWallDistance * 1000);

  return Math.round(Math.min(100, tradeScore + wallScore + proximityScore));
}

export function describeAttention(score: number) {
  if (score >= 75) {
    return "Висока увага";
  }

  if (score >= 45) {
    return "Підвищений інтерес";
  }

  return "Спокійний ринок";
}

export function getSpreadData(topBook: TopBook) {
  if (!topBook.bid || !topBook.ask) {
    return null;
  }

  const spread = topBook.ask - topBook.bid;
  const mid = (topBook.ask + topBook.bid) / 2;

  return {
    absolute: spread,
    percent: mid > 0 ? (spread / mid) * 100 : 0,
  };
}

export function getWallPressure(walls: OrderWall[]) {
  const bidNotional = walls
    .filter((wall) => wall.side === "bid")
    .reduce((sum, wall) => sum + wall.notional, 0);
  const askNotional = walls
    .filter((wall) => wall.side === "ask")
    .reduce((sum, wall) => sum + wall.notional, 0);
  const total = bidNotional + askNotional;

  if (!total) {
    return {
      label: "Нейтрально",
      percent: 50,
    };
  }

  const bidPercent = Math.round((bidNotional / total) * 100);

  if (bidPercent >= 60) {
    return {
      label: "Перевага bid",
      percent: bidPercent,
    };
  }

  if (bidPercent <= 40) {
    return {
      label: "Перевага ask",
      percent: bidPercent,
    };
  }

  return {
    label: "Баланс",
    percent: bidPercent,
  };
}
