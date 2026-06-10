import type {
  BtcBias,
  MarketAnalysisTimeframe,
  MarketSnapshot,
  MoveStageState,
  OpenInterestPoint,
  OpenInterestState,
  PriceActionState,
  ReviewStatus,
  MarketSource,
  MarketZone,
  TradeTimeframe,
  TrendDirection,
  VolatilityState,
  ZoneKind,
  ZoneVolumeProfile,
} from "./types";
import { getPriceActionState } from "./priceAction";
import { getZoneReaction } from "./zoneReaction";

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

const analysisTimeframeOrder: MarketAnalysisTimeframe[] = [
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
];
const minimumSnapshotCandles = 20;

const timeframeLookbackCandles: Record<MarketAnalysisTimeframe, number> = {
  "5m": 120,
  "15m": 140,
  "1h": 180,
  "4h": 220,
  "1d": 260,
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPercentChange(from: number, to: number) {
  if (from === 0) {
    return 0;
  }

  return ((to - from) / from) * 100;
}

function getOpenInterestLabel(signal: OpenInterestState["signal"]) {
  if (signal === "bullish-build") {
    return "підтримує ріст";
  }

  if (signal === "bearish-build") {
    return "підтримує злив";
  }

  if (signal === "long-flush") {
    return "лонги виходять";
  }

  if (signal === "short-covering") {
    return "можливий squeeze";
  }

  if (signal === "position-build") {
    return "позиції набирають";
  }

  if (signal === "position-unwind") {
    return "позиції закривають";
  }

  if (signal === "noise") {
    return "шумний";
  }

  if (signal === "neutral") {
    return "нейтрально";
  }

  return "OI невідомий";
}

function getFallbackOpenInterest(
  source: MarketSource = "fallback",
): OpenInterestState {
  return {
    status: "unavailable",
    source,
    current: null,
    previous: null,
    changePercent: null,
    direction: "unknown",
    signal: "unknown",
    score: 0,
    label: "OI недоступний",
    summary: "Open Interest ще не завантажений.",
    detail: "Система не враховує фʼючерсний інтерес без даних біржі.",
    updatedAt: null,
    samples: 0,
  };
}

function getOpenInterestDirection(changePercent: number): OpenInterestState["direction"] {
  if (changePercent >= 2) {
    return "rising";
  }

  if (changePercent <= -2) {
    return "falling";
  }

  return "flat";
}

function getPriceDirection(changePercent: number) {
  if (changePercent >= 0.35) {
    return "up";
  }

  if (changePercent <= -0.35) {
    return "down";
  }

  return "flat";
}

function getOpenInterestSignal({
  oiDirection,
  priceDirection,
  oiChangeAbs,
  priceChangeAbs,
}: {
  oiDirection: OpenInterestState["direction"];
  priceDirection: "up" | "down" | "flat";
  oiChangeAbs: number;
  priceChangeAbs: number;
}): OpenInterestState["signal"] {
  const hasMeaningfulOi = oiChangeAbs >= 2;
  const hasMeaningfulPriceMove = priceChangeAbs >= 0.35;

  if (!hasMeaningfulOi && !hasMeaningfulPriceMove) {
    return "noise";
  }

  if (!hasMeaningfulOi) {
    return "neutral";
  }

  if (priceDirection === "flat" && oiDirection === "rising") {
    return "position-build";
  }

  if (priceDirection === "flat" && oiDirection === "falling") {
    return "position-unwind";
  }

  if (priceDirection === "up" && oiDirection === "rising") {
    return "bullish-build";
  }

  if (priceDirection === "down" && oiDirection === "rising") {
    return "bearish-build";
  }

  if (priceDirection === "down" && oiDirection === "falling") {
    return "long-flush";
  }

  if (priceDirection === "up" && oiDirection === "falling") {
    return "short-covering";
  }

  return "neutral";
}

function getOpenInterestScore({
  signal,
  oiChangeAbs,
  priceChangeAbs,
  volumeRatio,
}: {
  signal: OpenInterestState["signal"];
  oiChangeAbs: number;
  priceChangeAbs: number;
  volumeRatio: number;
}) {
  const activityScore = clamp(
    oiChangeAbs * 7 + priceChangeAbs * 7 + Math.max(volumeRatio - 1, 0) * 18,
    0,
    45,
  );

  if (signal === "bullish-build" || signal === "bearish-build") {
    return Math.round(clamp(55 + activityScore, 55, 100));
  }

  if (signal === "long-flush" || signal === "short-covering") {
    return Math.round(clamp(45 + activityScore, 45, 82));
  }

  if (signal === "position-build" || signal === "position-unwind") {
    return Math.round(clamp(38 + activityScore * 0.7, 38, 68));
  }

  if (signal === "neutral") {
    return 40;
  }

  if (signal === "noise") {
    return 18;
  }

  return 0;
}

function getRecentVolumeRatio(candles: Candle[]) {
  const recentCandles = getRecentCandles(candles, 3);
  const baselineCandles = getRecentCandles(candles.slice(0, -3), 20);
  const recentVolume = average(recentCandles.map((candle) => candle.volume));
  const baselineVolume = average(baselineCandles.map((candle) => candle.volume));

  return baselineVolume > 0 ? recentVolume / baselineVolume : 1;
}

function getOpenInterestDetail({
  label,
  signal,
  score,
  changePercent,
  priceChangePercent,
  volumeRatio,
}: {
  label: string;
  signal: OpenInterestState["signal"];
  score: number;
  changePercent: number;
  priceChangePercent: number;
  volumeRatio: number;
}) {
  const base = `OI ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%, ціна ${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(1)}%, обсяг ${volumeRatio.toFixed(1)}x.`;

  if (signal === "noise") {
    return `${base} Зміна OI або ціни замала, тому система не робить висновок по великих грошах.`;
  }

  if (signal === "bullish-build") {
    return `${base} ${score}/100: нові позиції підтримують рух вгору. Це корисно для Long, але ще треба перевіряти вхід і зону.`;
  }

  if (signal === "bearish-build") {
    return `${base} ${score}/100: нові позиції підтримують рух вниз. Це корисно для Short, але ще треба перевіряти вхід і зону.`;
  }

  if (signal === "long-flush") {
    return `${base} ${score}/100: ціна падає, але OI зменшується. Це більше схоже на вихід лонгів, а не на чистий набір нових шортів.`;
  }

  if (signal === "short-covering") {
    return `${base} ${score}/100: ціна росте, але OI зменшується. Це може бути закриття шортів або squeeze, переслідувати рух небезпечно.`;
  }

  if (signal === "position-build") {
    return `${base} ${score}/100: OI росте, але ціна ще не дала напрям. Ринок набирає позиції, висновок по Long/Short ще слабкий.`;
  }

  if (signal === "position-unwind") {
    return `${base} ${score}/100: OI падає без чіткого руху ціни. Частина позицій виходить з ринку.`;
  }

  return `${base} ${label}. OI не дає чистої переваги напрямку.`;
}

function getOpenInterestState({
  candles,
  points,
  source,
}: {
  candles: Candle[];
  points?: OpenInterestPoint[] | null;
  source: Exclude<MarketSource, "fallback">;
}): OpenInterestState {
  const sortedPoints = [...(points ?? [])]
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.timestamp))
    .sort((first, second) => first.timestamp - second.timestamp);
  const lastPoint = sortedPoints.at(-1);

  if (!lastPoint) {
    return getFallbackOpenInterest(source);
  }

  if (sortedPoints.length < 2) {
    return {
      status: "partial",
      source,
      current: lastPoint.value,
      previous: null,
      changePercent: null,
      direction: "unknown",
      signal: "unknown",
      score: 20,
      label: "Поточний OI",
      summary: "Є тільки поточний Open Interest без динаміки.",
      detail: "Поточне значення OI є, але немає історії для висновку по руху.",
      updatedAt: new Date(lastPoint.timestamp).toISOString(),
      samples: sortedPoints.length,
    };
  }

  const recentPoints = sortedPoints.slice(Math.max(0, sortedPoints.length - 12));
  const firstPoint = recentPoints[0];
  const changePercent = getPercentChange(firstPoint.value, lastPoint.value);
  const oiDirection = getOpenInterestDirection(changePercent);
  const candleLookback = Math.min(recentPoints.length, candles.length - 1);
  const referenceCandle = candles.at(-1 - candleLookback) ?? candles[0];
  const currentCandle = candles.at(-1) ?? referenceCandle;
  const priceChangePercent = getPercentChange(referenceCandle.close, currentCandle.close);
  const priceDirection = getPriceDirection(priceChangePercent);
  const oiChangeAbs = Math.abs(changePercent);
  const priceChangeAbs = Math.abs(priceChangePercent);
  const volumeRatio = getRecentVolumeRatio(candles);
  const signal = getOpenInterestSignal({
    oiDirection,
    priceDirection,
    oiChangeAbs,
    priceChangeAbs,
  });
  const label = getOpenInterestLabel(signal);
  const score = getOpenInterestScore({
    signal,
    oiChangeAbs,
    priceChangeAbs,
    volumeRatio,
  });

  return {
    status: "ok",
    source,
    current: lastPoint.value,
    previous: firstPoint.value,
    changePercent,
    direction: oiDirection,
    signal,
    score,
    label,
    summary: `${label} ${score}/100. OI ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%, ціна ${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(1)}%.`,
    detail: getOpenInterestDetail({
      label,
      signal,
      score,
      changePercent,
      priceChangePercent,
      volumeRatio,
    }),
    updatedAt: new Date(lastPoint.timestamp).toISOString(),
    samples: sortedPoints.length,
  };
}

