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
  const riskStatus = getRiskStatus(accountRiskPercent);
  const rewardStatus = getRewardStatus(rewardToRisk);
  const reasonStatus = getTextStatus(plan.entryReason, 24);
  const contextStatus = getTextStatus(plan.marketContext, 18);
  const invalidationStatus = getTextStatus(plan.invalidation, 18);

  const priceDetail =
    entryPrice === null || stopLoss === null || takeProfit === null
      ? "Заповни вхід, стоп і ціль."
      : priceSideStatus === "pass"
        ? "Стоп і ціль стоять логічно для обраного напрямку."
        : "Стоп або ціль стоять не з того боку від входу.";

  const riskDetail =
    accountRiskPercent === null
      ? "Не можу порахувати ризик без балансу, позиції, входу і стопа."
      : accountRiskPercent > 3
        ? "Ризик вище 3% акаунту. Це no-trade."
        : accountRiskPercent > 1.5
          ? "Ризик вище 1.5%. Треба зменшити позицію або стоп."
          : "Ризик у нормальній зоні.";

  const rewardDetail =
    rewardToRisk === null
      ? "Не можу порахувати R/R без входу, стопа і цілі."
      : rewardToRisk < 1.2
        ? "Ціль занадто слабка відносно стопа."
        : rewardToRisk < 2
          ? "R/R прийнятний, але не сильний."
          : "Потенціал виглядає сильнішим за ризик.";

  const checklist = [
    buildItem(
      "prices",
      "Ціни",
      priceDetail,
      priceSideStatus,
    ),
    buildItem(
      "risk",
      "Ризик",
      riskDetail,
      riskStatus,
    ),
    buildItem(
      "reward",
      "Ціль",
      rewardDetail,
      rewardStatus,
    ),
    buildItem(
      "reason",
      "Причина",
      reasonStatus === "pass" ? "Причина входу є." : "Додай конкретну причину входу.",
      reasonStatus,
    ),
    buildItem(
      "context",
      "Контекст",
      contextStatus === "pass" ? "Контекст ринку записаний." : "Додай що зараз робить BTC або ринок.",
      contextStatus,
    ),
    buildItem(
      "invalidation",
      "Скасування",
      invalidationStatus === "pass" ? "Умова скасування є." : "Напиши, що саме ламає ідею.",
      invalidationStatus,
    ),
  ];

  const metrics = [
    buildMetric(
      "Account Risk",
      formatPercent(accountRiskPercent),
      "ризик акаунту",
      riskStatus,
    ),
    buildMetric(
      "Stop Distance",
      formatPercent(riskDistancePercent),
      "до стопа",
      riskDistancePercent === null ? "warning" : "pass",
    ),
    buildMetric(
      "Reward / Risk",
      formatRatio(rewardToRisk),
      "потенціал",
      rewardStatus,
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
      ? checklist
          .filter((item) => item.status !== "pass")
          .map((item) => item.detail)
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
