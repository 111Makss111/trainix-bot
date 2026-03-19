import { updateProjectAiInstructionsAction } from "@/app/cabinet/web/actions";
import type { WebProject } from "@/lib/web-projects";
import { FormPendingState } from "./FormPendingState";
import { FormSubmitButton } from "./FormSubmitButton";

type WebAiCardProps = {
  project: WebProject;
  notice?: string;
  aiRuntime: {
    provider: string;
    model: string;
    apiKeyConfigured: boolean;
    knowledgeFilePath: string | null;
    knowledgeLoaded: boolean;
  };
};

const aiNoticeMessages: Record<string, { tone: "success" | "error"; text: string }> = {
  saved: {
    tone: "success",
    text: "AI-контекст збережено. Нові відповіді бота вже будуть враховувати цей опис.",
  },
};

export function WebAiCard({ project, notice, aiRuntime }: WebAiCardProps) {
  const message = notice ? aiNoticeMessages[notice] : null;
  const aiReady =
    project.smartRepliesEnabled &&
    project.telegramWebhookEnabled &&
    aiRuntime.apiKeyConfigured &&
    Boolean(
      aiRuntime.knowledgeLoaded ||
        project.aiInstructions?.trim() ||
        project.description?.trim(),
    );

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            AI
          </p>
          <h3 className="mt-3 text-2xl font-medium text-white">
            Brain Layer
          </h3>
        </div>

        <span
          className={[
            "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em]",
            aiReady
              ? "border-emerald-300/18 bg-emerald-300/10 text-emerald-100"
              : "border-white/10 bg-white/[0.04] text-white/60",
          ].join(" ")}
        >
          {aiReady ? "Ready" : "Needs context"}
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

      <div className="mt-5 grid gap-3">
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Provider</span>
          <span className="text-sm font-medium text-white/84">
            {project.aiProvider || aiRuntime.provider}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Model</span>
          <span className="text-sm font-medium text-white/84">
            {project.aiModel || aiRuntime.model}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Gemini API key</span>
          <span className="text-sm font-medium text-white/84">
            {aiRuntime.apiKeyConfigured ? "Підключено" : "Відсутній"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Smart replies</span>
          <span className="text-sm font-medium text-white/84">
            {project.smartRepliesEnabled ? "Увімкнено" : "Вимкнено"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">JSON knowledge base</span>
          <span className="text-sm font-medium text-white/84">
            {aiRuntime.knowledgeLoaded ? "Підключено" : "Не знайдено"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3">
          <span className="text-sm text-white/46">Knowledge file</span>
          <span className="max-w-[18rem] truncate text-sm font-medium text-white/84">
            {aiRuntime.knowledgeFilePath || "Ще не задано"}
          </span>
        </div>
      </div>

      <form action={updateProjectAiInstructionsAction} className="mt-5 space-y-4">
        <input type="hidden" name="projectId" value={project.id} />

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.24em] text-white/36">
            Owner notes / extra context
          </span>
          <textarea
            name="aiInstructions"
            rows={12}
            defaultValue={project.aiInstructions ?? ""}
            placeholder={[
              "Що це за проект?",
              "Для кого він?",
              "Які головні функції?",
              "Як бот має відповідати користувачам?",
              "Що не можна вигадувати або обіцяти?",
            ].join("\n")}
            className="min-h-[18rem] rounded-[1.5rem] border border-white/10 bg-[#091122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
          />
        </label>

        <div className="rounded-[1.5rem] border border-white/8 bg-[#091122]/60 px-4 py-4 text-sm leading-7 text-white/52">
          Основна структурована база знань тепер може лежати в JSON-файлі всередині
          проєкту. Це поле залишилось як додаткові owner notes: нюанси тону,
          уточнення, заборони і тимчасові інструкції.
        </div>

        <div className="flex flex-wrap gap-3">
          <FormSubmitButton
            idleLabel="Зберегти AI-контекст"
            pendingLabel="Зберігаю..."
            className="rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))]"
          />
        </div>

        <FormPendingState label="Оновлюю AI-контекст для цього проєкту." />
      </form>
    </section>
  );
}