function getRecentCandles(candles: Candle[], count: number) {
  return candles.slice(Math.max(0, candles.length - count));
}

function getClosedCandles(candles: Candle[]) {
  if (candles.length > 35) {
    return candles.slice(0, -1);
  }

  return candles;
}

function getSma(candles: Candle[], count: number) {
  return average(getRecentCandles(candles, count).map((candle) => candle.close));
}

function getCandleBodyRatio(candle: Candle) {
  const range = candle.high - candle.low;

  if (range <= 0) {
    return 0;
  }

  return Math.abs(candle.close - candle.open) / range;
}

function getMoveStageLabel(phase: MoveStageState["phase"]) {
  if (phase === "trap") {
    return "можлива пастка";
  }

  if (phase === "late") {
    return "пізній вхід";
  }

  if (phase === "heated") {
    return "рух розігрітий";
  }

  if (phase === "active") {
    return "рух активний";
  }

  if (phase === "early") {
    return "початок руху";
  }

  if (phase === "base") {
    return "база";
  }

  return "стадія невідома";
}

function getMoveStageStatus(phase: MoveStageState["phase"]): ReviewStatus {
  if (phase === "trap" || phase === "late") {
    return "fail";
  }

  if (phase === "heated") {
    return "warning";
  }

  return "pass";
}

