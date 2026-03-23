"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  attachWebPostDraftImageClientAction,
  clearWebPostDraftImageClientAction,
  deleteWebPostDraftClientAction,
  generatePostDraftsClientAction,
  publishWebPostDraftClientAction,
  runScheduledPostGenerationNowClientAction,
  updateProjectPostSettingsClientAction,
} from "@/app/cabinet/web/actions";
import { CopyTextButton } from "@/components/social/shared/CopyTextButton";
import type { WebPostDraft, WebProject } from "@/lib/web-projects";

type WebPostsStudioProps = {
  project: WebProject;
  notice?: string;
  drafts: WebPostDraft[];
  publishedPosts: WebPostDraft[];
  imageModeLabel: string;
};

type WebPostsTab = "studio" | "drafts" | "history";

const postTabs: Array<{
  id: WebPostsTab;
  label: string;
  description: string;
}> = [
  { id: "studio", label: "Studio", description: "Генерація і queue" },
  { id: "drafts", label: "Drafts", description: "Вибір і publish" },
  { id: "history", label: "History", description: "Що вже пішло в Telegram" },
];

const contentTypeLabels = {
  workout: "Workout",
  recipe: "Nutrition",
} as const;

const queueModeLabels = {
  mixed: "Mixed",
  workout: "Workout only",
  recipe: "Nutrition only",
} as const;

type QueueMode = keyof typeof queueModeLabels;

const noticeMessages: Record<
  string,
  { tone: "success" | "warning" | "error"; text: string }
> = {
  "settings-saved": {
    tone: "success",
    text: "Queue settings збережені. Нові генерації вже підуть за цими правилами.",
  },
  generated: {
    tone: "success",
    text: "Згенеровано 3 нові драфти. Можеш одразу обрати варіант, прикріпити картинку й відправити в Telegram.",
  },
  "queue-generated": {
    tone: "success",
    text: "Queue створила новий batch драфтів для цього проєкту.",
  },
  "draft-deleted": {
    tone: "success",
    text: "Зайвий драфт видалено з активної черги.",
  },
  published: {
    tone: "success",
    text: "Пост уже опублікований у Telegram і перенесений в history.",
  },
  "image-attached": {
    tone: "success",
    text: "Картинку прикріплено до драфта. Тепер його можна пушити в Telegram з візуалом.",
  },
  "image-cleared": {
    tone: "success",
    text: "Картинку з драфта прибрано.",
  },
  "source-unavailable": {
    tone: "warning",
    text: "Зараз не знайшлося свіжого джерела без повторів. Спробуй ще раз або зміни тип поста.",
  },
  "missing-ai-key": {
    tone: "error",
    text: "Для генерації драфтів потрібен `GEMINI_API_KEY` у середовищі проєкту.",
  },
  "missing-telegram": {
    tone: "warning",
    text: "Спершу підключи Telegram-бота й групу, тоді publish запрацює.",
  },
  "draft-not-found": {
    tone: "error",
    text: "Обраний драфт не знайдено. Спробуй оновити список або згенерувати нові варіанти.",
  },
  "publish-failed": {
    tone: "error",
    text: "Не вдалося опублікувати драфт у Telegram. Перевір bot token, chat id і доступи бота.",
  },
  "generation-failed": {
    tone: "error",
    text: "Генерація драфтів не завершилась. Перевір AI-ключ і спробуй ще раз.",
  },
};

function resolveInitialTab(input: {
  notice?: string;
  drafts: WebPostDraft[];
  publishedPosts: WebPostDraft[];
}) {
  if (
    input.notice === "published" ||
    input.notice === "publish-failed" ||
    input.notice === "draft-not-found"
  ) {
    return "history" as const;
  }

  if (
    input.notice === "generated" ||
    input.notice === "draft-deleted" ||
    input.notice === "image-attached" ||
    input.notice === "image-cleared" ||
    input.notice === "missing-telegram"
  ) {
    return "drafts" as const;
  }

  if (input.drafts.length) {
    return "drafts" as const;
  }

  if (input.publishedPosts.length) {
    return "history" as const;
  }

  return "studio" as const;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Ще не запускалось";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function mergeDraftIntoCollection(items: WebPostDraft[], nextDraft: WebPostDraft) {
  return items.map((item) => (item.id === nextDraft.id ? nextDraft : item));
}

