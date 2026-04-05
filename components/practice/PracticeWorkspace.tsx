"use client";

import { useMemo, useState, useTransition } from "react";
import {
  deletePracticeTaskAction,
  generatePracticeTasksAction,
  updatePracticeTaskStatusAction,
} from "@/app/cabinet/practice/actions";
import { CopyTextButton } from "@/components/social/shared/CopyTextButton";
import type {
  PracticeDifficulty,
  PracticeStack,
  PracticeTask,
  PracticeTaskStatus,
  PracticeTaskType,
} from "@/lib/practice";

type PracticeWorkspaceProps = {
  initialTasks: PracticeTask[];
};

type PracticeTab = "generator" | "active" | "history";

const stackOptions: Array<{ value: PracticeStack; label: string }> = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "react", label: "React" },
  { value: "html-css", label: "HTML/CSS" },
  { value: "node", label: "Node.js" },
];

const difficultyOptions: Array<{ value: PracticeDifficulty; label: string }> = [
  { value: "easy", label: "Легка" },
  { value: "medium", label: "Середня" },
  { value: "hard", label: "Складна" },
];

const taskTypeOptions: Array<{ value: PracticeTaskType; label: string }> = [
  { value: "logic", label: "Логіка" },
  { value: "components", label: "Компоненти" },
  { value: "layout", label: "Верстка" },
  { value: "api", label: "API" },
  { value: "state", label: "Стани" },
  { value: "typing", label: "Типізація" },
  { value: "backend", label: "Backend" },
];