function getMoveStageRiskScore({
  phase,
  moveAtr,
  pullbackAtr,
  counterCandles,
}: {
  phase: MoveStageState["phase"];
  moveAtr: number;
  pullbackAtr: number;
  counterCandles: number;
}) {
  const phaseBase: Record<MoveStageState["phase"], number> = {
    base: 8,
    early: 18,
    active: 34,
    heated: 56,
    late: 76,
    trap: 90,
    unknown: 0,
  };

  return Math.round(
    clamp(
      phaseBase[phase] + Math.max(0, moveAtr - 3) * 5 + pullbackAtr * 6 + counterCandles * 3,
      0,
      100,
    ),
  );
}

function getMoveStage({
  candles,
  currentPrice,
  atr,
  priceAction,
}: {
  candles: Candle[];
  currentPrice: number;
  atr: number;
  priceAction: PriceActionState;
}): MoveStageState {
  const closedCandles = getClosedCandles(candles);
  const recentCandles = getRecentCandles(closedCandles, 18);
  const lastSixCandles = getRecentCandles(closedCandles, 6);

  if (atr <= 0 || recentCandles.length < 8) {
    return {
      phase: "unknown",
      direction: "neutral",
      riskScore: 0,
      moveAtr: 0,
      pullbackAtr: 0,
      counterCandles: 0,
      strongCandles: 0,
      label: "стадія невідома",
      summary: "Стадія руху не рахується без ATR і достатньої кількості свічок.",
      detail: "Недостатньо даних, щоб зрозуміти, чи рух на початку, у середині або вже пізній.",
      status: "warning",
    };
  }

  const direction = priceAction.direction;

  if (direction === "neutral") {
    return {
      phase: "base",
      direction,
      riskScore: 8,
      moveAtr: 0,
      pullbackAtr: 0,
      counterCandles: 0,
      strongCandles: 0,
      label: "база",
      summary: "Немає чистого імпульсу, ціна більше схожа на базу або боковик.",
      detail: "Система не бачить руху, який треба переслідувати.",
      status: "pass",
    };
  }

  const moveStart =
    direction === "long"
      ? Math.min(...recentCandles.map((candle) => candle.low))
      : Math.max(...recentCandles.map((candle) => candle.high));
  const moveAtr =
    direction === "long"
      ? Math.max(0, currentPrice - moveStart) / atr
      : Math.max(0, moveStart - currentPrice) / atr;
  const recentExtreme =
    direction === "long"
      ? Math.max(...lastSixCandles.map((candle) => candle.high))
      : Math.min(...lastSixCandles.map((candle) => candle.low));
  const pullbackAtr =
    direction === "long"
      ? Math.max(0, recentExtreme - currentPrice) / atr
      : Math.max(0, currentPrice - recentExtreme) / atr;
  const counterCandles = lastSixCandles.filter((candle) =>
    direction === "long" ? candle.close < candle.open : candle.close > candle.open,
  ).length;
  const strongCandles = recentCandles.filter((candle) => {
    const isDirectionCandle =
      direction === "long" ? candle.close > candle.open : candle.close < candle.open;

    return isDirectionCandle && getCandleBodyRatio(candle) >= 0.55;
  }).length;
  const lastTwoAreCounter = getRecentCandles(closedCandles, 2).every((candle) =>
    direction === "long" ? candle.close < candle.open : candle.close > candle.open,
  );
  const phase: MoveStageState["phase"] =
    moveAtr >= 4.2 && (pullbackAtr >= 0.9 || lastTwoAreCounter)
      ? "trap"
      : moveAtr >= 3.6 || (moveAtr >= 3 && counterCandles >= 2)
        ? "late"
        : moveAtr >= 2.4
          ? "heated"
          : moveAtr >= 1.1
            ? "active"
            : moveAtr >= 0.5
              ? "early"
              : "base";
  const riskScore = getMoveStageRiskScore({
    phase,
    moveAtr,
    pullbackAtr,
    counterCandles,
  });
  const label = getMoveStageLabel(phase);
  const sideText = direction === "long" ? "вгору" : "вниз";
  const dangerText =
    phase === "trap"
      ? "Після сильного руху вже є зустрічні свічки. Це схоже на пізній натовп або пастку."
      : phase === "late"
        ? "Рух уже пройшов багато ATR. Краще чекати відкат або нову базу."
        : phase === "heated"
          ? "Рух сильний, але вже розігрітий. Вхід по ринку треба перевіряти жорсткіше."
          : "Рух ще не виглядає занадто пізнім.";

  return {
    phase,
    direction,
    riskScore,
    moveAtr,
    pullbackAtr,
    counterCandles,
    strongCandles,
    label,
    summary: `${label}: рух ${sideText} ${moveAtr.toFixed(1)} ATR, відкат ${pullbackAtr.toFixed(1)} ATR.`,
    detail: `${dangerText} Сильних свічок: ${strongCandles}, зустрічних останнім часом: ${counterCandles}.`,
    status: getMoveStageStatus(phase),
  };
}

