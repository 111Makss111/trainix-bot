function trimTrailingZeros(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

export function formatTradingViewPrice(value: number) {
  const absoluteValue = Math.abs(value);

  if (!Number.isFinite(value)) {
    return "0";
  }

  // Для BTC прибираємо тисячні розділювачі: 63558, а не 63,558.
  // Для дешевших монет залишаємо тільки потрібні десяткові знаки.
  if (absoluteValue >= 1000) {
    return value.toFixed(0);
  }

  if (absoluteValue >= 100) {
    return trimTrailingZeros(value.toFixed(2));
  }

  if (absoluteValue >= 1) {
    return trimTrailingZeros(value.toFixed(4));
  }

  return trimTrailingZeros(value.toFixed(8));
}
