import type { CryptoWeeklyZone } from "@/lib/crypto-zones";
import type { LargeTrade, OrderWall } from "./types";
import {
  formatCompactNumber,
  formatDistancePercent,
  formatPrice,
  formatTime,
} from "./format";
import {
  getZoneColor,
  getZoneStatusLabel,
} from "./weekly-zones";

type CryptoSidePanelsProps = {
  weeklyZones: CryptoWeeklyZone[];
  weeklyZonesWeekKey: string | null;
  weeklyZonesGeneratedAt: string | null;
  weeklyZonesStatus: string;
  weeklyZonesError: string | null;
  largeTrades: LargeTrade[];
  walls: OrderWall[];
};

export function CryptoSidePanels({
  weeklyZones,
  weeklyZonesWeekKey,
  weeklyZonesGeneratedAt,
  weeklyZonesStatus,
  weeklyZonesError,
  largeTrades,
  walls,
}: CryptoSidePanelsProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-[1.7rem] border border-white/10 bg-[#08101d]/82 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/38">
              Weekly zones
            </p>
            <h3 className="mt-2 text-lg font-medium text-white">
              Тижневі зони
            </h3>
            <p className="mt-1 text-sm leading-6 text-white/40">
              Frozen-рівні на тиждень, які не рухаються щохвилини.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/58">
            {weeklyZones.length}
          </span>
        </div>

        <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
          <p className="text-xs leading-6 text-white/46">
            {weeklyZonesStatus}
          </p>
          {weeklyZonesWeekKey ? (
            <p className="mt-2 text-[0.72rem] uppercase tracking-[0.18em] text-white/32">
              {weeklyZonesWeekKey}
              {weeklyZonesGeneratedAt
                ? ` · snapshot ${new Date(weeklyZonesGeneratedAt).toLocaleDateString("uk-UA")}`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {weeklyZones.length ? (
            weeklyZones.map((zone) => (
              <div
                key={zone.id}
                className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: getZoneColor(zone) }}
                      />
                      <span className="text-sm font-medium text-white">
                        {zone.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-white/44">
                      {zone.zoneKind === "interest"
                        ? "Зона інтересу, де ринок уже реагував."
                        : zone.zoneKind === "zero_trend"
                          ? "Боковик або слабкий тренд без чіткого напрямку."
                          : "Тригерна зона для можливого імпульсного виходу."}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-white/64">
                    {getZoneStatusLabel(zone.status)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-[0.64rem] uppercase tracking-[0.18em] text-white/30">
                      Діапазон
                    </p>
                    <p className="mt-1 text-sm text-white/72">
                      {formatPrice(zone.priceFrom)} -{" "}
                      {formatPrice(zone.priceTo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.64rem] uppercase tracking-[0.18em] text-white/30">
                      Distance
                    </p>
                    <p className="mt-1 text-sm text-white/72">
                      {formatDistancePercent(zone.distancePercent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.64rem] uppercase tracking-[0.18em] text-white/30">
                      Confidence
                    </p>
                    <p className="mt-1 text-sm text-white/72">
                      {zone.confidence}/100
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : weeklyZonesError ? (
            <div className="rounded-[1.2rem] border border-red-300/14 bg-red-300/[0.08] px-4 py-6 text-sm leading-7 text-red-50/88">
              {weeklyZonesError}
            </div>
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm leading-7 text-white/38">
              Після побудови тижневого snapshot тут з’являться frozen zones зі
              статусами.
            </div>
          )}
        </div>
      </div>

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