function getTrend(candles: Candle[]): {
  trend: TrendDirection;
  trendStrength: number;
} {
  const currentPrice = candles.at(-1)?.close ?? 0;
  const shortSma = getSma(candles, 9);
  const longSma = getSma(candles, 21);
  const referenceCandle = candles.at(-21) ?? candles[0];
  const recentMove = referenceCandle
    ? getPercentChange(referenceCandle.close, currentPrice)
    : 0;
  const smaGap = longSma === 0 ? 0 : getPercentChange(longSma, shortSma);
  const rawStrength = Math.abs(recentMove) * 7 + Math.abs(smaGap) * 14;
  const trendStrength = Math.round(clamp(35 + rawStrength, 0, 100));

  if (shortSma > longSma && currentPrice > longSma && recentMove > 0.25) {
    return { trend: "up", trendStrength };
  }

  if (shortSma < longSma && currentPrice < longSma && recentMove < -0.25) {
    return { trend: "down", trendStrength };
  }

  return {
    trend: "sideways",
    trendStrength: Math.round(clamp(100 - rawStrength * 2, 20, 62)),
  };
}

function getBtcBias(btcCandles: Candle[]): BtcBias {
  const btcTrend = getTrend(btcCandles).trend;

  if (btcTrend === "up") {
    return "bullish";
  }

  if (btcTrend === "down") {
    return "bearish";
  }

  return "neutral";
}

function getVolumeState(candles: Candle[]) {
  const lastVolume = candles.at(-1)?.volume ?? 0;
  const previousVolumes = getRecentCandles(candles.slice(0, -1), 20).map(
    (candle) => candle.volume,
  );
  const averageVolume = average(previousVolumes);

  if (averageVolume === 0) {
    return "обсяг невідомий";
  }

  const volumeRatio = lastVolume / averageVolume;

  if (volumeRatio >= 1.5) {
    return "обсяг вище норми";
  }

  if (volumeRatio <= 0.65) {
    return "обсяг нижче норми";
  }

  return "обсяг у нормі";
}

function getVolumeStrength(score: number): ZoneVolumeProfile["strength"] {
  if (score >= 70) {
    return "strong";
  }

  if (score >= 45) {
    return "normal";
  }

  return "weak";
}

function getZoneVolumeSummary(strength: ZoneVolumeProfile["strength"]) {
  if (strength === "strong") {
    return "обсяг сильний";
  }

  if (strength === "normal") {
    return "обсяг нормальний";
  }

  if (strength === "weak") {
    return "обсяг слабкий";
  }

  return "обсяг невідомий";
}

function getZoneVolumePressure({
  buyingVolume,
  sellingVolume,
}: {
  buyingVolume: number;
  sellingVolume: number;
}): {
  pressure: ZoneVolumeProfile["pressure"];
  pressureScore: number;
} {
  const totalVolume = buyingVolume + sellingVolume;

  if (totalVolume <= 0) {
    return { pressure: "unknown", pressureScore: 0 };
  }

  const imbalancePercent =
    (Math.abs(buyingVolume - sellingVolume) / totalVolume) * 100;

  if (imbalancePercent < 12) {
    return {
      pressure: "balanced",
      pressureScore: Math.round(imbalancePercent),
    };
  }

  return {
    pressure: buyingVolume > sellingVolume ? "buying" : "selling",
    pressureScore: Math.round(imbalancePercent),
  };
}

function sumCandleVolume(candles: Candle[], direction: "buying" | "selling") {
  return candles.reduce((sum, candle) => {
    const candleDirection = candle.close >= candle.open ? "buying" : "selling";

    return candleDirection === direction ? sum + candle.volume : sum;
  }, 0);
}

function getUnknownZoneVolume(zone: MarketZone): ZoneVolumeProfile {
  return {
    zoneKind: zone.kind,
    zoneLow: zone.low,
    zoneHigh: zone.high,
    strength: "unknown",
    pressure: "unknown",
    score: 0,
    pressureScore: 0,
    zoneVolumeRatio: 0,
    touchVolumeRatio: 0,
    buyingVolumeRatio: 0,
    sellingVolumeRatio: 0,
    touchedCandles: 0,
    summary: "обсяг невідомий",
    detail: "Обсяг у зоні не рахується без достатньої кількості свічок.",
  };
}

