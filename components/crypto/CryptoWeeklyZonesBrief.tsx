import type { CryptoWeeklyZone } from "@/lib/crypto-zones";
import type { MarketType } from "./types";
import { formatDistancePercent, formatPrice } from "./format";
import {
  getZoneColor,
  getZoneStatusLabel,
} from "./weekly-zones";

type CryptoWeeklyZonesBriefProps = {
  marketType: MarketType;
  symbol: string;
  weeklyZones: CryptoWeeklyZone[];
  weeklyZonesWeekKey: string | null;
  weeklyZonesGeneratedAt: string | null;
  weeklyZonesStatus: string;
  weeklyZonesError: string | null;
};

export function CryptoWeeklyZonesBrief({
  marketType,
  symbol,
  weeklyZones,
  weeklyZonesWeekKey,
  weeklyZonesGeneratedAt,
  weeklyZonesStatus,
  weeklyZonesError,
}: CryptoWeeklyZonesBriefProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(67,255,130,0.1),transparent_34%),rgba(255,255,255,0.03)] p-4 backdrop-blur-md sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/42">
            Weekly zones / {marketType === "spot" ? "Spot" : "Futures"}
          </p>
          <h1 className="mt-3 text-2xl font-medium text-white sm:text-3xl">
            {symbol} frozen map
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
            {weeklyZonesStatus}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-white/54">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            {weeklyZones.length} zones
          </span>
          {weeklyZonesWeekKey ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              {weeklyZonesWeekKey}
            </span>
          ) : null}
          {weeklyZonesGeneratedAt ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              {new Date(weeklyZonesGeneratedAt).toLocaleDateString("uk-UA")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        {weeklyZones.length ? (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
            {weeklyZones.map((zone) => (
              <article
                key={zone.id}
                className="group relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#08101d]/76 p-4 transition hover:border-white/18 hover:bg-[#0b1526]"
              >
                <span
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ backgroundColor: getZoneColor(zone) }}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getZoneColor(zone) }}
                      />
                      <h2 className="truncate text-sm font-medium text-white">
                        {zone.label}
                      </h2>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/42">
                      {zone.zoneKind === "interest"
                        ? "Зона інтересу, де ринок уже реагував."
                        : zone.zoneKind === "zero_trend"
                          ? "Боковик або слабкий тренд без чіткого напрямку."
                          : "Тригерна зона для можливого імпульсного виходу."}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.58rem] uppercase tracking-[0.16em] text-white/60">
                    {getZoneStatusLabel(zone.status)}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-xs">
                  <div>
                    <dt className="uppercase tracking-[0.18em] text-white/28">
                      Діапазон
                    </dt>
                    <dd className="mt-1 font-medium text-white/78">
                      {formatPrice(zone.priceFrom)} -{" "}
                      {formatPrice(zone.priceTo)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="uppercase tracking-[0.18em] text-white/28">
                        Distance
                      </dt>
                      <dd className="mt-1 font-medium text-white/72">
                        {formatDistancePercent(zone.distancePercent)}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-[0.18em] text-white/28">
                        Confidence
                      </dt>
                      <dd className="mt-1 font-medium text-white/72">
                        {zone.confidence}/100
                      </dd>
                    </div>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : weeklyZonesError ? (
          <div className="rounded-[1.2rem] border border-red-300/14 bg-red-300/[0.08] px-4 py-5 text-sm leading-7 text-red-50/88">
            {weeklyZonesError}
          </div>
        ) : (
          <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm leading-7 text-white/42">
            Після побудови тижневого snapshot тут з’явиться карта frozen zones.
          </div>
        )}
      </div>
    </section>
  );
}
