import type {
  FacebookContentSettings,
  FacebookPostDraft,
} from "@/lib/social/facebook";
import {
  deleteFacebookDraftAction,
  generateFacebookDraftsAction,
} from "@/app/cabinet/facebook/actions";
import { SocialPendingState } from "@/components/social/shared/SocialPendingState";
import { SocialSubmitButton } from "@/components/social/shared/SocialSubmitButton";

type FacebookDraftQueueCardProps = {
  settings: FacebookContentSettings;
  drafts: FacebookPostDraft[];
  notice?: string;
};

const noticeMessages: Record<
  string,
  { tone: "success" | "error"; text: string }
> = {
  "drafts-generated": {
    tone: "success",
    text: "Facebook generator створив 3 нові драфти на базі твого content profile.",
  },
  "drafts-failed": {
    tone: "error",
    text: "Не вдалося згенерувати Facebook drafts. Перевір контекст і спробуй ще раз.",
  },
  "draft-deleted": {
    tone: "success",
    text: "Зайвий Facebook draft видалено.",
  },
};

const labelMap = {
  goal: {
    awareness: "Awareness",
    education: "Education",
    trust: "Trust",
    engagement: "Engagement",
    "soft-promo": "Soft promo",
  },
  tone: {
    human: "Людяний",
    calm: "Спокійний",
    energetic: "Енергійний",
    expert: "Експертний",
  },
  style: {
    short: "Короткий",
    medium: "Середній",
    story: "Історія",
    list: "Список / поради",
    "problem-solution": "Проблема -> рішення",
  },
  productPresence: {
    minimal: "Мінімально",
    balanced: "Помірно",
    strong: "Сильно",
  },
} as const;

function readableValue<T extends keyof typeof labelMap>(
  group: T,
  value: string,
) {
  return labelMap[group][value as keyof (typeof labelMap)[T]] || value;
}

export function FacebookDraftQueueCard({
  settings,
  drafts,
  notice,
}: FacebookDraftQueueCardProps) {
  const message = notice ? noticeMessages[notice] : null;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Facebook
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">Draft Queue</h2>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/60">
          {drafts.length ? `${drafts.length} ready` : "Waiting"}
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

      <form action={generateFacebookDraftsAction} className="mt-5 space-y-4">
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.24em] text-white/36">
            Topic hint
          </span>
          <input
            type="text"
            name="topicHint"
            placeholder="Наприклад: чому люди кидають тренування, рутина новачка, історія створення Trainix"
            className="h-12 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
          />
        </label>

        <div className="rounded-[1.5rem] border border-white/8 bg-[#091122]/60 px-4 py-4 text-sm leading-7 text-white/52">
          Генератор бере твій поточний Facebook profile як основу:
          tone `{readableValue("tone", settings.toneProfile)}`, goal `
          {readableValue("goal", settings.primaryGoal)}`, style `
          {readableValue("style", settings.postStyle)}` і product presence `
          {readableValue("productPresence", settings.productPresence)}`.
        </div>

        <div className="flex flex-wrap gap-3">
          <SocialSubmitButton
            idleLabel="Generate 3 Facebook drafts"
            pendingLabel="Генерую..."
            className="rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))]"
          />
        </div>

        <SocialPendingState label="Генерую Facebook drafts на базі поточних settings." />
      </form>

      <div className="mt-8">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/36">
            Preview
          </p>
          <h3 className="mt-2 text-lg font-medium text-white">
            Поточні Facebook drafts
          </h3>
        </div>

        {drafts.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {drafts.map((draft, index) => (
              <article
                key={draft.id}
                className="rounded-[1.6rem] border border-white/8 bg-[#091122]/72 p-5"
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/60">
                    Option {index + 1}
                  </span>
                  <span className="rounded-full border border-sky-300/14 bg-sky-300/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-sky-100">
                    {readableValue("goal", draft.primaryGoal)}
                  </span>
                </div>

                <h4 className="mt-4 text-lg font-medium text-white">
                  {draft.title}
                </h4>
                <p className="mt-4 text-sm font-medium leading-7 text-white/82">
                  {draft.hook}
                </p>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/60">
                  {draft.body}
                </p>
                <p className="mt-4 text-sm leading-7 text-sky-100/90">
                  {draft.cta}
                </p>

                <div className="mt-4 space-y-2 rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/42">Tone</span>
                    <span className="max-w-[12rem] truncate text-right text-white/78">
                      {readableValue("tone", draft.toneProfile)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/42">Style</span>
                    <span className="max-w-[12rem] truncate text-right text-white/78">
                      {readableValue("style", draft.postStyle)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/42">Product presence</span>
                    <span className="max-w-[12rem] truncate text-right text-white/78">
                      {readableValue("productPresence", draft.productPresence)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-white/42">Image direction</span>
                    <span className="max-w-[12rem] text-right text-white/78">
                      {draft.imageDirection || "Ще не задано"}
                    </span>
                  </div>
                </div>

                <form action={deleteFacebookDraftAction} className="mt-4 space-y-3">
                  <input type="hidden" name="draftId" value={draft.id} />
                  <SocialSubmitButton
                    idleLabel="Видалити draft"
                    pendingLabel="Видаляю..."
                    className="w-full rounded-full border border-red-300/18 bg-red-300/10 px-4 py-2.5 text-sm font-medium text-red-50 transition hover:bg-red-300/16"
                  />
                  <SocialPendingState label="Прибираю цей Facebook draft." />
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.6rem] border border-dashed border-white/10 bg-[#091122]/54 px-5 py-8 text-sm leading-7 text-white/46">
            Поки немає Facebook drafts. Натисни `Generate 3 Facebook drafts`, і
            тут з&apos;являться варіанти, які вже спиратимуться на твій content
            profile.
          </div>
        )}
      </div>
    </section>
  );
}