function getZoneVolumeProfile(candles: Candle[], zone: MarketZone): ZoneVolumeProfile {
  const baselineCandles = getRecentCandles(candles, 30);
  const baselineVolume = average(baselineCandles.map((candle) => candle.volume));

  if (baselineVolume <= 0) {
    return getUnknownZoneVolume(zone);
  }

  const recentCandles = getRecentCandles(candles, 80);
  const zoneCandles = recentCandles.filter(
    (candle) => candle.high >= zone.low && candle.low <= zone.high,
  );
  const touchCandles = getRecentCandles(candles, 12).filter(
    (candle) => candle.high >= zone.low && candle.low <= zone.high,
  );

  if (zoneCandles.length === 0) {
    return getUnknownZoneVolume(zone);
  }

  const zoneVolumeRatio =
    average(zoneCandles.map((candle) => candle.volume)) / baselineVolume;
  const touchVolumeRatio =
    touchCandles.length > 0
      ? average(touchCandles.map((candle) => candle.volume)) / baselineVolume
      : 0;
  const pressureCandles = touchCandles.length >= 2 ? touchCandles : zoneCandles;
  const buyingVolume = sumCandleVolume(pressureCandles, "buying");
  const sellingVolume = sumCandleVolume(pressureCandles, "selling");
  const buyingVolumeRatio = buyingVolume / baselineVolume;
  const sellingVolumeRatio = sellingVolume / baselineVolume;
  const { pressure, pressureScore } = getZoneVolumePressure({
    buyingVolume,
    sellingVolume,
  });
  const score = Math.round(
    clamp(
      zoneVolumeRatio * 34 +
        touchVolumeRatio * 36 +
        Math.min(zoneCandles.length, 10) * 3,
      0,
      100,
    ),
  );
  const strength = getVolumeStrength(score);
  const touchText =
    touchCandles.length > 0
      ? `останній підхід ${touchVolumeRatio.toFixed(1)}x`
      : "останній підхід не торкався зони";

  return {
    zoneKind: zone.kind,
    zoneLow: zone.low,
    zoneHigh: zone.high,
    strength,
    pressure,
    score,
    pressureScore,
    zoneVolumeRatio,
    touchVolumeRatio,
    buyingVolumeRatio,
    sellingVolumeRatio,
    touchedCandles: zoneCandles.length,
    summary: getZoneVolumeSummary(strength),
    detail: `Свічок у зоні: ${zoneCandles.length}. Обсяг зони ${zoneVolumeRatio.toFixed(1)}x, ${touchText} від середнього. Тиск: ${getVolumePressureLabel(pressure)} ${pressureScore}/100.`,
  };
}

function getVolumePressureLabel(pressure: ZoneVolumeProfile["pressure"]) {
  if (pressure === "buying") {
    return "покупець";
  }

  if (pressure === "selling") {
    return "продавець";
  }

  if (pressure === "balanced") {
    return "баланс";
  }

  return "невідомо";
}

function getAverageRangePercent(candles: Candle[]) {
  const recentCandles = getRecentCandles(candles, 20);
  const ranges = recentCandles.map((candle) => {
    if (candle.close === 0) {
      return 0;
    }

    return ((candle.high - candle.low) / candle.close) * 100;
  });

  return average(ranges);
}

function getAtr(candles: Candle[], period = 14) {
  const recentCandles = getRecentCandles(candles, period + 1);
  const trueRanges = recentCandles.slice(1).map((candle, index) => {
    const previousClose = recentCandles[index].close;
    const candleRange = candle.high - candle.low;
    const highGap = Math.abs(candle.high - previousClose);
    const lowGap = Math.abs(candle.low - previousClose);

    return Math.max(candleRange, highGap, lowGap);
  });

  return average(trueRanges);
}

function getVolatilityState(averageRangePercent: number): VolatilityState {
  if (averageRangePercent >= 1.2) {
    return "extreme";
  }

  if (averageRangePercent >= 0.7) {
    return "high";
  }

  if (averageRangePercent <= 0.18) {
    return "quiet";
  }

  return "normal";
}

function dedupeZones(zones: MarketZone[]) {
  const result: MarketZone[] = [];

  for (const zone of zones.sort((a, b) => b.strength - a.strength)) {
    const hasSimilarZone = result.some((item) => {
      const distancePercent = Math.abs(zone.price - item.price) / item.price;
      return distancePercent < 0.004;
    });

    if (!hasSimilarZone) {
      result.push(zone);
    }
  }

  return result;
}

function sortTimeframes(timeframes: MarketAnalysisTimeframe[]) {
  return [...timeframes].sort(
    (first, second) =>
      analysisTimeframeOrder.indexOf(first) - analysisTimeframeOrder.indexOf(second),
  );
}

function createZone({
  kind,
  label,
  low,
  high,
  price,
  strength,
  timeframes,
  sourceCount,
  isMultiTimeframe,
}: {
  kind: MarketZone["kind"];
  label: string;
  low: number;
  high: number;
  price?: number;
  strength: number;
  timeframes?: MarketAnalysisTimeframe[];
  sourceCount?: number;
  isMultiTimeframe?: boolean;
}): MarketZone {
  const safeLow = Math.min(low, high);
  const safeHigh = Math.max(low, high);
  const zoneTimeframes = sortTimeframes(timeframes ?? []);

  return {
    kind,
    label,
    low: safeLow,
    high: safeHigh,
    price: price ?? (safeLow + safeHigh) / 2,
    strength,
    timeframes: zoneTimeframes,
    sourceCount: sourceCount ?? zoneTimeframes.length,
    isMultiTimeframe: isMultiTimeframe ?? zoneTimeframes.length > 1,
  };
}

function pickImportantZone(candidates: MarketZone[]) {
  return candidates[0];
}

