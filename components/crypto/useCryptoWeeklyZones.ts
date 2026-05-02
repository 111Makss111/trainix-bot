"use client";

import { useEffect, useState } from "react";
import type { CryptoWeeklyZone } from "@/lib/crypto-zones";
import { buildClientWeeklyZonesSnapshot } from "./weekly-zones";
import type { MarketType, WeeklyZonesResponse } from "./types";

export function useCryptoWeeklyZones(marketType: MarketType, symbol: string) {
  const [weeklyZones, setWeeklyZones] = useState<CryptoWeeklyZone[]>([]);
  const [weeklyZonesWeekKey, setWeeklyZonesWeekKey] = useState<string | null>(
    null,
  );
  const [weeklyZonesGeneratedAt, setWeeklyZonesGeneratedAt] = useState<
    string | null
  >(null);
  const [weeklyZonesStatus, setWeeklyZonesStatus] = useState(
    "Готую weekly snapshot...",
  );
  const [weeklyZonesError, setWeeklyZonesError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWeeklyZones() {
      setWeeklyZonesError(null);
      setWeeklyZonesStatus("Оновлюю weekly snapshot...");

      try {
        const response = await fetch(
          `/api/crypto/zones?marketType=${encodeURIComponent(marketType)}&symbol=${encodeURIComponent(symbol)}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load weekly zones");
        }

        const payload = (await response.json()) as WeeklyZonesResponse;

        if (!active) {
          return;
        }

        setWeeklyZones(payload.zones);
        setWeeklyZonesWeekKey(payload.weekKey);
        setWeeklyZonesGeneratedAt(payload.generatedAt);
        setWeeklyZonesStatus(
          payload.zones.length
            ? `${payload.weekKey} · ${payload.zones.length} frozen zones готові`
            : "Weekly zones ще не зібрались",
        );
      } catch (loadError) {
        console.error(loadError);

        try {
          const fallbackPayload = await buildClientWeeklyZonesSnapshot(
            marketType,
            symbol,
          );

          if (!active) {
            return;
          }

          setWeeklyZones(fallbackPayload.zones);
          setWeeklyZonesWeekKey(fallbackPayload.weekKey);
          setWeeklyZonesGeneratedAt(fallbackPayload.generatedAt);
          setWeeklyZonesStatus(
            fallbackPayload.zones.length
              ? `${fallbackPayload.weekKey} · локальний frozen snapshot готовий`
              : "Weekly zones ще не зібрались",
          );
          setWeeklyZonesError(null);
        } catch (fallbackError) {
          console.error(fallbackError);

          if (!active) {
            return;
          }

          setWeeklyZones([]);
          setWeeklyZonesWeekKey(null);
          setWeeklyZonesGeneratedAt(null);
          setWeeklyZonesError(
            "Не вдалося побудувати weekly zones для цього активу.",
          );
          setWeeklyZonesStatus("Weekly snapshot тимчасово недоступний.");
        }
      }
    }

    void loadWeeklyZones();

    return () => {
      active = false;
    };
  }, [marketType, symbol]);

  return {
    weeklyZones,
    weeklyZonesWeekKey,
    weeklyZonesGeneratedAt,
    weeklyZonesStatus,
    weeklyZonesError,
  };
}
