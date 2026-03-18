import {
  disableTelegramWebhookAction,
  enableTelegramWebhookAction,
  updateTelegramSettingsAction,
  verifyTelegramSettingsAction,
} from "@/app/cabinet/web/actions";
import type { WebProject } from "@/lib/web-projects";

type WebTelegramCardProps = {
  project: WebProject;
  notice?: string;
};

const noticeMessages: Record<
  string,
  { tone: "success" | "error"; text: string }
> = {
  saved: {
    tone: "success",
    text: "Telegram-налаштування збережені.",
  },
  verified: {
    tone: "success",
    text: "Бот і чат успішно перевірені через Telegram API.",
  },
  missing: {
    tone: "error",
    text: "Для перевірки потрібно заповнити bot token і chat id.",
  },
  "invalid-token": {
    tone: "error",
    text: "Telegram не прийняв bot token. Перевір значення ще раз.",
  },
  "chat-not-found": {
    tone: "error",
    text: "Чат не знайдено. Перевір chat id і чи доданий бот у групу.",
  },
  "bot-no-access": {
    tone: "error",
    text: "Бот не має доступу до цього чату. Додай його в групу й дай потрібні права.",
  },
  "webhook-public-url": {
    tone: "error",
    text: "Для webhook потрібен публічний HTTPS URL. На localhost Telegram його не викличе.",
  },
  "webhook-enabled": {
    tone: "success",
    text: "Webhook увімкнено. Telegram тепер може надсилати апдейти в цей проєкт.",
  },
  "webhook-disabled": {
    tone: "success",
    text: "Webhook вимкнено. Telegram більше не надсилатиме апдейти в цей проєкт.",
  },
  "webhook-failed": {
    tone: "error",
    text: "Не вдалося встановити webhook. Перевір публічний HTTPS URL і дані бота.",
  },
  "webhook-not-confirmed": {
    tone: "error",
    text: "Telegram не підтвердив webhook на очікуваному URL. Перевір, що в env вказаний саме домен твого сайту, а не посилання на Telegram.",
  },
  failed: {
    tone: "error",
    text: "Не вдалося перевірити Telegram-підключення. Спробуй ще раз.",
  },
};

function formatDate(value: string | null) {
  if (!value) {
    return "Ще не перевірявся";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function WebTelegramCard({ project, notice }: WebTelegramCardProps) {
  const message = notice ? noticeMessages[notice] : null;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Telegram
          </p>
          <h3 className="mt-3 text-2xl font-medium text-white">
            Bot & Group
          </h3>
        </div>

        <span
          className={[
            "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em]",
            project.telegramLastVerifiedAt
              ? "border-emerald-300/18 bg-emerald-300/10 text-emerald-100"
              : "border-white/10 bg-white/[0.04] text-white/60",
          ].join(" ")}
        >
          {project.telegramLastVerifiedAt ? "Verified" : "Pending"}
        </span>
      </div>

      {message ? (
        <div
          className={[
            "mt-5 rounded-[1.3rem] border px-4 py-3 text-sm leading-6",
            message.tone === "success"
              ? "border-emerald-300/14 bg-emerald-300/[0.08] text-emerald-50"
              : "border-red-300/14 bg-red-300/[0.08] text-red-50",
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}

      <form className="mt-5 space-y-4">
        <input type="hidden" name="projectId" value={project.id} />

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-white/36">
              Bot token
            </span>
            <input
              name="botToken"
              type="password"
              defaultValue={project.telegramBotToken ?? ""}
              placeholder="123456:ABC..."
              className="rounded-[1.3rem] border border-white/10 bg-[#091122] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-white/36">
              Chat ID
            </span>
            <div className="grid gap-2">
              <input
                name="chatId"
                type="text"
                defaultValue={project.telegramChatId ?? ""}
                placeholder="-1001234567890 або @Trainix_app"
                className="rounded-[1.3rem] border border-white/10 bg-[#091122] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
              />
              <p className="text-xs leading-6 text-white/38">
                Для публічної групи або каналу можна вказати `@username`. Для
                супергрупи часто потрібен числовий id у форматі `-100...`.
              </p>
            </div>
          </label>
        </div>

        <label className="flex items-center gap-3 rounded-[1.3rem] border border-white/10 bg-[#091122] px-4 py-3">
          <input
            name="smartRepliesEnabled"
            type="checkbox"
            defaultChecked={project.smartRepliesEnabled}
            className="h-4 w-4 rounded border-white/20 bg-transparent text-white"
          />
          <span>
            <span className="block text-sm font-medium text-white/86">
              Smart replies
            </span>
            <span className="mt-1 block text-sm leading-6 text-white/44">
              Якщо ввімкнено, бот зможе відповідати клієнтам після підключення
              webhook і AI-провайдера.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            formAction={updateTelegramSettingsAction}
            className="rounded-full border border-white/14 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/88 transition hover:bg-white/12"
          >
            Зберегти Telegram
          </button>
          <button
            type="submit"
            formAction={verifyTelegramSettingsAction}
            className="rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))]"
          >
            Перевірити підключення
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-3">
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Bot identity</span>
          <span className="text-sm font-medium text-white/84">
            {project.telegramBotUsername
              ? `@${project.telegramBotUsername}`
              : project.telegramBotName || "Ще не перевірено"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Group binding</span>
          <span className="text-sm font-medium text-white/84">
            {project.telegramChatTitle || project.telegramChatId || "Ще не задано"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Privacy mode</span>
          <span className="text-sm font-medium text-white/84">
            {project.telegramCanReadAllGroupMessages
              ? "Розширене читання доступне"
              : "Поки стандартний режим"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Last verify</span>
          <span className="text-sm font-medium text-white/84">
            {formatDate(project.telegramLastVerifiedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Webhook</span>
          <span className="text-sm font-medium text-white/84">
            {project.telegramWebhookEnabled ? "Увімкнено" : "Вимкнено"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Webhook URL</span>
          <span className="max-w-[18rem] truncate text-sm font-medium text-white/84">
            {project.telegramWebhookUrl || "Ще не встановлено"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <form action={enableTelegramWebhookAction}>
          <input type="hidden" name="projectId" value={project.id} />
          <button
            type="submit"
            className="rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))]"
          >
            Увімкнути webhook
          </button>
        </form>

        <form action={disableTelegramWebhookAction}>
          <input type="hidden" name="projectId" value={project.id} />
          <button
            type="submit"
            className="rounded-full border border-white/14 bg-white/6 px-4 py-2.5 text-sm font-medium text-white/84 transition hover:bg-white/10"
          >
            Вимкнути webhook
          </button>
        </form>
      </div>

      <p className="mt-5 text-sm leading-7 text-white/56">
        Бот API Telegram працює через HTTPS запити на кшталт
        `https://api.telegram.org/bot&lt;token&gt;/METHOD`, а для живих апдейтів
        вебхук потребує HTTPS URL саме твого застосунку або tunnel. Посилання на
        групу `t.me/...` сюди не підходить, бо це не серверний endpoint. Тепер
        цей проєкт уже вміє приймати апдейти в окремий route і складати їх у
        журнал повідомлень.
      </p>
    </section>
  );
}
