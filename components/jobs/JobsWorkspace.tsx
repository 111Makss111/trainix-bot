"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  refreshJobLeadsAction,
  regenerateJobLeadProposalAction,
  saveJobHuntSettingsAction,
  sendJobTelegramTestAction,
  updateJobLeadStatusAction,
  verifyJobTelegramConnectionAction,
} from "@/app/cabinet/jobs/actions";
import { CabinetTopbar } from "@/components/cabinet";
import { CopyTextButton } from "@/components/social/shared/CopyTextButton";
import type { JobHuntSettings, JobLead, JobLeadStatus } from "@/lib/jobs";
import type { TelegramBotInfo, TelegramChatInfo } from "@/lib/telegram";

type JobsWorkspaceProps = {
  initialSettings: JobHuntSettings;
  initialLeads: JobLead[];
  cronSecretConfigured: boolean;
};

type TelegramVerificationState = {
  bot: TelegramBotInfo;
  chat: TelegramChatInfo;
};

type JobsTab = "leads" | "history" | "settings";

const jobsTabs: Array<{ value: JobsTab; label: string }> = [
  { value: "leads", label: "Ліди" },
  { value: "history", label: "Історія" },
  { value: "settings", label: "Налаштування" },
];

function formatDate(value: string | null) {
  if (!value) {
    return "Щойно";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function leadStatusLabel(status: JobLeadStatus) {
  switch (status) {
    case "reviewed":
      return "Переглянуто";
    case "applied":
      return "Відгукнувся";
    case "ignored":
      return "Пропущено";
    default:
      return "Нове";
  }
}

function leadStatusClass(status: JobLeadStatus) {
  switch (status) {
    case "reviewed":
      return "border-sky-300/16 bg-sky-300/10 text-sky-50";
    case "applied":
      return "border-emerald-300/16 bg-emerald-300/10 text-emerald-50";
    case "ignored":
      return "border-white/10 bg-white/[0.04] text-white/58";
    default:
      return "border-amber-300/16 bg-amber-300/10 text-amber-50";
  }
}

function upsertLead(leads: JobLead[], nextLead: JobLead) {
  const next = [nextLead, ...leads.filter((lead) => lead.id !== nextLead.id)];

  return next.sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function replaceLeads(_current: JobLead[], nextLeads: JobLead[]) {
  return [...nextLeads].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function LeadCard({
  lead,
  isPending,
  onStatusChange,
  onRegenerateProposal,
}: {
  lead: JobLead;
  isPending: boolean;
  onStatusChange: (lead: JobLead, status: JobLeadStatus) => void;
  onRegenerateProposal: (lead: JobLead) => void;
}) {
  return (
    <article className="rounded-[1.7rem] border border-white/10 bg-[#08111e]/78 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/58">
              {lead.sourceLabel}
            </span>
            <span
              className={[
                "rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em]",
                leadStatusClass(lead.status),
              ].join(" ")}
            >
              {leadStatusLabel(lead.status)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/58">
              Score {lead.score}/100
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-medium text-white">{lead.title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">
            {lead.summary}
          </p>
        </div>

        <a
          href={lead.link}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/82 transition hover:bg-white/[0.08]"
        >
          Відкрити задачу
        </a>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)]">
        <section className="rounded-[1.3rem] border border-white/8 bg-black/10 p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase tracking-[0.2em] text-white/34">
            <span>Опубліковано {formatDate(lead.publishedAt)}</span>
            {lead.budgetText ? <span>Бюджет {lead.budgetText}</span> : null}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-white/34">
                Чому це підходить
              </p>
              <p className="mt-2 text-sm leading-7 text-white/72">
                {lead.matchReason}
              </p>
            </div>

            {lead.categories.length ? (
              <div className="flex flex-wrap gap-2">
                {lead.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-white/58"
                  >
                    {category}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {lead.status !== "reviewed" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onStatusChange(lead, "reviewed")}
                className="rounded-full border border-sky-300/16 bg-sky-300/10 px-4 py-2 text-sm font-medium text-sky-50 transition hover:bg-sky-300/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Позначити як переглянуту
              </button>
            ) : null}
            {lead.status !== "applied" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onStatusChange(lead, "applied")}
                className="rounded-full border border-emerald-300/16 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Відгукнувся
              </button>
            ) : null}
            {lead.status !== "ignored" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onStatusChange(lead, "ignored")}
                className="rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-white/62 transition hover:border-red-300/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Пропустити
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-[1.3rem] border border-white/8 bg-black/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-white/34">
                Готовий текст відповіді
              </p>
              <p className="mt-1 text-sm text-white/44">
                Скопіюй і відправ замовнику першим, поки задача ще свіжа.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyTextButton text={lead.proposalText || ""} idleLabel="Скопіювати текст" />
              <button
                type="button"
                disabled={isPending}
                onClick={() => onRegenerateProposal(lead)}
                className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white/68 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Оновити текст
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[1.1rem] border border-white/8 bg-[#050b16] p-4 text-sm leading-7 text-white/74">
            <p className="whitespace-pre-wrap">
              {lead.proposalText || "Текст відповіді ще не згенеровано."}
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}

export function JobsWorkspace({
  initialSettings,
  initialLeads,
  cronSecretConfigured,
}: JobsWorkspaceProps) {
  const settingsFormRef = useRef<HTMLFormElement | null>(null);
  const [activeTab, setActiveTab] = useState<JobsTab>("leads");
  const [settings, setSettings] = useState(initialSettings);
  const [leads, setLeads] = useState(initialLeads);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [telegramVerification, setTelegramVerification] =
    useState<TelegramVerificationState | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [isSavingSettings, startSaveSettings] = useTransition();
  const [isLeadActionPending, startLeadAction] = useTransition();
  const [isTestingTelegram, startTelegramTest] = useTransition();
  const [isVerifyingTelegram, startTelegramVerify] = useTransition();

  const activeLeads = useMemo(
    () => leads.filter((lead) => lead.status === "new" || lead.status === "reviewed"),
    [leads],
  );
  const historyLeads = useMemo(
    () => leads.filter((lead) => lead.status === "applied" || lead.status === "ignored"),
    [leads],
  );

  function handleRefresh() {
    setFeedback(null);
    startRefresh(async () => {
      const result = await refreshJobLeadsAction();

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      setSettings(result.settings);
      setLeads(replaceLeads([], result.leads));
      setFeedback(result.message ?? null);
      setActiveTab("leads");
    });
  }

  function handleSaveSettings(formData: FormData) {
    setFeedback(null);
    startSaveSettings(async () => {
      const result = await saveJobHuntSettingsAction({
        sourceFreelancehuntEnabled:
          formData.get("sourceFreelancehuntEnabled") === "on",
        autoScanEnabled: formData.get("autoScanEnabled") === "on",
        scanIntervalMinutes: Number(formData.get("scanIntervalMinutes") || 5),
        maxLeadsPerRun: Number(formData.get("maxLeadsPerRun") || 8),
        includeKeywordsText: String(formData.get("includeKeywordsText") || ""),
        excludeKeywordsText: String(formData.get("excludeKeywordsText") || ""),
        telegramAlertsEnabled: formData.get("telegramAlertsEnabled") === "on",
        telegramBotToken: String(formData.get("telegramBotToken") || ""),
        telegramChatId: String(formData.get("telegramChatId") || ""),
      });

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      setSettings(result.settings);
      setTelegramVerification(null);
      setFeedback(result.message ?? null);
    });
  }

  function handleStatusChange(lead: JobLead, status: JobLeadStatus) {
    setFeedback(null);
    setPendingLeadId(lead.id);
    startLeadAction(async () => {
      const result = await updateJobLeadStatusAction({
        leadId: lead.id,
        status,
      });

      setPendingLeadId(null);

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      setLeads((current) => upsertLead(current, result.lead));
    });
  }

  function handleRegenerateProposal(lead: JobLead) {
    setFeedback(null);
    setPendingLeadId(lead.id);
    startLeadAction(async () => {
      const result = await regenerateJobLeadProposalAction({
        leadId: lead.id,
      });

      setPendingLeadId(null);

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      setLeads((current) => upsertLead(current, result.lead));
      setFeedback(result.message ?? null);
    });
  }

  function handleTelegramTest() {
    const form = settingsFormRef.current;

    if (!form) {
      setFeedback("Форма налаштувань поки недоступна. Спробуй ще раз.");
      return;
    }

    const formData = new FormData(form);
    const telegramBotToken = String(formData.get("telegramBotToken") || "").trim();
    const telegramChatId = String(formData.get("telegramChatId") || "").trim();

    setFeedback(null);
    startTelegramTest(async () => {
      const result = await sendJobTelegramTestAction({
        telegramBotToken,
        telegramChatId,
      });

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      setFeedback(result.message);
    });
  }

  function handleTelegramVerify() {
    const form = settingsFormRef.current;

    if (!form) {
      setFeedback("Форма налаштувань поки недоступна. Спробуй ще раз.");
      return;
    }

    const formData = new FormData(form);
    const telegramBotToken = String(formData.get("telegramBotToken") || "").trim();
    const telegramChatId = String(formData.get("telegramChatId") || "").trim();

    setFeedback(null);
    startTelegramVerify(async () => {
      const result = await verifyJobTelegramConnectionAction({
        telegramBotToken,
        telegramChatId,
      });

      if (!result.ok) {
        setTelegramVerification(null);
        setFeedback(result.error);
        return;
      }

      setTelegramVerification({
        bot: result.bot,
        chat: result.chat,
      });
      setFeedback(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <CabinetTopbar
        eyebrow="Jobs Radar"
        title="Пошук замовлень"
        description="Один модуль, який ловить прості фронтенд-замовлення, фільтрує шум, готує текст відповіді й може штовхати гарячі ліди в Telegram."
      />

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-[#08111e]/78 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                Джерело
              </p>
              <p className="mt-3 text-lg font-medium text-white">
                Freelancehunt RSS
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-[#08111e]/78 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                Останнє сканування
              </p>
              <p className="mt-3 text-lg font-medium text-white">
                {formatDate(settings.lastScanAt)}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-[#08111e]/78 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                Активні ліди
              </p>
              <p className="mt-3 text-lg font-medium text-white">{activeLeads.length}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={handleRefresh}
            className="rounded-full border border-sky-300/18 bg-sky-300/12 px-5 py-3 text-sm font-medium text-sky-50 transition hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? "Оновлюю стрічку..." : "Знайти нові задачі"}
          </button>
        </div>

        <div className="mt-5 grid gap-2 rounded-[1.2rem] border border-white/10 bg-[#091122]/64 p-2 md:grid-cols-3">
          {jobsTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={[
                "rounded-[1rem] border px-4 py-3 text-sm transition",
                activeTab === tab.value
                  ? "border-sky-300/20 bg-sky-300/[0.12] text-white"
                  : "border-white/8 bg-transparent text-white/58 hover:border-white/14 hover:text-white/88",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {feedback ? (
          <div className="mt-5 rounded-[1.2rem] border border-amber-300/14 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-50/92">
            {feedback}
          </div>
        ) : null}

        <div className="mt-6">
          {activeTab === "settings" ? (
            <form
              ref={settingsFormRef}
              className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveSettings(new FormData(event.currentTarget));
              }}
            >
              <section className="rounded-[1.6rem] border border-white/10 bg-[#08111e]/78 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Scanner
                    </p>
                    <h3 className="mt-3 text-xl font-medium text-white">
                      Налаштування пошуку
                    </h3>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="flex items-center gap-3 rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/78">
                    <input
                      type="checkbox"
                      name="sourceFreelancehuntEnabled"
                      defaultChecked={settings.sourceFreelancehuntEnabled}
                      className="h-4 w-4 rounded border-white/20 bg-transparent text-sky-400"
                    />
                    Увімкнути офіційний Freelancehunt RSS
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                        Інтервал автоскану
                      </span>
                      <select
                        name="scanIntervalMinutes"
                        defaultValue={settings.scanIntervalMinutes}
                        className="h-12 w-full rounded-[1.1rem] border border-white/10 bg-[#091327] px-4 text-sm text-white outline-none"
                      >
                        {[1, 5, 10, 15, 30, 60].map((minutes) => (
                          <option key={minutes} value={minutes}>
                            Кожні {minutes} хв
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                        Скільки lead-ів брати за раз
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        name="maxLeadsPerRun"
                        defaultValue={settings.maxLeadsPerRun}
                        className="h-12 w-full rounded-[1.1rem] border border-white/10 bg-[#091327] px-4 text-sm text-white outline-none"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-3 rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/78">
                    <input
                      type="checkbox"
                      name="autoScanEnabled"
                      defaultChecked={settings.autoScanEnabled}
                      className="h-4 w-4 rounded border-white/20 bg-transparent text-sky-400"
                    />
                    Дозволити фонового сканера через cron
                  </label>

                  <div className="rounded-[1.1rem] border border-white/8 bg-black/10 px-4 py-3 text-sm leading-6 text-white/54">
                    <p>
                      {cronSecretConfigured
                        ? "Cron route уже готовий, але зовнішній scheduler ще треба підключити окремо."
                        : "CRON_SECRET ще не заданий, тому фоновий сканер поки не зможе стартувати."}
                    </p>
                    <p className="mt-2 text-white/38">
                      Кнопка `Знайти нові задачі` вже працює вручну. Для повного автоскану треба окремо під’єднати cron-job.org або Vercel Cron.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.6rem] border border-white/10 bg-[#08111e]/78 p-5">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                  Telegram
                </p>
                <h3 className="mt-3 text-xl font-medium text-white">
                  Додаткові сповіщення
                </h3>

                <div className="mt-5 space-y-4">
                  <label className="flex items-center gap-3 rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/78">
                    <input
                      type="checkbox"
                      name="telegramAlertsEnabled"
                      defaultChecked={settings.telegramAlertsEnabled}
                      className="h-4 w-4 rounded border-white/20 bg-transparent text-sky-400"
                    />
                    Надсилати нові ліди в Telegram
                  </label>

                  <label className="space-y-2">
                    <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Telegram Bot Token
                    </span>
                    <input
                      type="password"
                      name="telegramBotToken"
                      defaultValue={settings.telegramBotToken ?? ""}
                      className="h-12 w-full rounded-[1.1rem] border border-white/10 bg-[#091327] px-4 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Chat ID
                    </span>
                    <input
                      type="text"
                      name="telegramChatId"
                      defaultValue={settings.telegramChatId ?? ""}
                      className="h-12 w-full rounded-[1.1rem] border border-white/10 bg-[#091327] px-4 text-sm text-white outline-none"
                    />
                  </label>

                  <div className="rounded-[1.1rem] border border-white/8 bg-black/10 px-4 py-3 text-sm leading-6 text-white/54">
                    <p>
                      Тут використовується звичайний Telegram-бот. Ми не створюємо його автоматично: потрібен bot token від @BotFather і chat id чату, куди надсилати ліди.
                    </p>
                  </div>

                  {telegramVerification ? (
                    <div className="rounded-[1.1rem] border border-emerald-300/16 bg-emerald-300/[0.08] px-4 py-3 text-sm leading-6 text-emerald-50/90">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-emerald-100/58">
                        Telegram verified
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-emerald-100/48">
                            Bot identity
                          </p>
                          <p className="mt-2 font-medium text-white">
                            {telegramVerification.bot.username
                              ? `@${telegramVerification.bot.username}`
                              : telegramVerification.bot.first_name}
                          </p>
                          <p className="mt-1 text-white/58">
                            {telegramVerification.bot.first_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-emerald-100/48">
                            Chat binding
                          </p>
                          <p className="mt-2 font-medium text-white">
                            {telegramVerification.chat.title ||
                              telegramVerification.chat.username ||
                              telegramVerification.chat.id}
                          </p>
                          <p className="mt-1 text-white/58">
                            {telegramVerification.chat.type} · {telegramVerification.chat.id}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      disabled={isVerifyingTelegram}
                      onClick={handleTelegramVerify}
                      className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/88 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isVerifyingTelegram
                        ? "Перевіряю Telegram..."
                        : "Verify Telegram connection"}
                    </button>
                    <button
                      type="button"
                      disabled={isTestingTelegram || isVerifyingTelegram}
                      onClick={handleTelegramTest}
                      className="rounded-full border border-sky-300/18 bg-sky-300/12 px-5 py-3 text-sm font-medium text-sky-50 transition hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isTestingTelegram ? "Надсилаю тест..." : "Надіслати тест у Telegram"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.6rem] border border-white/10 bg-[#08111e]/78 p-5 xl:col-span-2">
                <div className="grid gap-4 xl:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Потрібні сигнали
                    </span>
                    <textarea
                      name="includeKeywordsText"
                      rows={10}
                      defaultValue={settings.includeKeywordsText}
                      className="w-full resize-none rounded-[1.2rem] border border-white/10 bg-[#091327] px-4 py-4 text-sm leading-7 text-white outline-none"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Відсікти шум
                    </span>
                    <textarea
                      name="excludeKeywordsText"
                      rows={10}
                      defaultValue={settings.excludeKeywordsText}
                      className="w-full resize-none rounded-[1.2rem] border border-white/10 bg-[#091327] px-4 py-4 text-sm leading-7 text-white outline-none"
                    />
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="rounded-full border border-white/14 bg-white/8 px-5 py-3 text-sm font-medium text-white/88 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingSettings ? "Зберігаю..." : "Зберегти налаштування"}
                  </button>
                </div>
              </section>
            </form>
          ) : activeTab === "history" ? (
            historyLeads.length ? (
              <div className="space-y-4">
                {historyLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isPending={isLeadActionPending && pendingLeadId === lead.id}
                    onStatusChange={handleStatusChange}
                    onRegenerateProposal={handleRegenerateProposal}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-[#08111e]/78 px-6 py-14 text-center text-sm leading-7 text-white/40">
                Історія ще порожня. Коли почнеш відгукуватися або відмічати ліди як пропущені, тут з’явиться хронологія.
              </div>
            )
          ) : activeLeads.length ? (
            <div className="space-y-4">
              {activeLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isPending={isLeadActionPending && pendingLeadId === lead.id}
                  onStatusChange={handleStatusChange}
                  onRegenerateProposal={handleRegenerateProposal}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-[#08111e]/78 px-6 py-14 text-center text-sm leading-7 text-white/40">
              Поки що немає активних lead-ів. Натисни `Знайти нові задачі`, і ми підтягнемо свіжі замовлення з офіційного Freelancehunt RSS.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
