import type {
  ReviewGrade,
  ReviewItem,
  ReviewMetric,
  ReviewResult,
  ReviewStatus,
  TradeDirection,
  TradePlan,
} from "./types";

function toNumber(value: string) {
  const normalizedValue = value.replace(",", ".").trim();
  const numberValue = Number.parseFloat(normalizedValue);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Не рах.";
  }

  return `${value.toFixed(2)}%`;
}

function formatRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Не рах.";
  }

  return `${value.toFixed(2)}R`;
}

function getPriceSideStatus(
  direction: TradeDirection,
  entryPrice: number | null,
  stopLoss: number | null,
  takeProfit: number | null,
): ReviewStatus {
  if (entryPrice === null || stopLoss === null || takeProfit === null) {
    return "fail";
  }

  if (direction === "long") {
    return stopLoss < entryPrice && takeProfit > entryPrice ? "pass" : "fail";
  }

  return stopLoss > entryPrice && takeProfit < entryPrice ? "pass" : "fail";
}

function getTextStatus(value: string, minLength: number): ReviewStatus {
  return value.trim().length >= minLength ? "pass" : "warning";
}

function getRiskStatus(accountRiskPercent: number | null): ReviewStatus {
  if (accountRiskPercent === null) {
    return "warning";
  }

  if (accountRiskPercent > 3) {
    return "fail";
  }

  if (accountRiskPercent > 1.5) {
    return "warning";
  }

  return "pass";
}

function getRewardStatus(rewardToRisk: number | null): ReviewStatus {
  if (rewardToRisk === null) {
    return "warning";
  }

  if (rewardToRisk < 1.2) {
    return "fail";
  }

  if (rewardToRisk < 2) {
    return "warning";
  }

  return "pass";
}

function buildMetric(
  label: string,
  value: string,
  detail: string,
  status: ReviewStatus,
): ReviewMetric {
  return { label, value, detail, status };
}

function buildItem(
  id: string,
  label: string,
  detail: string,
  status: ReviewStatus,
): ReviewItem {
  return { id, label, detail, status };
}

function getGrade(items: ReviewItem[], accountRiskPercent: number | null) {
  const failCount = items.filter((item) => item.status === "fail").length;
  const warningCount = items.filter((item) => item.status === "warning").length;

  if (failCount > 0 || (accountRiskPercent !== null && accountRiskPercent > 3)) {
    return "no-trade";
  }

  if (warningCount >= 4) {
    return "weak";
  }

  if (warningCount > 0) {
    return "review";
  }

  return "ready";
}

function getGradeCopy(grade: ReviewGrade) {
  if (grade === "ready") {
    return {
      title: "План виглядає готовим",
      summary: "Базові ризики, стоп, ціль і логіка плану зараз виглядають зібрано.",
    };
  }

  if (grade === "review") {
    return {
      title: "План треба допрацювати",
      summary: "Є слабкі місця, але вони виглядають виправними до входу.",
    };
  }

  if (grade === "weak") {
    return {
      title: "План слабкий",
      summary: "Забагато невизначеності. Такий план краще не використовувати без правок.",
    };
  }

  return {
    title: "No-trade",
    summary: "Є критична проблема: без її виправлення вхід не має проходити перевірку.",
  };
}

export function reviewTradePlan(plan: TradePlan): ReviewResult {
  const accountBalance = toNumber(plan.accountBalance);
  const positionSize = toNumber(plan.positionSize);
  const entryPrice = toNumber(plan.entryPrice);
  const stopLoss = toNumber(plan.stopLoss);
  const takeProfit = toNumber(plan.takeProfit);

  const riskDistancePercent =
    entryPrice !== null && stopLoss !== null
      ? (Math.abs(entryPrice - stopLoss) / entryPrice) * 100
      : null;

  const rewardDistancePercent =
    entryPrice !== null && takeProfit !== null
      ? (Math.abs(takeProfit - entryPrice) / entryPrice) * 100
      : null;

  const accountRiskPercent =
    accountBalance !== null &&
    positionSize !== null &&
    riskDistancePercent !== null
      ? ((positionSize * riskDistancePercent) / 100 / accountBalance) * 100
      : null;

  const rewardToRisk =
    riskDistancePercent !== null &&
    rewardDistancePercent !== null &&
    riskDistancePercent > 0
      ? rewardDistancePercent / riskDistancePercent
      : null;

  const priceSideStatus = getPriceSideStatus(
    plan.direction,
    entryPrice,
    stopLoss,
    takeProfit,
  );

  const checklist = [
    buildItem(
      "prices",
      "Ціни стоять з правильного боку",
      "Для Long стоп має бути нижче входу, ціль вище. Для Short навпаки.",
      priceSideStatus,
    ),
    buildItem(
      "risk",
      "Ризик по акаунту контрольований",
      "Поки мʼякий ліміт: до 1.5% добре, 1.5-3% треба переглянути, вище 3% no-trade.",
      getRiskStatus(accountRiskPercent),
    ),
    buildItem(
      "reward",
      "Потенціал вартий ризику",
      "Мінімум 1.2R, комфортніше 2R і вище.",
      getRewardStatus(rewardToRisk),
    ),
    buildItem(
      "reason",
      "Причина входу достатньо конкретна",
      "Не просто відчуття, а чіткий аргумент: структура, зона, обʼєм, BTC-контекст.",
      getTextStatus(plan.entryReason, 24),
    ),
    buildItem(
      "context",
      "Контекст ринку записаний",
      "План має пояснювати, що зараз з BTC, волатильністю або режимом ринку.",
      getTextStatus(plan.marketContext, 18),
    ),
    buildItem(
      "invalidation",
      "Є умова скасування ідеї",
      "Треба знати не тільки де стоп, а чому саме там ідея стає неправильною.",
      getTextStatus(plan.invalidation, 18),
    ),
  ];

  const metrics = [
    buildMetric(
      "Account Risk",
      formatPercent(accountRiskPercent),
      "Скільки акаунту ризикує ця позиція.",
      getRiskStatus(accountRiskPercent),
    ),
    buildMetric(
      "Stop Distance",
      formatPercent(riskDistancePercent),
      "Відстань від входу до стопа.",
      riskDistancePercent === null ? "warning" : "pass",
    ),
    buildMetric(
      "Reward / Risk",
      formatRatio(rewardToRisk),
      "Потенціал цілі відносно стопа.",
      getRewardStatus(rewardToRisk),
    ),
  ];

  const positives = checklist
    .filter((item) => item.status === "pass")
    .map((item) => item.label);

  const warnings = checklist
    .filter((item) => item.status !== "pass")
    .map((item) => item.label);

  const nextActions =
    warnings.length > 0
      ? warnings.map((warning) => `Виправити: ${warning}.`)
      : ["План можна зберегти як кандидат на угоду."];

  const grade = getGrade(checklist, accountRiskPercent);
  const gradeCopy = getGradeCopy(grade);

  return {
    grade,
    title: gradeCopy.title,
    summary: gradeCopy.summary,
    metrics,
    checklist,
    positives,
    warnings,
    nextActions,
  };
}
