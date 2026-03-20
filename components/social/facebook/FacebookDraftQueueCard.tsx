import type {
  FacebookContentSettings,
  FacebookPageConnection,
  FacebookPostDraft,
  FacebookWorkspaceTab,
} from "@/lib/social/facebook";
import {
  attachFacebookDraftImageAction,
  clearFacebookDraftImageAction,
  deleteFacebookDraftAction,
  generateFacebookDraftsAction,
  publishFacebookDraftAction,
} from "@/app/cabinet/facebook/actions";
import { CopyTextButton } from "@/components/social/shared/CopyTextButton";
import { SocialPendingState } from "@/components/social/shared/SocialPendingState";
import { SocialSubmitButton } from "@/components/social/shared/SocialSubmitButton";

type FacebookDraftQueueCardProps = {
  settings: FacebookContentSettings;
  drafts: FacebookPostDraft[];
  connection: FacebookPageConnection | null;
  activeTab: FacebookWorkspaceTab;
  notice?: string;
};

const noticeMessages: Record<
  string,
  { tone: "success" | "warning" | "error"; text: string }
> = {
  "drafts-generated": {
    tone: "success",
    text: "Facebook generator створив 3 нові драфти й одразу підготував image prompt для кожного з них.",
  },
  "image-attached": {
    tone: "success",
    text: "Картинку прикріплено до Facebook draft.",
  },
  "image-cleared": {
    tone: "success",
    text: "Картинку з драфта прибрано.",
  },
  "image-invalid": {
    tone: "error",
    text: "Не вдалося додати картинку. Використай валідний image URL або завантаж файл до 4 MB.",
  },
  "drafts-failed": {
    tone: "error",
    text: "Не вдалося згенерувати Facebook drafts. Перевір контекст і спробуй ще раз.",
  },
  "draft-deleted": {
    tone: "success",
    text: "Зайвий Facebook draft видалено.",
  },
  "draft-published": {
    tone: "success",
    text: "Пост успішно відправлено у Facebook Page. Опублікований драфт прибрано з активної черги.",
  },
  "publish-connection-missing": {
    tone: "warning",
    text: "Спершу підключи Facebook Page у вкладці Facebook, і тоді publish-кнопка почне працювати.",
  },
  "publish-failed": {
    tone: "error",
    text: "Meta не прийняла publish-запит. Перевір Page connection, token і спробуй ще раз.",
  },
  "publish-missing": {
    tone: "error",
    text: "Не вдалося знайти цей draft для публікації. Спробуй оновити сторінку або згенерувати нові драфти.",
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
  connection,
  activeTab,
  notice,
}: FacebookDraftQueueCardProps) {
  const message = notice ? noticeMessages[notice] : null;
  const canPublish = Boolean(connection?.pageId && connection.hasPageAccessToken);

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
              : message.tone === "warning"
                ? "border-amber-300/16 bg-amber-300/[0.09] text-amber-50"
              : "border-red-300/14 bg-red-300/[0.08] text-red-50",
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}

      <form action={generateFacebookDraftsAction} className="mt-5 space-y-4">
        <input type="hidden" name="tab" value={activeTab} />

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

        <div
          className={[
            "rounded-[1.5rem] border px-4 py-4 text-sm leading-7",
            canPublish
              ? "border-emerald-300/14 bg-emerald-300/[0.07] text-emerald-50"
              : "border-amber-300/16 bg-amber-300/[0.08] text-amber-50",
          ].join(" ")}
        >
          {canPublish ? (
            <>
              Facebook Page вже підключена:
              {" "}
              <span className="font-medium text-white">
                {connection?.pageName || connection?.pageId}
              </span>
              . Тепер кожен драфт нижче можна відправити однією кнопкою.
            </>
          ) : (
            <>
              Publish поки заблокований, бо Facebook Page ще не підключена.
              Зайди у вкладку `Facebook`, збережи `page id` і `page access token`,
              а потім зроби verify.
            </>
          )}
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
                {draft.imageUrl ? (
                  <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.imageUrl}
                      alt={draft.imageAlt || draft.imageDirection || draft.title}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3 text-[0.72rem] uppercase tracking-[0.2em] text-white/48">
                      <span>Visual</span>
                      <span className="max-w-[12rem] truncate text-right text-white/68">
                        {draft.imageSource || "AI image"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm leading-7 text-white/42">
                    Тут поки немає прикріпленої картинки. Нижче вже є готовий
                    `image prompt`, який можна скопіювати, згенерувати visual у
                    зовнішньому сервісі й прикріпити назад до цього драфта.
                  </div>
                )}

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
                    <span className="max-w-[12rem] break-words text-right text-white/78">
                      {draft.imageDirection || "Ще не задано"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-[#0a1328]/74 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.72rem] uppercase tracking-[0.22em] text-white/40">
                        Image Prompt
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/48">
                        Скопіюй prompt, згенеруй картинку в будь-якому сервісі
                        і поверни її в цей драфт.
                      </p>
                    </div>

                    {draft.imagePrompt ? (
                      <CopyTextButton
                        text={draft.imagePrompt}
                        idleLabel="Скопіювати prompt"
                        copiedLabel="Prompt скопійовано"
                      />
                    ) : null}
                  </div>

                  <textarea
                    readOnly
                    value={draft.imagePrompt || "Для цього драфта prompt ще не згенерований."}
                    className="mt-4 min-h-[11rem] w-full rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 py-4 text-sm leading-7 text-white/72 outline-none"
                  />
                </div>

                <form
                  action={attachFacebookDraftImageAction}
                  className="mt-4 space-y-3 rounded-[1.2rem] border border-white/8 bg-black/10 p-4"
                >
                  <input type="hidden" name="draftId" value={draft.id} />
                  <input type="hidden" name="tab" value={activeTab} />

                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.22em] text-white/40">
                      Attach Image
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/48">
                      Можеш вставити URL картинки або завантажити готовий файл.
                    </p>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                      Image URL
                    </span>
                    <input
                      type="url"
                      name="imageUrl"
                      placeholder="https://... або data:image/..."
                      className="h-11 rounded-[1rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                      Upload image
                    </span>
                    <input
                      type="file"
                      name="imageFile"
                      accept="image/*"
                      className="block w-full rounded-[1rem] border border-white/10 bg-[#091122] px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-medium file:uppercase file:tracking-[0.2em] file:text-white/78"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                      Alt text (optional)
                    </span>
                    <input
                      type="text"
                      name="imageAlt"
                      defaultValue={draft.imageAlt || draft.title}
                      className="h-11 rounded-[1rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <SocialSubmitButton
                      idleLabel="Додати картинку"
                      pendingLabel="Додаю..."
                      className="rounded-full border border-white/14 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                    />
                  </div>

                  <SocialPendingState label="Прикріплюю картинку до Facebook draft." />
                </form>

                {draft.imageUrl ? (
                  <form
                    action={clearFacebookDraftImageAction}
                    className="mt-4 space-y-3"
                  >
                    <input type="hidden" name="draftId" value={draft.id} />
                    <input type="hidden" name="tab" value={activeTab} />
                    <SocialSubmitButton
                      idleLabel="Прибрати картинку"
                      pendingLabel="Прибираю..."
                      className="w-full rounded-full border border-amber-300/18 bg-amber-300/10 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-amber-300/16"
                    />
                    <SocialPendingState label="Прибираю прикріплену картинку." />
                  </form>
                ) : null}

                <form action={publishFacebookDraftAction} className="mt-4 space-y-3">
                  <input type="hidden" name="draftId" value={draft.id} />
                  <input type="hidden" name="tab" value={activeTab} />
                  <SocialSubmitButton
                    idleLabel={
                      canPublish
                        ? "Опублікувати у Facebook"
                        : "Спершу підключи Facebook Page"
                    }
                    pendingLabel="Публікую..."
                    disabled={!canPublish}
                    className="w-full rounded-full border border-emerald-300/18 bg-emerald-300/12 px-4 py-2.5 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/18"
                  />
                  <SocialPendingState label="Відправляю цей draft у Facebook Page." />
                </form>

                <form action={deleteFacebookDraftAction} className="mt-4 space-y-3">
                  <input type="hidden" name="draftId" value={draft.id} />
                  <input type="hidden" name="tab" value={activeTab} />
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
