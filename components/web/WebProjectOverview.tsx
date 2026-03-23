"use client";

import { useState } from "react";
import type { TelegramMessageLog, WebPostDraft, WebProject } from "@/lib/web-projects";
import { deleteWebProjectAction } from "@/app/cabinet/web/actions";
import { FormSubmitButton } from "./FormSubmitButton";
import { WebAiCard } from "./WebAiCard";
import { WebPostsStudio } from "./WebPostsStudio";
import { WebTelegramMessages } from "./WebTelegramMessages";
import { WebTelegramCard } from "./WebTelegramCard";

type WebProjectOverviewProps = {
  project: WebProject | null;
  telegramNotice?: string;
  aiNotice?: string;
  postNotice?: string;
  telegramMessages: TelegramMessageLog[];
  postDrafts: WebPostDraft[];
  publishedPosts: WebPostDraft[];
  aiRuntime: {
    provider: string;
    model: string;
    apiKeyConfigured: boolean;
    knowledgeFilePath: string | null;
    knowledgeLoaded: boolean;
  };
  imageModeLabel: string;
};

type WebWorkspaceTab = "telegram" | "ai" | "posts" | "inbox";

const workspaceTabs: Array<{
  id: WebWorkspaceTab;
  label: string;
  description: string;
}> = [
  {
    id: "telegram",
    label: "Telegram",
    description: "Бот, група і webhook",
  },
  {
    id: "ai",
    label: "AI",
    description: "Контекст і knowledge",
  },
  {
    id: "posts",
    label: "Posts",
    description: "Черга, драфти й history",
  },
  {
    id: "inbox",
    label: "Inbox",
    description: "Живі повідомлення",
  },
];

function resolveInitialTab(input: {
  telegramNotice?: string;
  aiNotice?: string;
  postNotice?: string;
}): WebWorkspaceTab {
  if (input.telegramNotice) {
    return "telegram";
  }

  if (input.aiNotice) {
    return "ai";
  }

  if (input.postNotice) {
    return "posts";
  }

  return "posts";
}

export function WebProjectOverview({
  project,
  telegramNotice,
  aiNotice,
  postNotice,
  telegramMessages,
  postDrafts,
  publishedPosts,
  aiRuntime,
  imageModeLabel,
}: WebProjectOverviewProps) {
  const [activeTab, setActiveTab] = useState<WebWorkspaceTab>(() =>
    resolveInitialTab({
      telegramNotice,
      aiNotice,
      postNotice,
    }),
  );

  if (!project) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-sm leading-7 text-white/42 backdrop-blur-md">
        Обери або створи проєкт, і тут з’явиться його керування: Telegram,
        AI-відповіді, автопости й зовнішні джерела контенту.
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-[2rem] border border-red-300/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 backdrop-blur-md">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
              Active Project
            </p>
            <h2 className="mt-3 text-2xl font-medium text-white">
              {project.name}
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/56">
              {project.description || "Опис поки не додано."}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-white/30">
              {project.slug}
            </p>
          </div>

          <div className="max-w-sm rounded-[1.5rem] border border-red-300/12 bg-red-300/[0.05] px-4 py-4">
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-red-100/74">
              Danger Zone
            </p>
            <p className="mt-3 text-sm leading-7 text-white/60">
              Одним натисканням проєкт буде видалений із центру `Web`. Разом із
              ним мають зникати й усі прив’язані до нього дані.
            </p>
            <form action={deleteWebProjectAction} className="mt-4">
              <input type="hidden" name="projectId" value={project.id} />
              <FormSubmitButton
                idleLabel="Видалити проєкт"
                pendingLabel="Видаляю..."
                className="rounded-full border border-red-300/18 bg-red-300/10 px-4 py-2.5 text-sm font-medium text-red-50 transition hover:bg-red-300/16"
              />
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {workspaceTabs.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                }}
                className={[
                  "rounded-[1.4rem] border px-4 py-4 text-left transition",
                  isActive
                    ? "border-sky-300/20 bg-sky-300/[0.12] shadow-[0_0_0_1px_rgba(125,211,252,0.08)]"
                    : "border-white/8 bg-[#091122]/58 hover:border-white/14 hover:bg-[#0d1730]/72",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">
                    {tab.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                    {tab.id === "posts"
                      ? postDrafts.length
                      : tab.id === "inbox"
                        ? telegramMessages.length
                        : "Go"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/48">
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "telegram" ? (
        <WebTelegramCard project={project} notice={telegramNotice} />
      ) : null}

      {activeTab === "ai" ? (
        <WebAiCard project={project} notice={aiNotice} aiRuntime={aiRuntime} />
      ) : null}

      {activeTab === "posts" ? (
        <WebPostsStudio
          key={`${project.id}:${postNotice || "base"}`}
          project={project}
          notice={postNotice}
          drafts={postDrafts}
          publishedPosts={publishedPosts}
          imageModeLabel={imageModeLabel}
        />
      ) : null}

      {activeTab === "inbox" ? (
        <WebTelegramMessages
          initialMessages={telegramMessages}
          projectId={project.id}
          webhookEnabled={project.telegramWebhookEnabled}
        />
      ) : null}
    </div>
  );
}
