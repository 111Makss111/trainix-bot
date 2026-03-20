import {
  clearFacebookPageConnectionAction,
  saveFacebookPageConnectionAction,
  verifyFacebookPageConnectionAction,
} from "@/app/cabinet/facebook/actions";
import { SocialPendingState } from "@/components/social/shared/SocialPendingState";
import { SocialSubmitButton } from "@/components/social/shared/SocialSubmitButton";
import type {
  FacebookPageConnection,
  FacebookWorkspaceTab,
} from "@/lib/social/facebook";

type FacebookConnectionCardProps = {
  connection: FacebookPageConnection | null;
  activeTab: FacebookWorkspaceTab;
  notice?: string;
};

const noticeMessages: Record<
  string,
  { tone: "success" | "warning" | "error"; text: string }
> = {
  "connection-saved": {
    tone: "success",
    text: "Facebook Page credentials збережено. Тепер можеш зробити verify і перевірити, що сторінка відповідає саме цьому token.",
  },
  "connection-verified": {
    tone: "success",
    text: "Facebook Page успішно перевірено. Тепер драфти можна відправляти однією кнопкою прямо з вкладки Drafts.",
  },
  "connection-cleared": {
    tone: "success",
    text: "Facebook Page connection прибрано з кабінету.",
  },
  "connection-invalid": {
    tone: "error",
    text: "Для Facebook connection потрібні page id і page access token. Якщо token уже збережений, його можна не вставляти повторно.",
  },
  "connection-verify-failed": {
    tone: "error",
    text: "Meta не підтвердила цю сторінку або token. Перевір, чи це саме Page access token і чи page id правильний.",
  },
};

function formatDate(value: string | null) {
  if (!value) {
    return "Ще не перевірялось";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FacebookConnectionCard({
  connection,
  activeTab,
  notice,
}: FacebookConnectionCardProps) {
  const message = notice ? noticeMessages[notice] : null;
  const isReady = Boolean(connection?.pageId && connection.hasPageAccessToken);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Facebook
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">
            Page Connection
          </h2>
        </div>

        <span
          className={[
            "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em]",
            isReady
              ? "border-emerald-300/20 bg-emerald-300/[0.12] text-emerald-50"
              : "border-white/10 bg-white/[0.04] text-white/60",
          ].join(" ")}
        >
          {isReady ? "Connected" : "Draft mode"}
        </span>
      </div>

      {message ? (
        <div
          className={[
            "mt-5 rounded-[1.3rem] border px-4 py-3 text-sm leading-6",
            message.tone === "success"
              ? "border-emerald-300/14 bg-emerald-300/[0.08] text-emerald-50"
              : message.tone === "warning"
                ? "border-amber-300/16 bg-amber-300/[0.09] text-amber-50"
                : "border-red-300/14 bg-red-300/[0.08] text-red-50",
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}

      <form className="mt-5 space-y-4">
        <input type="hidden" name="tab" value={activeTab} />

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.24em] text-white/36">
            Facebook Page ID
          </span>
          <input
            type="text"
            name="pageId"
            defaultValue={connection?.pageId || ""}
            placeholder="615xxxxxxxxxxxx або інший page id"
            className="h-12 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.24em] text-white/36">
            Page access token
          </span>
          <input
            type="password"
            name="pageAccessToken"
            placeholder={
              connection?.hasPageAccessToken
                ? "Token already saved. Встав новий тільки якщо хочеш оновити."
                : "EAAG..."
            }
            className="h-12 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
          />
        </label>

        <div className="rounded-[1.5rem] border border-white/8 bg-[#091122]/60 px-4 py-4 text-sm leading-7 text-white/52">
          У цій v1 ми працюємо через manual Page connection. Збережи `page id`
          і `page access token`, а потім натисни `Verify connection`, щоб Meta
          повернула реальну назву сторінки, категорію та підтвердила доступ.
        </div>

        <div className="flex flex-wrap gap-3">
          <SocialSubmitButton
            formAction={saveFacebookPageConnectionAction}
            idleLabel="Зберегти connection"
            pendingLabel="Зберігаю..."
            className="rounded-full border border-white/14 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
          />
          <SocialSubmitButton
            formAction={verifyFacebookPageConnectionAction}
            idleLabel="Verify connection"
            pendingLabel="Перевіряю..."
            className="rounded-full border border-sky-300/18 bg-sky-300/12 px-4 py-2.5 text-sm font-medium text-sky-50 transition hover:bg-sky-300/18"
          />
        </div>

        <SocialPendingState label="Працюю з Facebook Page connection." />
      </form>

      {connection ? (
        <div className="mt-6 rounded-[1.6rem] border border-white/8 bg-[#091122]/72 p-4">
          <div className="flex items-center gap-4">
            <div
              className="h-14 w-14 shrink-0 rounded-[1.1rem] border border-white/10 bg-white/[0.04] bg-cover bg-center"
              style={
                connection.pagePictureUrl
                  ? {
                      backgroundImage: `url("${connection.pagePictureUrl}")`,
                    }
                  : undefined
              }
            />

            <div className="min-w-0">
              <p className="truncate text-lg font-medium text-white">
                {connection.pageName || "Facebook Page ще не верифікована"}
              </p>
              <p className="truncate text-sm text-white/48">
                {connection.pageCategory || "Категорія з’явиться після verify"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <span className="text-sm text-white/42">Page ID</span>
              <span className="max-w-[14rem] truncate text-right text-sm font-medium text-white/82">
                {connection.pageId || "Ще не задано"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <span className="text-sm text-white/42">Token status</span>
              <span className="max-w-[14rem] truncate text-right text-sm font-medium text-white/82">
                {connection.hasPageAccessToken ? "Збережено" : "Відсутній"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <span className="text-sm text-white/42">Last verify</span>
              <span className="max-w-[14rem] truncate text-right text-sm font-medium text-white/82">
                {formatDate(connection.lastVerifiedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
              <span className="text-sm text-white/42">Page link</span>
              <span className="max-w-[14rem] truncate text-right text-sm font-medium text-white/82">
                {connection.pageLink || "З’явиться після verify"}
              </span>
            </div>
          </div>

          <form action={clearFacebookPageConnectionAction} className="mt-4 space-y-3">
            <input type="hidden" name="tab" value={activeTab} />
            <SocialSubmitButton
              idleLabel="Очистити connection"
              pendingLabel="Очищаю..."
              className="w-full rounded-full border border-amber-300/18 bg-amber-300/10 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-amber-300/16"
            />
            <SocialPendingState label="Прибираю Facebook Page connection." />
          </form>
        </div>
      ) : null}
    </section>
  );
}