const workspaceTabs: Array<{ value: PracticeTab; label: string }> = [
  { value: "generator", label: "Генератор" },
  { value: "active", label: "Активні" },
  { value: "history", label: "Історія" },
];

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function upsertTasks(tasks: PracticeTask[], nextTasks: PracticeTask[]) {
  const map = new Map(tasks.map((task) => [task.id, task] as const));

  for (const task of nextTasks) {
    map.set(task.id, task);
  }

  return [...map.values()].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function deleteTask(tasks: PracticeTask[], taskId: string) {
  return tasks.filter((task) => task.id !== taskId);
}

function statusLabel(status: PracticeTaskStatus) {
  return status === "solved" ? "Вирішено" : "Активна";
}

function stackLabel(stack: PracticeStack) {
  return stackOptions.find((option) => option.value === stack)?.label ?? stack;
}

type TaskDetailProps = {
  task: PracticeTask | null;
  onSolve: (task: PracticeTask) => void;
  onActivate: (task: PracticeTask) => void;
  onDelete: (task: PracticeTask) => void;
  isPending: boolean;
};

function TaskDetail({
  task,
  onSolve,
  onActivate,
  onDelete,
  isPending,
}: TaskDetailProps) {
  if (!task) {
    return (
      <div className="flex min-h-[32rem] items-center justify-center rounded-[1.8rem] border border-dashed border-white/10 bg-[#08101d]/70 px-6 text-center text-sm leading-7 text-white/38">
        Обери задачу зі списку ліворуч, і тут з’явиться умова, starter code, підказка та очікуваний результат.
      </div>
    );
  }

  return (
    <div className="rounded-[1.8rem] border border-white/10 bg-[#08101d]/78 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/58">
              {stackLabel(task.stack)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/58">
              {task.difficulty}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/58">
              {task.taskType}
            </span>
            <span
              className={[
                "rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em]",
                task.status === "solved"
                  ? "border-emerald-300/16 bg-emerald-300/10 text-emerald-50"
                  : "border-sky-300/16 bg-sky-300/10 text-sky-50",
              ].join(" ")}
            >
              {statusLabel(task.status)}
            </span>
          </div>
          <h3 className="mt-4 text-2xl font-medium text-white">{task.title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/64">
            {task.summary}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {task.status === "active" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onSolve(task)}
              className="rounded-full border border-emerald-300/18 bg-emerald-300/12 px-4 py-2.5 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Позначити як вирішену
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onActivate(task)}
              className="rounded-full border border-sky-300/18 bg-sky-300/12 px-4 py-2.5 text-sm font-medium text-sky-50 transition hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Повернути в активні
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => onDelete(task)}
            className="rounded-full border border-white/12 px-4 py-2.5 text-sm font-medium text-white/62 transition hover:border-red-300/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Видалити
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <section className="rounded-[1.4rem] border border-white/8 bg-black/10 p-4">
          <h4 className="text-sm font-medium text-white">Умова задачі</h4>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/72">
            {task.instructions}
          </p>
        </section>

        {task.providedData ? (
          <section className="rounded-[1.4rem] border border-white/8 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-medium text-white">Надані значення</h4>
              <CopyTextButton text={task.providedData} idleLabel="Скопіювати" />
            </div>
            <pre className="mt-3 overflow-x-auto rounded-[1rem] border border-white/8 bg-[#050b16] p-4 text-xs leading-6 text-white/72">
              <code>{task.providedData}</code>
            </pre>
          </section>
        ) : null}

        {task.starterCode ? (
          <section className="rounded-[1.4rem] border border-white/8 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-medium text-white">Starter code</h4>
              <CopyTextButton text={task.starterCode} idleLabel="Скопіювати код" />
            </div>
            <pre className="mt-3 overflow-x-auto rounded-[1rem] border border-white/8 bg-[#050b16] p-4 text-xs leading-6 text-white/72">
              <code>{task.starterCode}</code>
            </pre>
          </section>
        ) : null}

        {task.hint ? (
          <section className="rounded-[1.4rem] border border-amber-300/14 bg-amber-300/[0.07] p-4">
            <h4 className="text-sm font-medium text-amber-50">Підказка</h4>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-amber-50/86">
              {task.hint}
            </p>
          </section>
        ) : null}

        {task.expectedOutcome ? (
          <section className="rounded-[1.4rem] border border-emerald-300/14 bg-emerald-300/[0.07] p-4">
            <h4 className="text-sm font-medium text-emerald-50">Очікуваний результат</h4>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-50/86">
              {task.expectedOutcome}
            </p>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.22em] text-white/34">
          <span>Створено {formatDate(task.createdAt)}</span>
          {task.solvedAt ? <span>Вирішено {formatDate(task.solvedAt)}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function PracticeWorkspace({ initialTasks }: PracticeWorkspaceProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTab, setActiveTab] = useState<PracticeTab>("generator");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTasks[0]?.id ?? null,
  );
  const [stack, setStack] = useState<PracticeStack>("javascript");
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>("easy");
  const [taskType, setTaskType] = useState<PracticeTaskType>("logic");
  const [count, setCount] = useState<number>(3);
  const [includeHint, setIncludeHint] = useState(true);
  const [includeStarterCode, setIncludeStarterCode] = useState(true);
  const [includeExpectedOutcome, setIncludeExpectedOutcome] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [pendingTaskId, startTaskTransition] = useTransition();

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status === "active"),
    [tasks],
  );
  const historyTasks = useMemo(
    () => tasks.filter((task) => task.status === "solved"),
    [tasks],
  );
  const visibleTasks = activeTab === "history" ? historyTasks : activeTasks;
  const selectedTask =
    visibleTasks.find((task) => task.id === selectedTaskId) ??
    visibleTasks[0] ??
    null;

  async function handleGenerate() {
    setFeedback(null);

    startGenerating(async () => {
      const result = await generatePracticeTasksAction({
        stack,
        difficulty,
        taskType,
        count,
        includeHint,
        includeStarterCode,
        includeExpectedOutcome,
      });

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      setTasks((current) => upsertTasks(current, result.tasks));
      setActiveTab("active");
      setSelectedTaskId(result.tasks[0]?.id ?? null);
      setFeedback(`Готово: згенеровано ${result.tasks.length} нових задач.`);
    });
  }

  function handleStatusChange(task: PracticeTask, status: PracticeTaskStatus) {
    setFeedback(null);
    const previousTasks = tasks;
    const optimisticTask: PracticeTask = {
      ...task,
      status,
      solvedAt: status === "solved" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };

    setTasks((current) => upsertTasks(current, [optimisticTask]));

    startTaskTransition(async () => {
      const result = await updatePracticeTaskStatusAction({
        taskId: task.id,
        status,
      });

      if (!result.ok) {
        setTasks(previousTasks);
        setFeedback(result.error);
        return;
      }

      setTasks((current) => upsertTasks(current, [result.task]));
      setFeedback(
        status === "solved"
          ? "Задача переміщена в історію."
          : "Задача знову повернулась в активні.",
      );
      setActiveTab(status === "solved" ? "history" : "active");
      setSelectedTaskId(result.task.id);
    });
  }

  function handleDelete(task: PracticeTask) {
    setFeedback(null);
    const previousTasks = tasks;
    setTasks((current) => deleteTask(current, task.id));

    startTaskTransition(async () => {
      const result = await deletePracticeTaskAction({
        taskId: task.id,
      });

      if (!result.ok) {
        setTasks(previousTasks);
        setFeedback(result.error);
        return;
      }

      setFeedback("Задачу видалено.");
      if (selectedTaskId === task.id) {
        setSelectedTaskId(null);
      }
    });
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Practice
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">Генератор dev-задач</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
            Обирай стек, складність і тип задач. Система збереже їх у базу, не дасть
            часто повторюватися і підготує starter code, підказки та очікуваний
            результат.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-[1.2rem] border border-white/10 bg-[#091122]/64 p-2">
          {workspaceTabs.map((tab) => {
            const countValue =
              tab.value === "active"
                ? activeTasks.length
                : tab.value === "history"
                  ? historyTasks.length
                  : null;

            return (
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
                <div className="flex items-center justify-between gap-3">
                  <span>{tab.label}</span>
                  {countValue !== null ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                      {countValue}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/74">
          {feedback}
        </div>
      ) : null}

      {activeTab === "generator" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.6rem] border border-white/10 bg-[#08101d]/78 p-5">
            <h3 className="text-lg font-medium text-white">Налаштування генерації</h3>
            <div className="mt-5 grid gap-5">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.28em] text-white/38">
                  Stack
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stackOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStack(option.value)}
                      className={[
                        "rounded-full border px-4 py-2.5 text-sm transition",
                        stack === option.value
                          ? "border-sky-300/18 bg-sky-300/[0.12] text-white"
                          : "border-white/10 bg-white/[0.04] text-white/62 hover:border-white/16 hover:text-white/88",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.28em] text-white/38">
                    Складність
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {difficultyOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDifficulty(option.value)}
                        className={[
                          "rounded-full border px-4 py-2.5 text-sm transition",
                          difficulty === option.value
                            ? "border-sky-300/18 bg-sky-300/[0.12] text-white"
                            : "border-white/10 bg-white/[0.04] text-white/62 hover:border-white/16 hover:text-white/88",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.28em] text-white/38">
                    Кількість
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[1, 3, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCount(value)}
                        className={[
                          "rounded-full border px-4 py-2.5 text-sm transition",
                          count === value
                            ? "border-sky-300/18 bg-sky-300/[0.12] text-white"
                            : "border-white/10 bg-white/[0.04] text-white/62 hover:border-white/16 hover:text-white/88",
                        ].join(" ")}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.28em] text-white/38">
                  Тип задач
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {taskTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTaskType(option.value)}
                      className={[
                        "rounded-full border px-4 py-2.5 text-sm transition",
                        taskType === option.value
                          ? "border-sky-300/18 bg-sky-300/[0.12] text-white"
                          : "border-white/10 bg-white/[0.04] text-white/62 hover:border-white/16 hover:text-white/88",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 rounded-[1.4rem] border border-white/10 bg-[#050b16]/72 p-4">
                <label className="flex items-center justify-between gap-4 rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-white/72">Додати підказку</span>
                  <input
                    type="checkbox"
                    checked={includeHint}
                    onChange={(event) => setIncludeHint(event.target.checked)}
                    className="h-4 w-4 accent-sky-400"
                  />
                </label>
                <label className="flex items-center justify-between gap-4 rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-white/72">Додати starter code</span>
                  <input
                    type="checkbox"
                    checked={includeStarterCode}
                    onChange={(event) => setIncludeStarterCode(event.target.checked)}
                    className="h-4 w-4 accent-sky-400"
                  />
                </label>
                <label className="flex items-center justify-between gap-4 rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-white/72">
                    Додати expected outcome
                  </span>
                  <input
                    type="checkbox"
                    checked={includeExpectedOutcome}
                    onChange={(event) => setIncludeExpectedOutcome(event.target.checked)}
                    className="h-4 w-4 accent-sky-400"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="rounded-[1.2rem] border border-sky-300/16 bg-[linear-gradient(135deg,rgba(125,211,252,0.18),rgba(9,17,34,0.92))] px-5 py-4 text-sm font-medium text-white transition hover:shadow-[0_0_28px_rgba(56,189,248,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? "Генерую задачі..." : `Згенерувати ${count} задачі`}
              </button>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-[#08101d]/78 p-5">
            <h3 className="text-lg font-medium text-white">Як це працює</h3>
            <div className="mt-5 space-y-4 text-sm leading-7 text-white/62">
              <p>
                Система генерує задачі саме під обраний стек і складність, додає
                starter context і зберігає їх у базі.
              </p>
              <p>
                Уже використані задачі враховуються, тому модуль не буде постійно
                крутити одне й те саме формулювання.
              </p>
              <p>
                Після генерації все переходить у `Активні`, де можна спокійно
                відкривати умову, копіювати starter code і переносити вирішене в
                `Історію`.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.6rem] border border-white/10 bg-[#08101d]/78 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-medium text-white">
                {activeTab === "active" ? "Активні задачі" : "Історія"}
              </h3>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/58">
                {visibleTasks.length}
              </span>
            </div>

            <div className="mt-4 flex max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1">
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className={[
                      "rounded-[1.3rem] border px-4 py-4 text-left transition",
                      selectedTask?.id === task.id
                        ? "border-sky-300/18 bg-sky-300/[0.12]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/92">
                          {task.title}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/36">
                          {stackLabel(task.stack)} · {task.taskType}
                        </p>
                      </div>
                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.22em]",
                          task.status === "solved"
                            ? "border-emerald-300/16 bg-emerald-300/10 text-emerald-50"
                            : "border-sky-300/16 bg-sky-300/10 text-sky-50",
                        ].join(" ")}
                      >
                        {task.status === "solved" ? "Done" : "Live"}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/56">
                      {task.summary}
                    </p>
                  </button>
                ))
              ) : (
                <div className="flex min-h-[18rem] items-center justify-center rounded-[1.3rem] border border-dashed border-white/10 bg-black/10 px-5 text-center text-sm leading-7 text-white/38">
                  {activeTab === "active"
                    ? "Активних задач поки немає. Згенеруй перший набір у вкладці Генератор."
                    : "Історія поки порожня. Коли почнеш відмічати задачі як вирішені, вони з’являться тут."}
                </div>
              )}
            </div>
          </div>

          <TaskDetail
            task={selectedTask}
            onSolve={(task) => handleStatusChange(task, "solved")}
            onActivate={(task) => handleStatusChange(task, "active")}
            onDelete={handleDelete}
            isPending={pendingTaskId}
          />
        </div>
      )}
    </section>
  );
}
