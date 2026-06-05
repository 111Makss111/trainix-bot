import { NextResponse } from "next/server";

const binanceMarketDataBaseUrl = "https://data-api.binance.vision";
const binanceFuturesBaseUrls = [
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com",
  "https://fapi4.binance.com",
];
const popularSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "TONUSDT",
  "DOTUSDT",
  "TRXUSDT",
  "MATICUSDT",
  "LTCUSDT",
  "BCHUSDT",
  "NEARUSDT",
  "APTUSDT",
  "ARBUSDT",
  "OPUSDT",
  "SUIUSDT",
  "POPCATUSDT",
  "WIFUSDT",
  "1000PEPEUSDT",
];

type BinanceSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
  contractType?: string;
};

type BinanceExchangeInfo = {
  symbols?: BinanceSymbol[];
};

type CryptoAsset = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketTypes: Array<"spot" | "futures">;
};

function normalizeQuery(value: string | null) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/gu, "") ?? "";
}

function toFallbackAsset(symbol: string): CryptoAsset {
  const quoteAsset = symbol.endsWith("USDT") ? "USDT" : "";

  return {
    symbol,
    baseAsset: quoteAsset ? symbol.slice(0, -quoteAsset.length) : symbol,
    quoteAsset,
    marketTypes: symbol === "POPCATUSDT" || symbol.startsWith("1000")
      ? ["futures"]
      : ["spot", "futures"],
  };
}

function isTradableSpotSymbol(symbol: BinanceSymbol) {
  return (
    symbol.status === "TRADING" &&
    symbol.isSpotTradingAllowed !== false &&
    /^[A-Z0-9]{5,24}$/u.test(symbol.symbol)
  );
}

function isTradableFuturesSymbol(symbol: BinanceSymbol) {
  return (
    symbol.status === "TRADING" &&
    symbol.contractType === "PERPETUAL" &&
    /^[A-Z0-9]{5,24}$/u.test(symbol.symbol)
  );
}

function mergeAssets(assetGroups: CryptoAsset[][]) {
  const mergedAssets = new Map<string, CryptoAsset>();

  for (const assets of assetGroups) {
    for (const asset of assets) {
      const currentAsset = mergedAssets.get(asset.symbol);

      if (!currentAsset) {
        mergedAssets.set(asset.symbol, asset);
        continue;
      }

      mergedAssets.set(asset.symbol, {
        ...currentAsset,
        marketTypes: Array.from(
          new Set([...currentAsset.marketTypes, ...asset.marketTypes]),
        ),
      });
    }
  }

  return Array.from(mergedAssets.values());
}

function getRank(asset: CryptoAsset, query: string) {
  const popularIndex = popularSymbols.indexOf(asset.symbol);
  const popularBoost = popularIndex >= 0 ? 1000 - popularIndex : 0;
  const quoteBoost = asset.quoteAsset === "USDT" ? 220 : asset.quoteAsset === "USDC" ? 120 : 0;

  if (!query) {
    return popularBoost + quoteBoost;
  }

  const exactBoost = asset.symbol === query ? 1000 : 0;
  const symbolStartBoost = asset.symbol.startsWith(query) ? 620 : 0;
  const baseStartBoost = asset.baseAsset.startsWith(query) ? 520 : 0;
  const includesBoost = asset.symbol.includes(query) ? 160 : 0;

  return exactBoost + symbolStartBoost + baseStartBoost + includesBoost + popularBoost + quoteBoost;
}

function filterAssets(assets: CryptoAsset[], query: string) {
  return assets
    .filter((asset) => {
      if (!query) {
        return asset.quoteAsset === "USDT" || popularSymbols.includes(asset.symbol);
      }

      return asset.symbol.includes(query) || asset.baseAsset.includes(query);
    })
    .map((asset) => ({
      asset,
      rank: getRank(asset, query),
    }))
    .filter((item) => item.rank > 0)
    .sort((first, second) => {
      if (second.rank !== first.rank) {
        return second.rank - first.rank;
      }

      return first.asset.symbol.localeCompare(second.asset.symbol);
    })
    .slice(0, 60)
    .map((item) => item.asset);
}

async function fetchSpotAssets() {
  const url = new URL("/api/v3/exchangeInfo", binanceMarketDataBaseUrl);
  const response = await fetch(url, {
    next: { revalidate: 60 * 60 },
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Binance returned ${response.status}.`);
  }

  const exchangeInfo = (await response.json()) as BinanceExchangeInfo;

  return (exchangeInfo.symbols ?? [])
    .filter(isTradableSpotSymbol)
    .map((symbol) => ({
      symbol: symbol.symbol,
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      marketTypes: ["spot"] as Array<"spot" | "futures">,
    }));
}

async function fetchFuturesAssets() {
  for (const baseUrl of binanceFuturesBaseUrls) {
    try {
      const url = new URL("/fapi/v1/exchangeInfo", baseUrl);
      const response = await fetch(url, {
        next: { revalidate: 60 * 60 },
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Binance Futures returned ${response.status}.`);
      }

      const exchangeInfo = (await response.json()) as BinanceExchangeInfo;

      return (exchangeInfo.symbols ?? [])
        .filter(isTradableFuturesSymbol)
        .map((symbol) => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          marketTypes: ["futures"] as Array<"spot" | "futures">,
        }));
    } catch {
      continue;
    }
  }

  throw new Error("Binance Futures symbols unavailable.");
}

async function fetchBinanceAssets() {
  const [spotResult, futuresResult] = await Promise.allSettled([
    fetchSpotAssets(),
    fetchFuturesAssets(),
  ]);
  const spotAssets = spotResult.status === "fulfilled" ? spotResult.value : [];
  const futuresAssets =
    futuresResult.status === "fulfilled" ? futuresResult.value : [];
  const assets = mergeAssets([spotAssets, futuresAssets]);

  if (assets.length === 0) {
    throw new Error("No Binance symbols available.");
  }

  return assets;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalizeQuery(url.searchParams.get("query"));

  try {
    const assets = await fetchBinanceAssets();

    return NextResponse.json({
      assets: filterAssets(assets, query),
      source: "live",
    });
  } catch {
    return NextResponse.json({
      assets: filterAssets(popularSymbols.map(toFallbackAsset), query),
      source: "fallback",
    });
  }
}
