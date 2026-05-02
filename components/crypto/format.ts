export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

export function getPricePrecision(value: number | null) {
  if (!value || value <= 0) {
    return 2;
  }

  if (value < 0.0001) {
    return 8;
  }

  if (value < 0.01) {
    return 6;
  }

  if (value < 1) {
    return 4;
  }

  if (value < 10) {
    return 3;
  }

  return 2;
}

export function getSeriesPriceFormat(value: number | null) {
  const precision = getPricePrecision(value);

  return {
    type: "price" as const,
    precision,
    minMove: 1 / 10 ** precision,
  };
}

export function formatTime(value: number) {
  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function formatDistancePercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${(value * 100).toFixed(2)}%`;
}