function uniqueZones(zones: MarketZone[]) {
  const result: MarketZone[] = [];

  for (const zone of zones) {
    const hasZone = result.some(
      (item) =>
        item.kind === zone.kind &&
        Math.abs(item.price - zone.price) / Math.max(item.price, 1) < 0.0005,
    );

    if (!hasZone) {
      result.push(zone);
    }
  }

  return result;
}

function selectVisibleZones(allZones: MarketZone[], currentPrice: number) {
  const supports = allZones
    .filter((zone) => zone.kind === "support" && zone.price < currentPrice)
    .sort((a, b) => b.price - a.price);
  const resistances = allZones
    .filter((zone) => zone.kind === "resistance" && zone.price > currentPrice)
    .sort((a, b) => a.price - b.price);

  const nearestSupport = pickImportantZone(supports);
  const nearestResistance = pickImportantZone(resistances);

  return {
    nearestSupport,
    nearestResistance,
    zones: uniqueZones([
      nearestSupport,
      ...supports.slice(0, 2),
      nearestResistance,
      ...resistances.slice(0, 2),
    ].filter(Boolean)).sort((a, b) => a.price - b.price),
  };
}

function buildZones(
  candles: Candle[],
  currentPrice: number,
  options?: {
    timeframe?: MarketAnalysisTimeframe;
    lookbackCandles?: number;
  },
) {
  const timeframe = options?.timeframe ?? "15m";
  const recentCandles = getRecentCandles(
    candles,
    options?.lookbackCandles ?? timeframeLookbackCandles[timeframe],
  );
  const pivotZones: MarketZone[] = [];
  const averageRangePercent = getAverageRangePercent(candles);

  for (let index = 2; index < recentCandles.length - 2; index += 1) {
    const candle = recentCandles[index];
    const left = recentCandles.slice(index - 2, index);
    const right = recentCandles.slice(index + 1, index + 3);
    const isPivotLow = [...left, ...right].every(
      (nearbyCandle) => candle.low <= nearbyCandle.low,
    );
    const isPivotHigh = [...left, ...right].every(
      (nearbyCandle) => candle.high >= nearbyCandle.high,
    );
    const recencyScore = (index / recentCandles.length) * 25;
    const zonePadding = candle.close * Math.max(averageRangePercent / 100, 0.0025);

    if (isPivotLow && candle.low < currentPrice) {
      pivotZones.push(createZone({
        kind: "support",
        label: "Локальна підтримка",
        low: candle.low - zonePadding * 0.4,
        high: candle.low + zonePadding,
        strength: Math.round(clamp(55 + recencyScore, 45, 92)),
        timeframes: [timeframe],
      }));
    }

    if (isPivotHigh && candle.high > currentPrice) {
      pivotZones.push(createZone({
        kind: "resistance",
        label: "Локальний опір",
        low: candle.high - zonePadding,
        high: candle.high + zonePadding * 0.4,
        strength: Math.round(clamp(55 + recencyScore, 45, 92)),
        timeframes: [timeframe],
      }));
    }
  }

  const lowest = recentCandles.reduce(
    (lowestCandle, candle) => (candle.low < lowestCandle.low ? candle : lowestCandle),
    recentCandles[0],
  );
  const highest = recentCandles.reduce(
    (highestCandle, candle) =>
      candle.high > highestCandle.high ? candle : highestCandle,
    recentCandles[0],
  );

  const allZones = dedupeZones([
    ...pivotZones,
    createZone({
      kind: "support",
      label: "Широка підтримка",
      low: lowest.low - currentPrice * 0.003,
      high: lowest.low + currentPrice * 0.004,
      strength: 72,
      timeframes: [timeframe],
    }),
    createZone({
      kind: "resistance",
      label: "Широкий опір",
      low: highest.high - currentPrice * 0.004,
      high: highest.high + currentPrice * 0.003,
      strength: 72,
      timeframes: [timeframe],
    }),
  ]);

  const visibleZones = selectVisibleZones(allZones, currentPrice);
  const nearestSupport =
    visibleZones.nearestSupport ??
    createZone({
      kind: "support",
      label: "Орієнтовна підтримка",
      low: currentPrice * 0.98,
      high: currentPrice * 0.988,
      strength: 45,
      timeframes: [timeframe],
    });
  const nearestResistance =
    visibleZones.nearestResistance ??
    createZone({
      kind: "resistance",
      label: "Орієнтовний опір",
      low: currentPrice * 1.012,
      high: currentPrice * 1.02,
      strength: 45,
      timeframes: [timeframe],
    });

  return {
    nearestSupport,
    nearestResistance,
    zones:
      visibleZones.zones.length > 0
        ? visibleZones.zones
        : [nearestSupport, nearestResistance],
    allZones,
  };
}

function getConfirmationTolerance(currentPrice: number, atr: number) {
  return Math.max(currentPrice * 0.0045, atr * 0.5);
}

function zonesOverlapForConfirmation(
  workingZone: MarketZone,
  confirmationZone: MarketZone,
  tolerance: number,
) {
  return (
    workingZone.kind === confirmationZone.kind &&
    confirmationZone.low <= workingZone.high + tolerance &&
    confirmationZone.high >= workingZone.low - tolerance
  );
}