function resolveNotice(input: string | null) {
  if (!input) {
    return null;
  }

  return noticeMessages[input] || null;
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
  const [activeTab, setActiveTab] = useState<WebPostsTab>(() =>
    resolveInitialTab({
      notice,
      drafts,
      publishedPosts,
    }),
  );
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(
    drafts[0]?.id ?? null,
  );
  const [selectedPublishedId, setSelectedPublishedId] = useState<string | null>(
    publishedPosts[0]?.id ?? null,
  );
  const [feedbackKey, setFeedbackKey] = useState<string | null>(notice || null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [contentType, setContentType] = useState<"workout" | "recipe">(
    project.postGenerationContentType === "recipe" ? "recipe" : "workout",
  );
  const [topicHint, setTopicHint] = useState("");
  const [queueEnabled, setQueueEnabled] = useState(project.postGenerationEnabled);
  const [queueInterval, setQueueInterval] = useState(
    String(project.postGenerationIntervalHours || 2),
  );
  const [queueMode, setQueueMode] = useState<QueueMode>(
    project.postGenerationContentType === "workout" ||
      project.postGenerationContentType === "recipe"
      ? project.postGenerationContentType
      : "mixed",
  );
  const [threadId, setThreadId] = useState(project.postGenerationThreadId || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingQueue, setIsSavingQueue] = useState(false);
  const [isRunningQueue, setIsRunningQueue] = useState(false);
  const [busyImageDraftId, setBusyImageDraftId] = useState<string | null>(null);
  const [busyDeleteDraftId, setBusyDeleteDraftId] = useState<string | null>(null);
  const [busyPublishDraftId, setBusyPublishDraftId] = useState<string | null>(null);
  const [busyClearImageDraftId, setBusyClearImageDraftId] = useState<string | null>(
    null,
  );

  const selectedDraft =
    draftsState.find((draft) => draft.id === selectedDraftId) || draftsState[0] || null;
  const selectedPublishedPost =
    publishedPostsState.find((post) => post.id === selectedPublishedId) ||
    publishedPostsState[0] ||
    null;
  const feedbackMessage = feedbackError
    ? { tone: "error" as const, text: feedbackError }
    : resolveNotice(feedbackKey);

  async function handleGenerateDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setFeedbackError(null);

    const result = await generatePostDraftsClientAction({
      projectId: projectState.id,
      contentType,
      topicHint: topicHint.trim() || null,
    });

    setIsGenerating(false);

    if (!result.ok) {
      setFeedbackError(result.error);
      return;
    }

    if (result.drafts) {
      setDraftsState(result.drafts);
      setSelectedDraftId(result.drafts[0]?.id ?? null);
    }

    setActiveTab("drafts");
    setFeedbackKey(result.notice);
  }

  async function handleSaveQueueSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingQueue(true);
    setFeedbackError(null);

    const result = await updateProjectPostSettingsClientAction({
      projectId: projectState.id,
      postGenerationEnabled: queueEnabled,
      postGenerationIntervalHours: Number(queueInterval),
      postGenerationContentType: queueMode,
      postGenerationThreadId: threadId.trim() || null,
    });

    setIsSavingQueue(false);

    if (!result.ok) {
      setFeedbackError(result.error);
      return;
    }

    if (result.postSettings) {
      setProjectState((current) => ({
        ...current,
        ...result.postSettings,
      }));
    }

    setFeedbackKey(result.notice);
  }

  async function handleRunQueueNow() {
    setIsRunningQueue(true);
    setFeedbackError(null);

    const result = await runScheduledPostGenerationNowClientAction({
      projectId: projectState.id,
    });

    setIsRunningQueue(false);

    if (!result.ok) {
      setFeedbackError(result.error);
      return;
    }

    if (result.drafts) {
      setDraftsState(result.drafts);
      setSelectedDraftId(result.drafts[0]?.id ?? null);
    }

    if (result.postSettings) {
      setProjectState((current) => ({
        ...current,
        ...result.postSettings,
      }));
    }

    setActiveTab("drafts");
    setFeedbackKey(result.notice);
  }

  async function handleDeleteDraft(draftId: string) {
    setBusyDeleteDraftId(draftId);
    setFeedbackError(null);

    const result = await deleteWebPostDraftClientAction({
      projectId: projectState.id,
      draftId,
    });

    setBusyDeleteDraftId(null);

    if (!result.ok) {
      setFeedbackError(result.error);
      return;
    }

    setDraftsState((current) => current.filter((draft) => draft.id !== draftId));
    setFeedbackKey(result.notice);
  }

  async function handlePublishDraft(draftId: string) {
    setBusyPublishDraftId(draftId);
    setFeedbackError(null);

    const result = await publishWebPostDraftClientAction({
      projectId: projectState.id,
      draftId,
    });

    setBusyPublishDraftId(null);

    if (!result.ok) {
      setFeedbackError(result.error);
      return;
    }

    setDraftsState((current) => current.filter((draft) => draft.id !== draftId));

    if (result.publishedPost) {
      setPublishedPostsState((current) => [result.publishedPost!, ...current]);
      setSelectedPublishedId(result.publishedPost.id);
    }

    setActiveTab("history");
    setFeedbackKey(result.notice);
  }

  async function handleAttachImage(
    event: FormEvent<HTMLFormElement>,
    draftId: string,
  ) {
    event.preventDefault();
    setBusyImageDraftId(draftId);
    setFeedbackError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("projectId", projectState.id);
    formData.set("draftId", draftId);

    const result = await attachWebPostDraftImageClientAction(formData);

    setBusyImageDraftId(null);

    if (!result.ok) {
      setFeedbackError(result.error);
      return;
    }

    const nextDraft = result.drafts?.[0];

    if (nextDraft) {
      setDraftsState((current) => mergeDraftIntoCollection(current, nextDraft));
    }

    form.reset();
    setFeedbackKey(result.notice);
  }

  async function handleClearImage(draftId: string) {
    setBusyClearImageDraftId(draftId);
    setFeedbackError(null);

    const result = await clearWebPostDraftImageClientAction({
      projectId: projectState.id,
      draftId,
    });

    setBusyClearImageDraftId(null);

    if (!result.ok) {
      setFeedbackError(result.error);
      return;
    }

    const nextDraft = result.drafts?.[0];

    if (nextDraft) {
      setDraftsState((current) => mergeDraftIntoCollection(current, nextDraft));
    }

    setFeedbackKey(result.notice);
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Posts
          </p>
          <h3 className="mt-3 text-2xl font-medium text-white">Post Studio</h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/54">
            Тут зібраний увесь flow для Telegram-постів: генерація нових варіантів,
            backlog queue, ручне додавання картинки і publish без стрибка сторінки.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.4rem] border border-white/8 bg-[#091122]/72 px-4 py-4">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
              Drafts
            </p>
            <p className="mt-2 text-2xl font-medium text-white">{draftsState.length}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/8 bg-[#091122]/72 px-4 py-4">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
              History
            </p>
            <p className="mt-2 text-2xl font-medium text-white">
              {publishedPostsState.length}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-white/8 bg-[#091122]/72 px-4 py-4">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
              Images
            </p>
            <p className="mt-2 text-sm font-medium text-white/82">{imageModeLabel}</p>
          </div>
        </div>
      </div>

      {feedbackMessage ? (
        <div
          className={[
            "mt-5 rounded-[1.3rem] border px-4 py-3 text-sm leading-6",
            feedbackMessage.tone === "success"
              ? "border-emerald-300/14 bg-emerald-300/[0.08] text-emerald-50"
              : feedbackMessage.tone === "warning"
                ? "border-amber-300/16 bg-amber-300/[0.08] text-amber-50"
                : "border-red-300/14 bg-red-300/[0.08] text-red-50",
          ].join(" ")}
        >
          {feedbackMessage.text}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {postTabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
              }}
              className={[
                "rounded-[1.35rem] border px-4 py-4 text-left transition",
                isActive
                  ? "border-sky-300/20 bg-sky-300/[0.12]"
                  : "border-white/8 bg-[#091122]/58 hover:border-white/14 hover:bg-[#0d1730]/72",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">{tab.label}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                  {tab.id === "drafts"
                    ? draftsState.length
                    : tab.id === "history"
                      ? publishedPostsState.length
                      : "Go"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/46">
                {tab.description}
              </p>
            </button>
          );
        })}
      </div>

      {activeTab === "studio" ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <form
            onSubmit={handleGenerateDrafts}
            className="rounded-[1.7rem] border border-white/8 bg-[#091122]/72 p-5"
          >
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/36">
              Generate
            </p>
            <h4 className="mt-3 text-lg font-medium text-white">
              Згенерувати 3 нові пости
            </h4>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                  Content type
                </span>
                <select
                  value={contentType}
                  onChange={(event) => {
                    setContentType(event.target.value === "recipe" ? "recipe" : "workout");
                  }}
                  className="h-12 rounded-[1.1rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition focus:border-white/18"
                >
                  <option value="workout">Workout</option>
                  <option value="recipe">Nutrition</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                  Topic hint
                </span>
                <input
                  type="text"
                  value={topicHint}
                  onChange={(event) => {
                    setTopicHint(event.target.value);
                  }}
                  placeholder="Наприклад: коротке домашнє тренування або легка вечеря після залу"
                  className="h-12 rounded-[1.1rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
                />
              </label>
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-black/10 px-4 py-4 text-sm leading-7 text-white/54">
              Генератор бере факти із зовнішніх API, формує корисний Telegram-пост
              і, якщо в драфта не вистачає візуалу, ти зможеш прикріпити картинку
              вручну вже у вкладці `Drafts`.
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isGenerating}
                className={[
                  "rounded-full border border-white/14 px-4 py-2.5 text-sm font-medium text-white transition",
                  isGenerating
                    ? "cursor-wait bg-white/6 opacity-70"
                    : "bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))]",
                ].join(" ")}
              >
                {isGenerating ? "Генерую..." : "Generate 3 posts"}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleSaveQueueSettings}
            className="rounded-[1.7rem] border border-white/8 bg-[#091122]/72 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/36">
                  Queue
                </p>
                <h4 className="mt-3 text-lg font-medium text-white">
                  Автогенерація backlog
                </h4>
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                {projectState.postGenerationEnabled ? "Enabled" : "Manual"}
              </span>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-[1.3rem] border border-white/10 bg-[#091122] px-4 py-4">
              <input
                type="checkbox"
                checked={queueEnabled}
                onChange={(event) => {
                  setQueueEnabled(event.target.checked);
                }}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-white"
              />
              <span>
                <span className="block text-sm font-medium text-white/86">
                  Увімкнути накопичення драфтів
                </span>
                <span className="mt-1 block text-sm leading-6 text-white/44">
                  Коли queue запущена, вона сама докидатиме нові 3 драфти в backlog
                  без видалення старих.
                </span>
              </span>
            </label>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                  Interval
                </span>
                <select
                  value={queueInterval}
                  onChange={(event) => {
                    setQueueInterval(event.target.value);
                  }}
                  className="h-12 rounded-[1.1rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition focus:border-white/18"
                >
                  <option value="2">Кожні 2 години</option>
                  <option value="4">Кожні 4 години</option>
                  <option value="6">Кожні 6 годин</option>
                  <option value="8">Кожні 8 годин</option>
                  <option value="12">Кожні 12 годин</option>
                  <option value="24">Раз на добу</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                  Queue mode
                </span>
                <select
                  value={queueMode}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setQueueMode(
                      nextValue === "workout" || nextValue === "recipe"
                        ? nextValue
                        : "mixed",
                    );
                  }}
                  className="h-12 rounded-[1.1rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition focus:border-white/18"
                >
                  <option value="mixed">Mixed</option>
                  <option value="workout">Workout only</option>
                  <option value="recipe">Nutrition only</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                  Telegram topic id
                </span>
                <input
                  type="text"
                  value={threadId}
                  onChange={(event) => {
                    setThreadId(event.target.value);
                  }}
                  placeholder="Опційно: 11"
                  className="h-12 rounded-[1.1rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.3rem] border border-white/8 bg-black/10 px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                  Last queue run
                </p>
                <p className="mt-2 text-sm font-medium text-white/82">
                  {formatDate(projectState.postGenerationLastRunAt)}
                </p>
              </div>

              <div className="rounded-[1.3rem] border border-white/8 bg-black/10 px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                  Current mode
                </p>
                <p className="mt-2 text-sm font-medium text-white/82">
                  {queueModeLabels[queueMode]}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-black/10 px-4 py-4 text-sm leading-7 text-white/52">
              `Telegram topic id` потрібен тільки якщо твоя група працює як forum з
              окремими темами. Якщо група звичайна, залиш поле порожнім.
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSavingQueue}
                className={[
                  "rounded-full border border-white/14 px-4 py-2.5 text-sm font-medium text-white transition",
                  isSavingQueue
                    ? "cursor-wait bg-white/6 opacity-70"
                    : "bg-white/8 hover:bg-white/12",
                ].join(" ")}
              >
                {isSavingQueue ? "Зберігаю..." : "Зберегти queue"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleRunQueueNow();
                }}
                disabled={isRunningQueue}
                className={[
                  "rounded-full border border-white/14 px-4 py-2.5 text-sm font-medium text-white transition",
                  isRunningQueue
                    ? "cursor-wait bg-white/6 opacity-70"
                    : "bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))]",
                ].join(" ")}
              >
                {isRunningQueue ? "Запускаю..." : "Запустити queue зараз"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {activeTab === "drafts" ? (
        draftsState.length ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="rounded-[1.7rem] border border-white/8 bg-[#091122]/72 p-3">
              <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                {draftsState.map((draft, index) => {
                  const isActive = draft.id === selectedDraft?.id;

                  return (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => {
                        setSelectedDraftId(draft.id);
                      }}
                      className={[
                        "w-full rounded-[1.35rem] border px-4 py-4 text-left transition",
                        isActive
                          ? "border-sky-300/18 bg-sky-300/[0.1]"
                          : "border-white/8 bg-black/10 hover:border-white/14 hover:bg-black/15",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.22em] text-white/42">
                          Draft {index + 1}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                          {contentTypeLabels[
                            draft.contentType as keyof typeof contentTypeLabels
                          ] || draft.contentType}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-white">
                        {draft.title}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-white/52">
                          {draft.imageUrl ? "Image ready" : "No image"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-white/52">
                          {formatDate(draft.createdAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDraft ? (
              <article className="rounded-[1.7rem] border border-white/8 bg-[#091122]/72 p-5">
                {selectedDraft.imageUrl ? (
                  <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedDraft.imageUrl}
                      alt={selectedDraft.imageAlt || selectedDraft.title}
                      className="aspect-[16/9] w-full object-cover"
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3 text-[0.72rem] uppercase tracking-[0.2em] text-white/46">
                      <span>Visual</span>
                      <span className="max-w-[14rem] truncate text-right text-white/68">
                        {selectedDraft.imageSource || "Attached image"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm leading-7 text-white/42">
                    У цього драфта поки немає картинки. Нижче можна вставити image
                    URL або завантажити файл з ПК і відразу оновити драфт.
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/60">
                    {contentTypeLabels[
                      selectedDraft.contentType as keyof typeof contentTypeLabels
                    ] || selectedDraft.contentType}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/60">
                    {selectedDraft.imageUrl ? "Image ready" : "Needs image"}
                  </span>
                </div>

                <h4 className="mt-4 text-2xl font-medium leading-tight text-white">
                  {selectedDraft.title}
                </h4>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/62">
                  {selectedDraft.caption}
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-white/8 bg-black/10 px-4 py-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Source
                    </p>
                    <p className="mt-2 text-sm font-medium text-white/82">
                      {selectedDraft.sourceTitle || selectedDraft.sourceKind}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/46">
                      {selectedDraft.sourceUrl || "Зовнішнє джерело без прямого URL"}
                    </p>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/8 bg-black/10 px-4 py-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Quick copy
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <CopyTextButton
                        text={[selectedDraft.title, selectedDraft.caption]
                          .filter(Boolean)
                          .join("\n\n")}
                        idleLabel="Скопіювати пост"
                        copiedLabel="Пост скопійовано"
                      />
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={(event) => {
                    void handleAttachImage(event, selectedDraft.id);
                  }}
                  className="mt-5 rounded-[1.4rem] border border-white/8 bg-black/10 p-4"
                >
                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.22em] text-white/40">
                      Attach image
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/48">
                      Можеш вставити прямий image URL або завантажити картинку з ПК.
                      Локальний файл підтримується до 4 MB.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <input type="hidden" name="projectId" value={projectState.id} />
                    <input type="hidden" name="draftId" value={selectedDraft.id} />

                    <label className="grid gap-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                        Image URL
                      </span>
                      <input
                        type="url"
                        name="imageUrl"
                        placeholder="https://..."
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
                        defaultValue={selectedDraft.imageAlt || selectedDraft.title}
                        className="h-11 rounded-[1rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={busyImageDraftId === selectedDraft.id}
                      className={[
                        "rounded-full border border-white/14 px-4 py-2.5 text-sm font-medium text-white transition",
                        busyImageDraftId === selectedDraft.id
                          ? "cursor-wait bg-white/6 opacity-70"
                          : "bg-white/8 hover:bg-white/12",
                      ].join(" ")}
                    >
                      {busyImageDraftId === selectedDraft.id
                        ? "Додаю..."
                        : selectedDraft.imageUrl
                          ? "Оновити картинку"
                          : "Додати картинку"}
                    </button>

                    {selectedDraft.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleClearImage(selectedDraft.id);
                        }}
                        disabled={busyClearImageDraftId === selectedDraft.id}
                        className={[
                          "rounded-full border border-amber-300/18 px-4 py-2.5 text-sm font-medium text-amber-50 transition",
                          busyClearImageDraftId === selectedDraft.id
                            ? "cursor-wait bg-amber-300/8 opacity-70"
                            : "bg-amber-300/10 hover:bg-amber-300/16",
                        ].join(" ")}
                      >
                        {busyClearImageDraftId === selectedDraft.id
                          ? "Прибираю..."
                          : "Прибрати картинку"}
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void handlePublishDraft(selectedDraft.id);
                    }}
                    disabled={busyPublishDraftId === selectedDraft.id}
                    className={[
                      "rounded-full border border-emerald-300/18 px-4 py-2.5 text-sm font-medium text-emerald-50 transition",
                      busyPublishDraftId === selectedDraft.id
                        ? "cursor-wait bg-emerald-300/8 opacity-70"
                        : "bg-emerald-300/12 hover:bg-emerald-300/18",
                    ].join(" ")}
                  >
                    {busyPublishDraftId === selectedDraft.id
                      ? "Публікую..."
                      : "Publish to Telegram"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteDraft(selectedDraft.id);
                    }}
                    disabled={busyDeleteDraftId === selectedDraft.id}
                    className={[
                      "rounded-full border border-red-300/18 px-4 py-2.5 text-sm font-medium text-red-50 transition",
                      busyDeleteDraftId === selectedDraft.id
                        ? "cursor-wait bg-red-300/8 opacity-70"
                        : "bg-red-300/10 hover:bg-red-300/16",
                    ].join(" ")}
                  >
                    {busyDeleteDraftId === selectedDraft.id
                      ? "Видаляю..."
                      : "Видалити драфт"}
                  </button>
                </div>
              </article>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.7rem] border border-dashed border-white/10 bg-[#091122]/54 px-5 py-10 text-sm leading-7 text-white/46">
            Поки немає активних драфтів. Повернись у `Studio`, згенеруй нові
            пости, і тут з’явиться компактний вибір з preview та ручним attach image.
          </div>
        )
      ) : null}

      {activeTab === "history" ? (
        publishedPostsState.length ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="rounded-[1.7rem] border border-white/8 bg-[#091122]/72 p-3">
              <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                {publishedPostsState.map((post, index) => {
                  const isActive = post.id === selectedPublishedPost?.id;

                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => {
                        setSelectedPublishedId(post.id);
                      }}
                      className={[
                        "w-full rounded-[1.35rem] border px-4 py-4 text-left transition",
                        isActive
                          ? "border-sky-300/18 bg-sky-300/[0.1]"
                          : "border-white/8 bg-black/10 hover:border-white/14 hover:bg-black/15",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.22em] text-white/42">
                          Post {index + 1}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                          {formatDate(post.publishedAt || post.createdAt)}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-white">
                        {post.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPublishedPost ? (
              <article className="rounded-[1.7rem] border border-white/8 bg-[#091122]/72 p-5">
                {selectedPublishedPost.imageUrl ? (
                  <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedPublishedPost.imageUrl}
                      alt={selectedPublishedPost.imageAlt || selectedPublishedPost.title}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-emerald-100">
                    Published
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/60">
                    {formatDate(selectedPublishedPost.publishedAt || selectedPublishedPost.createdAt)}
                  </span>
                </div>

                <h4 className="mt-4 text-2xl font-medium leading-tight text-white">
                  {selectedPublishedPost.title}
                </h4>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/62">
                  {selectedPublishedPost.caption}
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-white/8 bg-black/10 px-4 py-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Telegram message id
                    </p>
                    <p className="mt-2 text-sm font-medium text-white/82">
                      {selectedPublishedPost.publishedMessageId || "Не збережено"}
                    </p>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/8 bg-black/10 px-4 py-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/34">
                      Image source
                    </p>
                    <p className="mt-2 text-sm font-medium text-white/82">
                      {selectedPublishedPost.imageSource || "Без картинки"}
                    </p>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.7rem] border border-dashed border-white/10 bg-[#091122]/54 px-5 py-10 text-sm leading-7 text-white/46">
            Тут з’явиться історія вже опублікованих постів. Коли відправиш перший
            драфт у Telegram, він автоматично переїде сюди.
          </div>
        )
      ) : null}
    </section>
  );
}
