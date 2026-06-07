"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type CryptoAsset = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketTypes?: Array<"spot" | "futures" | "bybit" | "okx">;
};

type AssetSearchProps = {
  value: string;
  onChange: (symbol: string) => void;
};

const fallbackAssets: CryptoAsset[] = [
  { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "BNBUSDT", baseAsset: "BNB", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "DOGEUSDT", baseAsset: "DOGE", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "ADAUSDT", baseAsset: "ADA", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "AVAXUSDT", baseAsset: "AVAX", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "LINKUSDT", baseAsset: "LINK", quoteAsset: "USDT", marketTypes: ["spot", "futures"] },
  { symbol: "POPCATUSDT", baseAsset: "POPCAT", quoteAsset: "USDT", marketTypes: ["futures"] },
  { symbol: "BTWUSDT", baseAsset: "BTW", quoteAsset: "USDT", marketTypes: ["bybit"] },
];

function normalizeSymbol(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/gu, "");
}

function filterLocalAssets(assets: CryptoAsset[], query: string) {
  const normalizedQuery = normalizeSymbol(query);

  if (!normalizedQuery) {
    return assets.slice(0, 12);
  }

  return assets
    .filter((asset) => {
      return (
        asset.symbol.includes(normalizedQuery) ||
        asset.baseAsset.includes(normalizedQuery)
      );
    })
    .slice(0, 12);
}

function getMarketLabel(asset: CryptoAsset) {
  const marketTypes = asset.marketTypes ?? ["spot"];
  const labels = [
    marketTypes.includes("spot") ? "Spot" : null,
    marketTypes.includes("futures") ? "Binance Futures" : null,
    marketTypes.includes("bybit") ? "Bybit" : null,
    marketTypes.includes("okx") ? "OKX" : null,
  ].filter(Boolean);

  return labels.join(" + ") || "Spot";
}

export function AssetSearch({ value, onChange }: AssetSearchProps) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value);
  const [assets, setAssets] = useState<CryptoAsset[]>(fallbackAssets);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<"live" | "fallback">("fallback");

  const visibleAssets = useMemo(
    () => filterLocalAssets(assets, query),
    [assets, query],
  );

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams({
          query: normalizeSymbol(query),
        });
        const response = await fetch(`/api/crypto/symbols?${params}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          assets?: CryptoAsset[];
          source?: "live" | "fallback";
        };

        if (!response.ok || !payload.assets) {
          throw new Error("Symbols unavailable.");
        }

        setAssets(payload.assets.length > 0 ? payload.assets : fallbackAssets);
        setSource(payload.source ?? "live");
      } catch {
        if (!controller.signal.aborted) {
          setAssets(fallbackAssets);
          setSource("fallback");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function selectAsset(symbol: string) {
    setQuery(symbol);
    setIsOpen(false);
    onChange(symbol);
  }

  function submitCurrentQuery() {
    const normalizedQuery = normalizeSymbol(query);

    if (normalizedQuery.length >= 5) {
      selectAsset(normalizedQuery);
    }
  }

  return (
    <div ref={wrapperRef} className="relative z-50 mt-2">
      <div className="flex h-11 items-center rounded-[1rem] border border-white/10 bg-white/[0.04] transition focus-within:border-white/24 focus-within:bg-white/[0.06]">
        <input
          value={query}
          placeholder="BTCUSDT"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(normalizeSymbol(event.currentTarget.value));
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitCurrentQuery();
            }

            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/26"
        />
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="mr-1 rounded-[0.8rem] border border-white/10 bg-black/12 px-3 py-1.5 text-xs text-white/56 transition hover:border-white/22 hover:text-white"
        >
          Обрати
        </button>
      </div>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] overflow-hidden rounded-[1rem] border border-white/12 bg-[#11131c] shadow-2xl shadow-black/35"
        >
          <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 text-xs text-white/42">
            <span>{isLoading ? "Оновлення активів" : "Активні пари"}</span>
            <span>{source === "live" ? "біржі" : "резерв"}</span>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {visibleAssets.length > 0 ? (
              visibleAssets.map((asset) => (
                <button
                  key={asset.symbol}
                  type="button"
                  role="option"
                  aria-selected={asset.symbol === value}
                  onClick={() => selectAsset(asset.symbol)}
                  className="flex w-full items-center justify-between gap-3 rounded-[0.85rem] px-3 py-2 text-left transition hover:bg-white/[0.06]"
                >
                  <span>
                    <span className="block font-medium text-white">
                      {asset.symbol}
                    </span>
                    <span className="mt-0.5 block text-xs text-white/38">
                      {asset.baseAsset} / {asset.quoteAsset} · {getMarketLabel(asset)}
                    </span>
                  </span>
                  {asset.symbol === value ? (
                    <span className="rounded-full border border-emerald-300/18 bg-emerald-300/8 px-2 py-1 text-xs text-emerald-100">
                      вибрано
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-white/46">
                Немає активів за цим пошуком.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
