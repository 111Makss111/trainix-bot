"use client";

import { useEffect, useState } from "react";
import {
  deleteWebPostDraftClientAction,
  generatePostDraftsClientAction,
  publishWebPostDraftClientAction,
  runScheduledPostGenerationNowClientAction,
  updateProjectPostSettingsClientAction,
} from "@/app/cabinet/web/actions";
import type { WebPostDraft, WebProject } from "@/lib/web-projects";

type WebPostsStudioProps = {
  project: WebProject;
  notice?: string;
  drafts: WebPostDraft[];
  publishedPosts: WebPostDraft[];
  imageModeLabel: string;
};

const postNoticeMessages: Record<
  string,
  { tone: "success" | "error"; text: string }
> = {
  generated: {
    tone: "success",
    text: "Згенерував 3 нові драфти. Тепер можеш переглянути їх і вручну опублікувати найкращий варіант у Telegram.",
  },
  published: {
    tone: "success",
    text: "Пост відправлений у Telegram. У history нижче вже видно, що він пішов у публікацію.",
  },
  "missing-ai-key": {
    tone: "error",
    text: "Для генерації постів потрібен `GEMINI_API_KEY` у середовищі проєкту.",
  },
  "missing-telegram": {
    tone: "error",
    text: "Спершу підключи Telegram-бота й групу для цього проєкту, щоб можна було публікувати драфти.",
  },
  "draft-not-found": {
    tone: "error",
    text: "Обраний драфт не знайдено. Спробуй згенерувати варіанти ще раз.",
  },
  "draft-deleted": {
    tone: "success",
    text: "Зайвий драфт видалено зі списку. Telegram-публікації це не торкається.",
  },
  "settings-saved": {
    tone: "success",
    text: "Налаштування черги постів збережені. Тепер можна або запускати генератор вручну, або підв’язати cron до route.",
  },
  "queue-generated": {
    tone: "success",
    text: "Черга відпрацювала вручну й докинула нові драфти в backlog.",
  },
  "source-unavailable": {
    tone: "error",
    text: "Зараз не вдалося взяти свіже джерело з API без повторів. Спробуй ще раз трохи пізніше або зміни тип поста.",
  },
  "generation-failed": {
    tone: "error",
    text: "Генерація драфтів не завершилась. Перевір API-ключі та спробуй ще раз.",
  },
  "publish-failed": {
    tone: "error",
    text: "Не вдалося опублікувати драфт у Telegram. Перевір bot token, chat id і доступи бота.",
  },
};