function getConfirmationBonus(timeframes: MarketAnalysisTimeframe[]) {
  return timeframes.reduce((sum, timeframe) => {
    if (timeframe === "1d") {
      return sum + 18;
    }

    if (timeframe === "4h") {
      return sum + 14;
    }

    if (timeframe === "1h") {
      return sum + 9;
    }

    if (timeframe === "15m") {
      return sum + 5;
    }

    return sum + 3;
  }, 0);
}

function confirmWorkingZone(
  workingZone: MarketZone,
  confirmationZones: MarketZone[],
  selectedTimeframe: TradeTimeframe,
  tolerance: number,
) {
  const matchedTimeframes = confirmationZones
    .filter((zone) => zonesOverlapForConfirmation(workingZone, zone, tolerance))
    .flatMap((zone) => zone.timeframes)
    .filter((timeframe) => timeframe !== selectedTimeframe);
  const uniqueMatchedTimeframes = [...new Set(matchedTimeframes)];
  const timeframes = sortTimeframes([
    ...new Set([...workingZone.timeframes, ...uniqueMatchedTimeframes]),
  ]);
  const sourceCount = timeframes.length;
  const strength = Math.round(
    clamp(
      workingZone.strength + getConfirmationBonus(uniqueMatchedTimeframes),
      45,
      98,
    ),
  );
  const isConfirmed = sourceCount > 1;

  return createZone({
    kind: workingZone.kind,
    label: isConfirmed
      ? workingZone.kind === "support"
        ? "Підтримка з MTF-підтвердженням"
        : "Опір з MTF-підтвердженням"
      : workingZone.label,
    low: workingZone.low,
    high: workingZone.high,
    price: workingZone.price,
    strength,
    timeframes,
    sourceCount,
    isMultiTimeframe: isConfirmed,
  });
}

function buildConfirmedWorkingZones({
  currentPrice,
  atr,
  selectedTimeframe,
  candles,
  multiTimeframeCandles,
}: {
  currentPrice: number;
  atr: number;
  selectedTimeframe: TradeTimeframe;
  candles: Candle[];
  multiTimeframeCandles?: Partial<Record<MarketAnalysisTimeframe, Candle[]>>;
}) {
  const workingZones = buildZones(candles, currentPrice, {
    timeframe: selectedTimeframe,
    lookbackCandles: timeframeLookbackCandles[selectedTimeframe],
  });
  const candlesByTimeframe: Partial<Record<MarketAnalysisTimeframe, Candle[]>> = {
    ...multiTimeframeCandles,
    [selectedTimeframe]: multiTimeframeCandles?.[selectedTimeframe] ?? candles,
  };
  const confirmationZones = analysisTimeframeOrder
    .filter((timeframe) => timeframe !== selectedTimeframe)
    .flatMap((timeframe) => {
      const timeframeCandles = candlesByTimeframe[timeframe];

      if (!timeframeCandles || timeframeCandles.length < minimumSnapshotCandles) {
        return [];
      }

      return buildZones(timeframeCandles, currentPrice, {
        timeframe,
        lookbackCandles: timeframeLookbackCandles[timeframe],
      }).allZones;
    });
  const tolerance = getConfirmationTolerance(currentPrice, atr);
  const allZones = workingZones.allZones.map((zone) =>
    confirmWorkingZone(zone, confirmationZones, selectedTimeframe, tolerance),
  );
  const visibleZones = selectVisibleZones(allZones, currentPrice);

  return {
    nearestSupport: visibleZones.nearestSupport ?? workingZones.nearestSupport,
    nearestResistance: visibleZones.nearestResistance ?? workingZones.nearestResistance,
    zones:
      visibleZones.zones.length > 0
        ? visibleZones.zones
        : [workingZones.nearestSupport, workingZones.nearestResistance],
    allZones,
  };
}

