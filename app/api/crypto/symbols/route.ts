import { NextResponse } from "next/server";

const binanceMarketDataBaseUrl = "https://data-api.binance.vision";
const binanceFuturesBaseUrls = [
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com",
  "https://fapi4.binance.com",
];
const bybitBaseUrls = ["https://api.bybit.com", "https://api.bytick.com"];
const bitgetBaseUrl = "https://api.bitget.com";
const okxBaseUrl = "https://www.okx.com";
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
  "BTWUSDT",
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

type BybitInstrument = {
  symbol: string;
  status: string;
  baseCoin: string;
  quoteCoin: string;
  contractType?: string;
};

type BybitInstrumentsResponse = {
  retCode: number;
  retMsg: string;
  result?: {
    list?: BybitInstrument[];
    nextPageCursor?: string;
  };
};

type OkxInstrument = {
  instId: string;
  state: string;
  baseCcy: string;
  quoteCcy: string;
};

type OkxInstrumentsResponse = {
  code: string;
  msg: string;
  data?: OkxInstrument[];
};

type BitgetContract = {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  symbolStatus: string;
};

type BitgetContractsResponse = {
  code: string;
  msg: string;
  data?: BitgetContract[];
};

type MarketType = "spot" | "futures" | "bybit" | "bitget" | "okx";

type CryptoAsset = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketTypes: MarketType[];
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
    marketTypes:
      symbol === "POPCATUSDT" || symbol === "BTWUSDT" || symbol.startsWith("1000")
        ? ["futures", "bybit", "bitget"]
        : ["spot", "futures", "bybit", "bitget"],
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

function isTradableBybitInstrument(instrument: BybitInstrument) {
  return (
    instrument.status === "Trading" &&
    instrument.quoteCoin === "USDT" &&
    /^[A-Z0-9]{5,24}$/u.test(instrument.symbol)
  );
}

function toOkxSymbol(instId: string) {
  return instId.endsWith("-USDT-SWAP")
    ? instId.replace("-USDT-SWAP", "USDT").replace(/-/gu, "")
    : instId.replace(/-/gu, "");
}

function isTradableOkxInstrument(instrument: OkxInstrument) {
  return (
    instrument.state === "live" &&
    instrument.quoteCcy === "USDT" &&
    instrument.instId.endsWith("-USDT-SWAP") &&
    /^[A-Z0-9-]{5,32}$/u.test(instrument.instId)
  );
}

function isTradableBitgetContract(contract: BitgetContract) {
  return (
    contract.symbolStatus === "normal" &&
    contract.quoteCoin === "USDT" &&
    /^[A-Z0-9]{5,24}$/u.test(contract.symbol)
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
          marketTypes: ["spot"] as MarketType[],
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
          marketTypes: ["futures"] as MarketType[],
        }));
    } catch {
      continue;
    }
  }

  throw new Error("Binance Futures symbols unavailable.");
}

async function fetchBybitAssets() {
  for (const baseUrl of bybitBaseUrls) {
    try {
      const assets: CryptoAsset[] = [];
      let cursor = "";

      for (let page = 0; page < 5; page += 1) {
        const url = new URL("/v5/market/instruments-info", baseUrl);
        url.searchParams.set("category", "linear");
        url.searchParams.set("limit", "1000");

        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        const response = await fetch(url, {
          next: { revalidate: 60 * 60 },
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Bybit returned ${response.status}.`);
        }

        const payload = (await response.json()) as BybitInstrumentsResponse;

        if (payload.retCode !== 0) {
          throw new Error(`Bybit ${payload.retCode}: ${payload.retMsg}`);
        }

        assets.push(
          ...(payload.result?.list ?? [])
            .filter(isTradableBybitInstrument)
            .map((instrument) => ({
              symbol: instrument.symbol,
              baseAsset: instrument.baseCoin,
              quoteAsset: instrument.quoteCoin,
              marketTypes: ["bybit"] as MarketType[],
            })),
        );

        cursor = payload.result?.nextPageCursor ?? "";

        if (!cursor) {
          break;
        }
      }

      return assets;
    } catch {
      continue;
    }
  }

  throw new Error("Bybit symbols unavailable.");
}

async function fetchOkxAssets() {
  const url = new URL("/api/v5/public/instruments", okxBaseUrl);
  url.searchParams.set("instType", "SWAP");
  const response = await fetch(url, {
    next: { revalidate: 60 * 60 },
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`OKX returned ${response.status}.`);
  }

  const payload = (await response.json()) as OkxInstrumentsResponse;

  if (payload.code !== "0") {
    throw new Error(`OKX ${payload.code}: ${payload.msg}`);
  }

  return (payload.data ?? [])
    .filter(isTradableOkxInstrument)
    .map((instrument) => ({
      symbol: toOkxSymbol(instrument.instId),
      baseAsset: instrument.baseCcy,
      quoteAsset: instrument.quoteCcy,
      marketTypes: ["okx"] as MarketType[],
    }));
}

async function fetchBitgetAssets() {
  const url = new URL("/api/v2/mix/market/contracts", bitgetBaseUrl);
  url.searchParams.set("productType", "usdt-futures");
  const response = await fetch(url, {
    next: { revalidate: 60 * 60 },
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Bitget returned ${response.status}.`);
  }

  const payload = (await response.json()) as BitgetContractsResponse;

  if (payload.code !== "00000") {
    throw new Error(`Bitget ${payload.code}: ${payload.msg}`);
  }

  return (payload.data ?? [])
    .filter(isTradableBitgetContract)
    .map((contract) => ({
      symbol: contract.symbol,
      baseAsset: contract.baseCoin,
      quoteAsset: contract.quoteCoin,
      marketTypes: ["bitget"] as MarketType[],
    }));
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

async function fetchLiveAssets() {
  const [binanceResult, bybitResult, bitgetResult, okxResult] =
    await Promise.allSettled([
      fetchBinanceAssets(),
      fetchBybitAssets(),
      fetchBitgetAssets(),
      fetchOkxAssets(),
    ]);
  const binanceAssets =
    binanceResult.status === "fulfilled" ? binanceResult.value : [];
  const bybitAssets = bybitResult.status === "fulfilled" ? bybitResult.value : [];
  const bitgetAssets =
    bitgetResult.status === "fulfilled" ? bitgetResult.value : [];
  const okxAssets = okxResult.status === "fulfilled" ? okxResult.value : [];
  const assets = mergeAssets([
    binanceAssets,
    bybitAssets,
    bitgetAssets,
    okxAssets,
  ]);

  if (assets.length === 0) {
    throw new Error("No live symbols available.");
  }

  return assets;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalizeQuery(url.searchParams.get("query"));

  try {
    const assets = await fetchLiveAssets();

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
