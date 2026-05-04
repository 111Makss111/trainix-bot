import type { LargeTrade, OrderWall } from "./types";
import { formatCompactNumber, formatPrice, formatTime } from "./format";

type CryptoSidePanelsProps = {
  largeTrades: LargeTrade[];
  walls: OrderWall[];
};

export function CryptoSidePanels({
  largeTrades,
  walls,
}: CryptoSidePanelsProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-[1.7rem] border border-white/10 bg-[#08101d]/82 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/38">
              Large trades
            </p>
            <h3 className="mt-2 text-lg font-medium text-white">
              Великі виконані угоди
            </h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/58">
            {largeTrades.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {largeTrades.length ? (
            largeTrades.map((trade) => (
              <div
                key={trade.id}
                className={[
                  "rounded-[1.2rem] border px-4 py-3",
                  trade.side === "buy"
                    ? "border-emerald-300/12 bg-emerald-300/[0.08]"
                    : "border-red-300/12 bg-red-300/[0.08]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.22em]",
                      trade.side === "buy"
                        ? "border-emerald-300/18 bg-emerald-300/12 text-emerald-50"
                        : "border-red-300/18 bg-red-300/12 text-red-50",
                    ].join(" ")}
                  >
                    {trade.side === "buy" ? "BUY" : "SELL"}
                  </span>
                  <span className="text-sm font-medium text-white">
                    ${formatCompactNumber(trade.notional)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/56">
                  <span>{formatPrice(trade.price)}</span>
                  <span>{formatCompactNumber(trade.quantity)}</span>
                  <span>{formatTime(trade.time)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm leading-7 text-white/38">
              Щойно в стрім зайдуть великі угоди вище порогу, вони з’являться
              тут і відмітяться на графіку стрілками.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.7rem] border border-white/10 bg-[#08101d]/82 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/38">
              Order walls
            </p>
            <h3 className="mt-2 text-lg font-medium text-white">
              Сильні рівні в стакані
            </h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/58">
            {walls.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {walls.length ? (
            walls.map((wall) => (
              <div
                key={`${wall.side}-${wall.price}`}
                className={[
                  "rounded-[1.2rem] border px-4 py-3",
                  wall.side === "bid"
                    ? "border-emerald-300/12 bg-emerald-300/[0.08]"
                    : "border-red-300/12 bg-red-300/[0.08]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.22em]",
                      wall.side === "bid"
                        ? "border-emerald-300/18 bg-emerald-300/12 text-emerald-50"
                        : "border-red-300/18 bg-red-300/12 text-red-50",
                    ].join(" ")}
                  >
                    {wall.side === "bid" ? "BID wall" : "ASK wall"}
                  </span>
                  <span className="text-sm font-medium text-white">
                    ${formatCompactNumber(wall.notional)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/56">
                  <span>{formatPrice(wall.price)}</span>
                  <span>{formatCompactNumber(wall.quantity)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm leading-7 text-white/38">
              Після старту локального стакану тут з’являться найбільші стіни
              bid/ask, які можуть впливати на ціну.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