function formatPostDate(value: string | null) {
  if (!value) {
    return "Ще не публіковано";
  }

  return new Date(value).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTypeLabel(contentType: string) {
  if (contentType === "recipe") {
    return "Nutrition / Recipe";
  }

  return "Workout";
}

function getNoticeByKey(notice?: string | null) {
  if (!notice) {
    return null;
  }

  return postNoticeMessages[notice] ?? null;
}

function setBusyDraft(
  current: string[],
  draftId: string,
  nextBusy: boolean,
) {
  if (nextBusy) {
    return current.includes(draftId) ? current : [...current, draftId];
  }

  return current.filter((id) => id !== draftId);
}

export function WebPostsStudio({
  project,
  notice,
  drafts,
  publishedPosts,
  imageModeLabel,
}: WebPostsStudioProps) {
  const [projectState, setProjectState] = useState(project);
  const [draftsState, setDraftsState] = useState(drafts);
  const [publishedPostsState, setPublishedPostsState] = useState(publishedPosts);
  const [feedback, setFeedback] = useState(getNoticeByKey(notice));
  const [contentType, setContentType] = useState("workout");
  const [topicHint, setTopicHint] = useState("");
  const [queueEnabled, setQueueEnabled] = useState(project.postGenerationEnabled);
  const [queueInterval, setQueueInterval] = useState(
    String(project.postGenerationIntervalHours || 2),
  );
  const [queueMode, setQueueMode] = useState(
    project.postGenerationContentType || "mixed",
  );
  const [threadId, setThreadId] = useState(project.postGenerationThreadId ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingQueue, setIsSavingQueue] = useState(false);
  const [isRunningQueue, setIsRunningQueue] = useState(false);
  const [busyDraftIds, setBusyDraftIds] = useState<string[]>([]);

  useEffect(() => {
    setProjectState(project);
    setDraftsState(drafts);
    setPublishedPostsState(publishedPosts);
    setFeedback(getNoticeByKey(notice));
    setQueueEnabled(project.postGenerationEnabled);
    setQueueInterval(String(project.postGenerationIntervalHours || 2));
    setQueueMode(project.postGenerationContentType || "mixed");
    setThreadId(project.postGenerationThreadId ?? "");
    setContentType("workout");
    setTopicHint("");
    setBusyDraftIds([]);
    setIsGenerating(false);
    setIsSavingQueue(false);
    setIsRunningQueue(false);
  }, [drafts, notice, project, publishedPosts]);

  const publishReady = Boolean(
    projectState.telegramBotToken && projectState.telegramChatId,
  );

  async function handleGeneratePosts() {
    setFeedback(null);
    setIsGenerating(true);

    try {
      const result = await generatePostDraftsClientAction({
        projectId: projectState.id,
        contentType,
        topicHint,
      });

      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.error,
        });
        return;
      }

      setDraftsState(result.drafts ?? draftsState);
      setFeedback(getNoticeByKey(result.notice));
      setTopicHint("");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveQueueSettings() {
    setFeedback(null);
    setIsSavingQueue(true);

    try {
      const result = await updateProjectPostSettingsClientAction({
        projectId: projectState.id,
        postGenerationEnabled: queueEnabled,
        postGenerationIntervalHours: Number(queueInterval),
        postGenerationContentType: queueMode,
        postGenerationThreadId: threadId,
      });

      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.error,
        });
        return;
      }

      setProjectState((current) => ({
        ...current,
        ...result.postSettings,
      }));
      setFeedback(getNoticeByKey(result.notice));
    } finally {
      setIsSavingQueue(false);
    }
  }

  async function handleRunQueueNow() {
    setFeedback(null);
    setIsRunningQueue(true);

    try {
      const result = await runScheduledPostGenerationNowClientAction({
        projectId: projectState.id,
      });

      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.error,
        });
        return;
      }

      setDraftsState(result.drafts ?? draftsState);
      setProjectState((current) => ({
        ...current,
        ...result.postSettings,
      }));
      setFeedback(getNoticeByKey(result.notice));
    } finally {
      setIsRunningQueue(false);
    }
  }

  async function handleDeleteDraft(draft: WebPostDraft) {
    setFeedback(null);
    setBusyDraftIds((current) => setBusyDraft(current, draft.id, true));

    try {
      const result = await deleteWebPostDraftClientAction({
        projectId: projectState.id,
        draftId: draft.id,
      });

      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.error,
        });
        return;
      }

      setDraftsState((current) => current.filter((item) => item.id !== draft.id));
      setFeedback(getNoticeByKey(result.notice));
    } finally {
      setBusyDraftIds((current) => setBusyDraft(current, draft.id, false));
    }
  }

  async function handlePublishDraft(draft: WebPostDraft) {
    setFeedback(null);
    setBusyDraftIds((current) => setBusyDraft(current, draft.id, true));

    try {
      const result = await publishWebPostDraftClientAction({
        projectId: projectState.id,
        draftId: draft.id,
      });

      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.error,
        });
        return;
      }

      setDraftsState((current) => current.filter((item) => item.id !== draft.id));
      if (result.publishedPost) {
        setPublishedPostsState((current) => [
          result.publishedPost!,
          ...current.filter((item) => item.id !== result.publishedPost!.id),
        ]);
      }
      setFeedback(getNoticeByKey(result.notice));
    } finally {
      setBusyDraftIds((current) => setBusyDraft(current, draft.id, false));
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Posts
          </p>
          <h3 className="mt-3 text-2xl font-medium text-white">
            Post Studio
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
            Тут бот бере зовнішнє джерело, збирає 3 різні драфти й дає тобі
            вибір, який саме пост пустити в Telegram. Повтори відсікаються по
            вже опублікованих source ids.
          </p>
        </div>

        <div className="grid min-w-[16rem] gap-3">
          <div className="rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/46">Telegram publish</span>
              <span className="text-sm font-medium text-white/84">
                {publishReady ? "Готово" : "Ще не готово"}
              </span>
            </div>
          </div>
          <div className="rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/46">Image mode</span>
              <span className="text-sm font-medium text-white/84">
                {imageModeLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {feedback ? (
        <div
          className={[
            "mt-5 rounded-[1.3rem] border px-4 py-3 text-sm leading-6",
            feedback.tone === "success"
              ? "border-emerald-300/14 bg-emerald-300/[0.08] text-emerald-50"
              : "border-red-300/14 bg-red-300/[0.08] text-red-50",
          ].join(" ")}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] lg:items-end">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-white/36">
              Content type
            </span>
            <select
              value={contentType}
              onChange={(event) => {
                setContentType(event.currentTarget.value);
              }}
              className="h-12 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition focus:border-white/18"
            >
              <option value="workout">Workout</option>
              <option value="recipe">Nutrition / Recipe</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-white/36">
              Topic hint
            </span>
            <input
              type="text"
              value={topicHint}
              onChange={(event) => {
                setTopicHint(event.currentTarget.value);
              }}
              placeholder="Наприклад: для дому, для новачка, білковий сніданок"
              className="h-12 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => {
                void handleGeneratePosts();
              }}
              className="rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "Генерую..." : "Generate 3 posts"}
            </button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/8 bg-[#091122]/60 px-4 py-4 text-sm leading-7 text-white/52">
          Для `Workout` ми беремо свіжі вправи з `WGER`, для `Nutrition / Recipe`
          використовуємо `TheMealDB`. Для зображень студія зараз працює через
          image prompt / fallback-flow без повного перезавантаження сторінки.
        </div>

        {isGenerating ? (
          <p className="text-sm text-white/46">
            Генерую 3 нові драфти для цього проєкту.
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="min-w-0 space-y-4 rounded-[1.6rem] border border-white/8 bg-[#091122]/60 p-5">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/36">
              Queue settings
            </p>
            <h4 className="mt-2 text-lg font-medium text-white">
              Автогенерація драфтів
            </h4>
          </div>

          <label className="flex items-center gap-3 rounded-[1.3rem] border border-white/10 bg-black/10 px-4 py-3">
            <input
              type="checkbox"
              checked={queueEnabled}
              onChange={(event) => {
                setQueueEnabled(event.currentTarget.checked);
              }}
              className="h-4 w-4 rounded border-white/20 bg-transparent text-white"
            />
            <span>
              <span className="block text-sm font-medium text-white/86">
                Увімкнути накопичення драфтів
              </span>
              <span className="mt-1 block text-sm leading-6 text-white/44">
                Коли черга запущена по cron, вона буде докидати нові 3 драфти в
                backlog без видалення старих.
              </span>
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid min-w-0 gap-2">
              <span className="text-xs uppercase tracking-[0.24em] text-white/36">
                Interval
              </span>
              <select
                value={queueInterval}
                onChange={(event) => {
                  setQueueInterval(event.currentTarget.value);
                }}
                className="h-12 min-w-0 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition focus:border-white/18"
              >
                <option value="2">Кожні 2 години</option>
                <option value="4">Кожні 4 години</option>
                <option value="6">Кожні 6 годин</option>
                <option value="8">Кожні 8 годин</option>
                <option value="12">Кожні 12 годин</option>
                <option value="24">Раз на добу</option>
              </select>
            </label>

            <label className="grid min-w-0 gap-2">
              <span className="text-xs uppercase tracking-[0.24em] text-white/36">
                Queue mode
              </span>
              <select
                value={queueMode}
                onChange={(event) => {
                  setQueueMode(event.currentTarget.value);
                }}
                className="h-12 min-w-0 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition focus:border-white/18"
              >
                <option value="mixed">Mixed</option>
                <option value="workout">Workout only</option>
                <option value="recipe">Nutrition / Recipe only</option>
              </select>
            </label>

            <label className="grid min-w-0 gap-2">
              <span className="text-xs uppercase tracking-[0.24em] text-white/36">
                Telegram topic id (optional)
              </span>
              <input
                type="text"
                value={threadId}
                onChange={(event) => {
                  setThreadId(event.currentTarget.value);
                }}
                placeholder="Наприклад: 12"
                className="h-12 min-w-0 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
              />
            </label>
          </div>

          <div className="rounded-[1.4rem] border border-white/8 bg-black/10 px-4 py-4 text-sm leading-7 text-white/50">
            Це поле потрібне тільки якщо твоя Telegram-група увімкнена як
            `forum` і всередині є окремі гілки/теми. Тоді сюди ставиться
            `message_thread_id`, і ручна публікація також піде саме в цю тему.
            Якщо в тебе звичайна група без тем, просто залиш це поле порожнім.
            Автогенерація вже готова до cron-роута
            `GET /api/cron/web-posts` через `Bearer CRON_SECRET`.
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSavingQueue}
              onClick={() => {
                void handleSaveQueueSettings();
              }}
              className="rounded-full border border-white/14 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/88 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingQueue ? "Зберігаю..." : "Зберегти queue"}
            </button>
          </div>

          {isSavingQueue ? (
            <p className="text-sm text-white/46">
              Зберігаю налаштування черги постів.
            </p>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4 rounded-[1.6rem] border border-white/8 bg-[#091122]/60 p-5">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/36">
              Queue runtime
            </p>
            <h4 className="mt-2 text-lg font-medium text-white">
              Швидкий запуск і стан
            </h4>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-black/10 px-4 py-3">
              <span className="text-sm text-white/46">Status</span>
              <span className="text-sm font-medium text-white/84">
                {projectState.postGenerationEnabled ? "Увімкнено" : "Вимкнено"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-black/10 px-4 py-3">
              <span className="text-sm text-white/46">Last queue run</span>
              <span className="text-sm font-medium text-white/84">
                {formatPostDate(projectState.postGenerationLastRunAt)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-black/10 px-4 py-3">
              <span className="text-sm text-white/46">Thread target</span>
              <span className="text-sm font-medium text-white/84">
                {projectState.postGenerationThreadId || "У загальний чат"}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isRunningQueue}
            onClick={() => {
              void handleRunQueueNow();
            }}
            className="w-full rounded-full border border-sky-300/18 bg-sky-300/10 px-4 py-2.5 text-sm font-medium text-sky-50 transition hover:bg-sky-300/16 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunningQueue ? "Генерую..." : "Запустити queue зараз"}
          </button>

          {isRunningQueue ? (
            <p className="text-sm text-white/46">
              Запускаю ручний цикл генерації backlog-постів.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/36">
              Drafts
            </p>
            <h4 className="mt-2 text-lg font-medium text-white">
              Вибери один із трьох варіантів
            </h4>
          </div>

          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/60">
            {draftsState.length ? `${draftsState.length} ready` : "Waiting"}
          </span>
        </div>

        {draftsState.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {draftsState.map((draft, index) => {
              const isBusy = busyDraftIds.includes(draft.id);

              return (
                <article
                  key={draft.id}
                  className={[
                    "overflow-hidden rounded-[1.6rem] border border-white/8 bg-[#091122]/72 transition",
                    isBusy ? "opacity-80" : "",
                  ].join(" ")}
                >
                  {draft.imageUrl ? (
                    <div className="aspect-[16/10] overflow-hidden border-b border-white/8 bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={draft.imageUrl}
                        alt={draft.imageAlt || draft.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center border-b border-white/8 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(9,17,34,0.6))] text-sm text-white/34">
                      Image not attached for this draft
                    </div>
                  )}

                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/60">
                          Option {index + 1}
                        </span>
                        <span className="rounded-full border border-sky-300/14 bg-sky-300/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-sky-100">
                          {getTypeLabel(draft.contentType)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-lg font-medium text-white">{draft.title}</h5>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/62">
                        {draft.caption}
                      </p>
                    </div>

                    <div className="space-y-2 rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/42">Source</span>
                        <span className="max-w-[14rem] truncate text-right text-white/78">
                          {draft.sourceTitle || draft.sourceKind}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/42">Topic hint</span>
                        <span className="max-w-[14rem] truncate text-right text-white/78">
                          {draft.topicHint || "Без підказки"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/42">Image source</span>
                        <span className="max-w-[14rem] truncate text-right text-white/78">
                          {draft.imageSource || "Немає"}
                        </span>
                      </div>
                      {draft.imageCreditName ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/42">Photo credit</span>
                          {draft.imageCreditUrl ? (
                            <a
                              href={draft.imageCreditUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-[14rem] truncate text-right text-white/78 underline decoration-white/20 underline-offset-4 transition hover:text-white"
                            >
                              {draft.imageCreditName}
                            </a>
                          ) : (
                            <span className="max-w-[14rem] truncate text-right text-white/78">
                              {draft.imageCreditName}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          void handlePublishDraft(draft);
                        }}
                        className="w-full rounded-full border border-emerald-300/18 bg-emerald-300/10 px-4 py-2.5 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? "Обробляю..." : "Publish to Telegram"}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          void handleDeleteDraft(draft);
                        }}
                        className="w-full rounded-full border border-red-300/18 bg-red-300/10 px-4 py-2.5 text-sm font-medium text-red-50 transition hover:bg-red-300/16 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? "Обробляю..." : "Видалити драфт"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.6rem] border border-dashed border-white/10 bg-[#091122]/54 px-5 py-8 text-sm leading-7 text-white/46">
            Поки немає драфтів. Натисни `Generate 3 posts`, і тут з’являться три
            готові варіанти для ручної публікації.
          </div>
        )}
      </div>

      <div className="mt-8">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/36">
            History
          </p>
          <h4 className="mt-2 text-lg font-medium text-white">
            Останні опубліковані пости
          </h4>
        </div>

        {publishedPostsState.length ? (
          <div className="mt-5 grid gap-3">
            {publishedPostsState.map((post) => (
              <div
                key={post.id}
                className="rounded-[1.4rem] border border-white/8 bg-[#091122]/68 px-4 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/60">
                        {getTypeLabel(post.contentType)}
                      </span>
                      <span className="rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-emerald-100">
                        Published
                      </span>
                    </div>
                    <h5 className="mt-3 text-base font-medium text-white">
                      {post.title}
                    </h5>
                    <p className="mt-2 line-clamp-3 text-sm leading-7 text-white/54">
                      {post.caption}
                    </p>
                  </div>

                  <div className="grid min-w-[15rem] gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/42">Published</span>
                      <span className="text-right text-white/78">
                        {formatPostDate(post.publishedAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/42">Source</span>
                      <span className="max-w-[10rem] truncate text-right text-white/78">
                        {post.sourceTitle || post.sourceKind}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/42">Message id</span>
                      <span className="text-right text-white/78">
                        {post.publishedMessageId ?? "n/a"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.6rem] border border-dashed border-white/10 bg-[#091122]/54 px-5 py-8 text-sm leading-7 text-white/46">
            Історія ще порожня. Після першої ручної публікації тут буде видно, що
            вже виходило в групу, і це допоможе не повторюватися щодня.
          </div>
        )}
      </div>
    </section>
  );
}
