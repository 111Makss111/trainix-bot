"use client";

import { useEffect, useMemo, useState } from "react";
import type { TelegramMessageLog } from "@/lib/web-projects";

type WebTelegramMessagesProps = {
  initialMessages: TelegramMessageLog[];
  projectId: string;
  webhookEnabled: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSyncTime(value: string | null) {
  if (!value) {
    return "Ще не синхронізовано";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function WebTelegramMessages({
  initialMessages,
  projectId,
  webhookEnabled,
}: WebTelegramMessagesProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [syncState, setSyncState] = useState<
    "live" | "syncing" | "paused" | "error"
  >(webhookEnabled ? "live" : "paused");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initialMessages[0]?.receivedAt ?? null,
  );

  useEffect(() => {
    setMessages(initialMessages);
    setSyncState(webhookEnabled ? "live" : "paused");
    setLastSyncedAt(initialMessages[0]?.receivedAt ?? null);
  }, [initialMessages, webhookEnabled, projectId]);

  useEffect(() => {
    if (!webhookEnabled) {
      setSyncState("paused");
      return;
    }

    let disposed = false;
    let inFlight = false;

    const refreshMessages = async () => {
      if (inFlight || document.visibilityState === "hidden") {
        return;
      }

      inFlight = true;
      setSyncState("syncing");

      try {
        const response = await fetch(
          `/api/cabinet/web/projects/${projectId}/messages?limit=20`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }

        const data = (await response.json()) as {
          messages?: TelegramMessageLog[];
          refreshedAt?: string;
        };

        if (disposed) {
          return;
        }

        setMessages(data.messages ?? []);
        setLastSyncedAt(data.refreshedAt ?? new Date().toISOString());
        setSyncState("live");
      } catch {
        if (!disposed) {
          setSyncState("error");
        }
      } finally {
        inFlight = false;
      }
    };

    void refreshMessages();
    const intervalId = window.setInterval(() => {
      void refreshMessages();
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshMessages();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [projectId, webhookEnabled]);

  const syncBadge = useMemo(() => {
    if (!webhookEnabled) {
      return {
        label: "Webhook off",
        className: "border-white/10 bg-white/[0.04] text-white/46",
      };
    }

    if (syncState === "error") {
      return {
        label: "Sync error",
        className: "border-red-300/16 bg-red-300/[0.08] text-red-100",
      };
    }

    if (syncState === "syncing") {
      return {
        label: "Syncing",
        className: "border-sky-300/16 bg-sky-300/[0.08] text-sky-100",
      };
    }

    return {
      label: "Live",
      className: "border-emerald-300/16 bg-emerald-300/[0.08] text-emerald-100",
    };
  }, [syncState, webhookEnabled]);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Inbox
          </p>
          <h3 className="mt-3 text-2xl font-medium text-white">
            Останні вхідні повідомлення
          </h3>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={[
              "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em]",
              syncBadge.className,
            ].join(" ")}
          >
            {syncBadge.label}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/46">
            {messages.length} recent
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/60 px-4 py-3 text-sm text-white/46">
        <p>Панель оновлюється автоматично кожні 5 секунд і показує лише останні 20 повідомлень.</p>
        <p>Остання синхронізація: {formatSyncTime(lastSyncedAt)}</p>
      </div>

      {messages.length ? (
        <div className="mt-5 max-h-[34rem] overflow-y-auto pr-1">
          <div className="grid gap-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className="rounded-[1.5rem] border border-white/8 bg-[#091122]/72 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white/88">
                      {message.senderName || "Unknown sender"}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/32">
                      {message.updateType}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/32">
                      {formatDate(message.receivedAt)}
                    </p>
                    <p className="mt-1 text-xs text-white/42">
                      chat {message.telegramChatId || "unknown"}
                    </p>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/72">
                  {message.text || "Повідомлення без тексту"}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-[#091122]/58 px-5 py-8 text-sm leading-7 text-white/40">
          Ще немає жодного вхідного повідомлення. Після активації webhook тут
          з’явиться журнал апдейтів із Telegram.
        </div>
      )}
    </section>
  );
}