export function buildMarketSnapshotFromCandles({
  symbol,
  timeframe,
  candles,
  btcCandles,
  source,
  multiTimeframeCandles,
  openInterestPoints,
  openInterestSource,
}: {
  symbol: string;
  timeframe: TradeTimeframe;
  candles: Candle[];
  btcCandles: Candle[];
  source: Exclude<MarketSource, "fallback">;
  multiTimeframeCandles?: Partial<Record<MarketAnalysisTimeframe, Candle[]>>;
  openInterestPoints?: OpenInterestPoint[] | null;
  openInterestSource?: Exclude<MarketSource, "fallback"> | null;
}): MarketSnapshot {
  const currentCandle = candles.at(-1);

  if (
    !currentCandle ||
    candles.length < minimumSnapshotCandles ||
    btcCandles.length < minimumSnapshotCandles
  ) {
    throw new Error("Not enough candle data to build market snapshot.");
  }

  const currentPrice = currentCandle.close;
  const trend = getTrend(candles);
  const averageRangePercent = getAverageRangePercent(candles);
  const atr = getAtr(candles);
  const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
  const zones = buildConfirmedWorkingZones({
    currentPrice,
    atr,
    selectedTimeframe: timeframe,
    candles,
    multiTimeframeCandles,
  });
  const zoneReactions = {
    support: getZoneReaction(candles, zones.nearestSupport),
    resistance: getZoneReaction(candles, zones.nearestResistance),
  };
  const zoneVolumes = {
    support: getZoneVolumeProfile(candles, zones.nearestSupport),
    resistance: getZoneVolumeProfile(candles, zones.nearestResistance),
  };
  const priceAction = getPriceActionState({
    candles,
    currentPrice,
    atr,
    trend: trend.trend,
    nearestSupport: zones.nearestSupport,
    nearestResistance: zones.nearestResistance,
    supportReaction: zoneReactions.support,
    resistanceReaction: zoneReactions.resistance,
  });
  const moveStage = getMoveStage({
    candles,
    currentPrice,
    atr,
    priceAction,
  });
  const analyzedTimeframes = analysisTimeframeOrder.filter((analysisTimeframe) => {
    if (analysisTimeframe === timeframe) {
      return true;
    }

    return (
      (multiTimeframeCandles?.[analysisTimeframe]?.length ?? 0) >=
      minimumSnapshotCandles
    );
  });
  const rangeWidthPercent =
    ((zones.nearestResistance.price - zones.nearestSupport.price) /
      currentPrice) *
    100;
  const rangeToNoiseRatio =
    averageRangePercent > 0 ? rangeWidthPercent / averageRangePercent : 0;

  return {
    symbol,
    timeframe,
    currentPrice,
    trend: trend.trend,
    trendStrength: trend.trendStrength,
    btcBias: getBtcBias(btcCandles),
    averageRangePercent,
    atr,
    atrPercent,
    rangeWidthPercent,
    rangeToNoiseRatio,
    volatilityState: getVolatilityState(averageRangePercent),
    volumeState: getVolumeState(candles),
    openInterest: getOpenInterestState({
      candles,
      points: openInterestPoints,
      source: openInterestSource ?? source,
    }),
    nearestSupport: zones.nearestSupport,
    nearestResistance: zones.nearestResistance,
    priceAction,
    moveStage,
    zoneReactions,
    zoneVolumes,
    zones: zones.zones,
    updatedAt: new Date().toISOString(),
    source,
    candleCount: candles.length,
    analyzedTimeframes,
  };
}

export function getFallbackMarketSnapshot(
  symbol: string,
  timeframe: TradeTimeframe,
): MarketSnapshot {
  const normalizedSymbol = symbol.trim().toUpperCase() || "BTCUSDT";
  const currentPrice = normalizedSymbol === "ETHUSDT" ? 3820 : 100;
  const fallbackSupport = {
    kind: "support" as ZoneKind,
    label: "Орієнтовна підтримка",
    low: currentPrice * 0.976,
    high: currentPrice * 0.984,
    price: currentPrice * 0.98,
    strength: 45,
    timeframes: [timeframe],
    sourceCount: 1,
    isMultiTimeframe: false,
  };
  const fallbackResistance = {
    kind: "resistance" as ZoneKind,
    label: "Орієнтовний опір",
    low: currentPrice * 1.016,
    high: currentPrice * 1.024,
    price: currentPrice * 1.02,
    strength: 45,
    timeframes: [timeframe],
    sourceCount: 1,
    isMultiTimeframe: false,
  };

  return {
    symbol: normalizedSymbol,
    timeframe,
    currentPrice,
    trend: "sideways",
    trendStrength: 42,
    btcBias: "neutral",
    averageRangePercent: 0,
    atr: 0,
    atrPercent: 0,
    rangeWidthPercent: 4,
    rangeToNoiseRatio: 0,
    volatilityState: "normal",
    volumeState: "очікуємо живі дані",
    openInterest: getFallbackOpenInterest(),
    nearestSupport: fallbackSupport,
    nearestResistance: fallbackResistance,
    priceAction: {
      mode: "range",
      direction: "neutral",
      label: "без імпульсу",
      summary: "Імпульс не рахується без живих свічок.",
      strength: 0,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
    },
    moveStage: {
      phase: "unknown",
      direction: "neutral",
      riskScore: 0,
      moveAtr: 0,
      pullbackAtr: 0,
      counterCandles: 0,
      strongCandles: 0,
      label: "стадія невідома",
      summary: "Стадія руху не рахується без живих свічок.",
      detail: "Потрібні ринкові дані, щоб зрозуміти, чи рух уже пізній.",
      status: "warning",
    },
    zoneReactions: {
      support: {
        zoneKind: "support",
        zoneLabel: "Орієнтовна підтримка",
        zoneLow: fallbackSupport.low,
        zoneHigh: fallbackSupport.high,
        strength: "none",
        behavior: "none",
        score: 0,
        touchedAt: null,
        wickPercent: 0,
        closeReturned: false,
        summary: "реакції немає",
        detail: "Реакція не рахується без живих свічок.",
      },
      resistance: {
        zoneKind: "resistance",
        zoneLabel: "Орієнтовний опір",
        zoneLow: fallbackResistance.low,
        zoneHigh: fallbackResistance.high,
        strength: "none",
        behavior: "none",
        score: 0,
        touchedAt: null,
        wickPercent: 0,
        closeReturned: false,
        summary: "реакції немає",
        detail: "Реакція не рахується без живих свічок.",
      },
    },
    zoneVolumes: {
      support: getUnknownZoneVolume(fallbackSupport),
      resistance: getUnknownZoneVolume(fallbackResistance),
    },
    zones: [fallbackSupport, fallbackResistance],
    updatedAt: "fallback",
    source: "fallback",
    candleCount: 0,
    analyzedTimeframes: [timeframe],
  };
}
