import type { WebProject } from "@/lib/web-projects";
import { deleteWebProjectAction } from "@/app/cabinet/web/actions";
import { WebAiCard } from "./WebAiCard";
import { WebTelegramMessages } from "./WebTelegramMessages";
import { WebTelegramCard } from "./WebTelegramCard";
import { WebStatusCard } from "./WebStatusCard";
import type { TelegramMessageLog } from "@/lib/web-projects";
import { FormSubmitButton } from "./FormSubmitButton";

type WebProjectOverviewProps = {
  project: WebProject | null;
  telegramNotice?: string;
  aiNotice?: string;
  telegramMessages: TelegramMessageLog[];
  aiRuntime: {
    provider: string;
    model: string;
    apiKeyConfigured: boolean;
    knowledgeFilePath: string | null;
    knowledgeLoaded: boolean;
  };
};

export function WebProjectOverview({
  project,
  telegramNotice,
  aiNotice,
  telegramMessages,
  aiRuntime,
}: WebProjectOverviewProps) {
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

      <div className="grid gap-4 xl:grid-cols-2">
        <WebTelegramCard project={project} notice={telegramNotice} />

        <WebAiCard project={project} notice={aiNotice} aiRuntime={aiRuntime} />

        <WebStatusCard
          eyebrow="Posts"
          title="Auto Posts"
          status={project.autoPostsEnabled ? "Enabled" : "Draft"}
          statusTone={project.autoPostsEnabled ? "active" : "neutral"}
          items={[
            {
              label: "Auto publish",
              value: project.autoPostsEnabled ? "Увімкнено" : "Вимкнено",
            },
            {
              label: "Workflow",
              value: "Draft -> Review -> Publish",
            },
            {
              label: "Content style",
              value: "Ще не задано",
            },
          ]}
          note="Я рекомендую почати з генерації draft-постів, а не прямої автопублікації в групу."
        />

        <WebStatusCard
          eyebrow="Sources"
          title="Knowledge Sources"
          status="Planned"
          items={[
            {
              label: "Telegram data",
              value: "Питання клієнтів",
            },
            {
              label: "Project brief",
              value: project.description || "Буде взято з опису проєкту",
            },
            {
              label: "AI knowledge base",
              value: project.aiInstructions?.trim()
                ? "Заповнено"
                : "Поки порожньо",
            },
          ]}
          note="Зараз бот бере базовий опис проєкту і розширений AI-контекст. Пізніше сюди можна додати окремі джерела, FAQ та зовнішні API."
        />
      </div>

      <WebTelegramMessages
        initialMessages={telegramMessages}
        projectId={project.id}
        webhookEnabled={project.telegramWebhookEnabled}
      />
    </div>
  );
}
