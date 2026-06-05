import { NextResponse } from "next/server";

const binanceMarketDataBaseUrl = "https://data-api.binance.vision";
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
];

type BinanceSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
};

type BinanceExchangeInfo = {
  symbols?: BinanceSymbol[];
};

type CryptoAsset = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
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
  };
}

function isTradableSpotSymbol(symbol: BinanceSymbol) {
  return (
    symbol.status === "TRADING" &&
    symbol.isSpotTradingAllowed !== false &&
    /^[A-Z0-9]{5,24}$/u.test(symbol.symbol)
  );
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

async function fetchBinanceAssets() {
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
    }));
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
