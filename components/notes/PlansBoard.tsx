"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPlanAction,
  deletePlanAction,
  finishPlanAction,
  updatePlanAction,
  togglePlanInProgressAction,
} from "@/app/cabinet/notes/actions";
import type { PlanItem, PlanPeriod } from "@/lib/plans";
import { PlanProgressToggle } from "./PlanProgressToggle";

export type NotesViewMode = "active" | "history";

type PlansBoardProps = {
  groupedPlans: Record<PlanPeriod, PlanItem[]>;
  activePeriod: PlanPeriod;
  activeMode: NotesViewMode;
};

type GroupedPlans = Record<PlanPeriod, PlanItem[]>;

const sectionConfig: Record<
  PlanPeriod,
  {
    title: string;
    eyebrow: string;
    titlePlaceholder: string;
    descriptionPlaceholder: string;
    emptyActiveText: string;
    emptyHistoryText: string;
  }
> = {
  today: {
    title: "Сьогодні",
    eyebrow: "Today",
    titlePlaceholder: "Наприклад: доробити Facebook publish flow",
    descriptionPlaceholder:
      "Коротко опиши, що саме треба зробити, якщо це неочевидно...",
    emptyActiveText: "Тут поки порожньо. Додай першу задачу на сьогодні.",
    emptyHistoryText: "Історія за сьогодні поки порожня.",
  },
  week: {
    title: "Тиждень",
    eyebrow: "Week",
    titlePlaceholder: "Наприклад: допиляти Notes UX",
    descriptionPlaceholder:
      "Що саме хочеш тримати в полі зору протягом цього тижня?",
    emptyActiveText: "Тут поки порожньо. Додай головну задачу на тиждень.",
    emptyHistoryText: "Завершених тижневих задач поки немає.",
  },
  month: {
    title: "Місяць",
    eyebrow: "Month",
    titlePlaceholder: "Наприклад: зібрати Social Hub v1",
    descriptionPlaceholder:
      "Опиши більше деталей, якщо задача велика або має кілька кроків.",
    emptyActiveText: "Тут поки порожньо. Додай головну ціль на місяць.",
    emptyHistoryText: "Завершених місячних задач поки немає.",
  },
  year: {
    title: "Рік",
    eyebrow: "Year",
    titlePlaceholder: "Наприклад: довести Trainix до повноцінного продукту",
    descriptionPlaceholder:
      "Велика ідея, напрям або довгострокова ціль, яку не хочеш втратити.",
    emptyActiveText: "Тут поки порожньо. Додай головну ціль на рік.",
    emptyHistoryText: "Річна історія поки порожня.",
  },
};

const orderedPeriods = ["today", "week", "month", "year"] as const;
const modeConfig: Record<NotesViewMode, { label: string }> = {
  active: {
    label: "Активні",
  },
  history: {
    label: "Історія",
  },
};

const statusWeight = {
  in_progress: 1,
  todo: 2,
  done: 3,
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatElapsedTime(value: string, now: number) {
  const diffMs = now - new Date(value).getTime();
  const totalMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (totalMinutes < 60) {
    return `${totalMinutes} хв`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!minutes) {
    return `${hours} год`;
  }

  return `${hours} год ${minutes} хв`;
}

function cloneGroupedPlans(groupedPlans: GroupedPlans): GroupedPlans {
  return {
    today: [...groupedPlans.today],
    week: [...groupedPlans.week],
    month: [...groupedPlans.month],
    year: [...groupedPlans.year],
  };
}

function sortPlans(plans: PlanItem[]) {
  return [...plans].sort((left, right) => {
    const statusDiff = statusWeight[left.status] - statusWeight[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
}

function upsertPlan(groupedPlans: GroupedPlans, plan: PlanItem): GroupedPlans {
  const nextPlans = cloneGroupedPlans(groupedPlans);

  nextPlans[plan.period] = sortPlans([
    plan,
    ...nextPlans[plan.period].filter((item) => item.id !== plan.id),
  ]);

  return nextPlans;
}

function removePlan(
  groupedPlans: GroupedPlans,
  period: PlanPeriod,
  planId: string,
): GroupedPlans {
  const nextPlans = cloneGroupedPlans(groupedPlans);
  nextPlans[period] = nextPlans[period].filter((plan) => plan.id !== planId);
  return nextPlans;
}

function useUrlState(activePeriod: PlanPeriod, activeMode: NotesViewMode) {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("period", activePeriod);
    url.searchParams.set("mode", activeMode);
    window.history.replaceState({}, "", url.toString());
  }, [activeMode, activePeriod]);
}

function AddPlanForm({
  period,
  isCreating,
  onCreate,
}: {
  period: PlanPeriod;
  isCreating: boolean;
  onCreate: (formData: FormData, form: HTMLFormElement) => Promise<void>;
}) {
  const config = sectionConfig[period];

  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void onCreate(new FormData(form), form);
      }}
    >
      <input
        type="text"
        name="title"
        placeholder={config.titlePlaceholder}
        disabled={isCreating}
        className="h-12 w-full rounded-[1.3rem] border border-white/10 bg-[#0a1122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18 focus:bg-[#0d152a] disabled:cursor-not-allowed disabled:opacity-60"
      />
      <textarea
        name="description"
        rows={3}
        disabled={isCreating}
        placeholder={config.descriptionPlaceholder}
        className="w-full resize-none rounded-[1.5rem] border border-white/10 bg-[#0a1122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18 focus:bg-[#0d152a] disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={isCreating}
        className="rounded-full border border-white/14 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/88 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCreating ? "Додаю..." : "Додати нотатку"}
      </button>
    </form>
  );
}

function ActivePlanRow({
  plan,
  now,
  isBusy,
  onTogglePending,
  onFinish,
  onDelete,
  onUpdate,
}: {
  plan: PlanItem;
  now: number;
  isBusy: boolean;
  onTogglePending: (plan: PlanItem) => Promise<void>;
  onFinish: (plan: PlanItem) => Promise<void>;
  onDelete: (plan: PlanItem) => Promise<void>;
  onUpdate: (
    plan: PlanItem,
    formData: FormData,
    form: HTMLFormElement,
  ) => Promise<void>;
}) {
  const isPending = plan.status === "in_progress";

  return (
    <article
      className={[
        "rounded-[1.5rem] border px-4 py-4 transition",
        isPending
          ? "border-sky-300/26 bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(10,17,34,0.94),rgba(56,189,248,0.04))] shadow-[0_0_0_1px_rgba(125,211,252,0.08),0_0_40px_rgba(56,189,248,0.08)]"
          : "border-white/10 bg-[#0a1122]/92",
        isBusy ? "opacity-85" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <details className="min-w-0 flex-1 group">
          <summary className="list-none cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white/88">
                  {plan.title}
                </p>
                <p className="mt-1 truncate text-xs uppercase tracking-[0.2em] text-white/34">
                  {plan.description ? "Натисни, щоб побачити опис" : "Без опису"}
                </p>
              </div>

              <div
                className={[
                  "shrink-0 rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] transition",
                  isPending
                    ? "border-sky-300/24 bg-sky-300/16 text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.16)]"
                    : "border-white/10 bg-white/[0.04] text-white/58 group-open:border-white/18 group-open:text-white/82",
                ].join(" ")}
              >
                {isPending ? "Pending" : "Open"}
              </div>
            </div>
          </summary>

          <div className="mt-4 space-y-4 rounded-[1.3rem] border border-white/8 bg-black/10 px-4 py-4">
            <div className="text-sm leading-7 text-white/68">
              {plan.description ? (
                <p>{plan.description}</p>
              ) : (
                <p className="text-white/36">
                  Опису поки немає. Можеш додати його через редагування.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase tracking-[0.2em] text-white/32">
              <span>Оновлено {formatDate(plan.updatedAt)}</span>
              {plan.startedAt ? (
                <span>В роботі {formatElapsedTime(plan.startedAt, now)}</span>
              ) : null}
            </div>

            <details className="group/edit">
              <summary className="cursor-pointer list-none rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white/58 transition hover:border-white/14 hover:text-white/88 [&::-webkit-details-marker]:hidden">
                Змінити
              </summary>

              <form
                className="mt-3 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onUpdate(plan, new FormData(event.currentTarget), event.currentTarget);
                }}
              >
                <input
                  type="text"
                  name="title"
                  defaultValue={plan.title}
                  disabled={isBusy}
                  className="h-11 w-full rounded-[1rem] border border-white/10 bg-[#07101f] px-4 text-sm text-white outline-none transition focus:border-white/18 focus:bg-[#091327] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <textarea
                  name="description"
                  defaultValue={plan.description || ""}
                  rows={4}
                  disabled={isBusy}
                  className="w-full resize-none rounded-[1.2rem] border border-white/10 bg-[#07101f] px-4 py-3 text-sm leading-7 text-white outline-none transition focus:border-white/18 focus:bg-[#091327] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isBusy}
                  className="rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-medium text-white/88 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Зберегти
                </button>
              </form>
            </details>
          </div>
        </details>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-0.5">
          <PlanProgressToggle
            checked={isPending}
            disabled={isBusy}
            onToggle={() => {
              void onTogglePending(plan);
            }}
          />

          {isPending ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                void onFinish(plan);
              }}
              className="rounded-full border border-emerald-300/20 bg-emerald-300/12 px-3 py-2 text-[0.68rem] uppercase tracking-[0.2em] text-emerald-50 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Закінчити
            </button>
          ) : null}

          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              void onDelete(plan);
            }}
            className="rounded-full border border-white/10 px-3 py-2 text-[0.68rem] uppercase tracking-[0.2em] text-white/52 transition hover:border-red-300/24 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Видалити
          </button>
        </div>
      </div>
    </article>
  );
}

function HistoryPlanRow({
  plan,
  isBusy,
  onDelete,
}: {
  plan: PlanItem;
  isBusy: boolean;
  onDelete: (plan: PlanItem) => Promise<void>;
}) {
  return (
    <article className="rounded-[1.5rem] border border-emerald-300/12 bg-emerald-300/[0.06] px-4 py-4 transition">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/18 text-sm font-medium text-emerald-50">
          ✓
        </div>

        <details className="min-w-0 flex-1 group">
          <summary className="list-none cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white/42 line-through">
                  {plan.title}
                </p>
                <p className="mt-1 truncate text-xs uppercase tracking-[0.2em] text-white/34">
                  {plan.description ? "Натисни, щоб побачити опис" : "Без опису"}
                </p>
              </div>

              <div className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/12 px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-emerald-50">
                Done
              </div>
            </div>
          </summary>

          <div className="mt-4 space-y-4 rounded-[1.3rem] border border-white/8 bg-black/10 px-4 py-4">
            <div className="text-sm leading-7 text-white/52">
              {plan.description ? (
                <p>{plan.description}</p>
              ) : (
                <p className="text-white/36">Опису не було.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase tracking-[0.2em] text-white/32">
              <span>Оновлено {formatDate(plan.updatedAt)}</span>
              {plan.completedAt ? (
                <span>Закінчено {formatDate(plan.completedAt)}</span>
              ) : null}
            </div>
          </div>
        </details>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            void onDelete(plan);
          }}
          className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-[0.68rem] uppercase tracking-[0.2em] text-white/52 transition hover:border-red-300/24 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Видалити
        </button>
      </div>
    </article>
  );
}

export function PlansBoard({
  groupedPlans,
  activePeriod,
  activeMode,
}: PlansBoardProps) {
  const [plansState, setPlansState] = useState<GroupedPlans>(() =>
    cloneGroupedPlans(groupedPlans),
  );
  const [selectedPeriod, setSelectedPeriod] = useState(activePeriod);
  const [selectedMode, setSelectedMode] = useState<NotesViewMode>(activeMode);
  const [isCreating, setIsCreating] = useState(false);
  const [busyPlanIds, setBusyPlanIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useUrlState(selectedPeriod, selectedMode);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const currentConfig = sectionConfig[selectedPeriod];
  const visiblePlans = useMemo(
    () =>
      plansState[selectedPeriod].filter((plan) =>
        selectedMode === "history" ? plan.status === "done" : plan.status !== "done",
      ),
    [plansState, selectedMode, selectedPeriod],
  );

  function setPlanBusy(planId: string, nextBusy: boolean) {
    setBusyPlanIds((current) => {
      if (nextBusy) {
        return current.includes(planId) ? current : [...current, planId];
      }

      return current.filter((id) => id !== planId);
    });
  }

  async function handleCreate(formData: FormData, form: HTMLFormElement) {
    const title = formData.get("title");
    const description = formData.get("description");

    if (typeof title !== "string" || typeof description !== "string") {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFeedback("Спочатку дай короткий заголовок нотатці.");
      return;
    }

    setFeedback(null);
    setIsCreating(true);

    const nowIso = new Date().toISOString();
    const tempPlan: PlanItem = {
      id: `temp-${Date.now()}`,
      ownerEmail: "local",
      period: selectedPeriod,
      title: trimmedTitle,
      description: description.trim() || null,
      status: "todo",
      completed: false,
      startedAt: null,
      completedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const previousSnapshot = cloneGroupedPlans(plansState);

    setPlansState((current) => upsertPlan(current, tempPlan));
    form.reset();

    try {
      const result = await createPlanAction({
        period: selectedPeriod,
        title,
        description,
      });

      if (!result.ok) {
        setPlansState(previousSnapshot);
        setFeedback(result.error);
        return;
      }

      if ("plan" in result) {
        setPlansState((current) =>
          upsertPlan(removePlan(current, selectedPeriod, tempPlan.id), result.plan),
        );
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate(
    plan: PlanItem,
    formData: FormData,
    form: HTMLFormElement,
  ) {
    const title = formData.get("title");
    const description = formData.get("description");

    if (typeof title !== "string" || typeof description !== "string") {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFeedback("Заголовок не може бути порожнім.");
      return;
    }

    setFeedback(null);
    setPlanBusy(plan.id, true);
    const previousSnapshot = cloneGroupedPlans(plansState);
    const optimisticPlan: PlanItem = {
      ...plan,
      title: trimmedTitle,
      description: description.trim() || null,
      updatedAt: new Date().toISOString(),
    };

    setPlansState((current) => upsertPlan(current, optimisticPlan));

    try {
      const result = await updatePlanAction({
        planId: plan.id,
        title,
        description,
      });

      if (!result.ok) {
        setPlansState(previousSnapshot);
        setFeedback(result.error);
        return;
      }

      if ("plan" in result) {
        setPlansState((current) => upsertPlan(current, result.plan));
        const details = form.closest("details");

        if (details instanceof HTMLDetailsElement) {
          details.open = false;
        }
      }
    } finally {
      setPlanBusy(plan.id, false);
    }
  }

  async function handleTogglePending(plan: PlanItem) {
    setFeedback(null);
    setPlanBusy(plan.id, true);
    const previousSnapshot = cloneGroupedPlans(plansState);
    const nextStatus = plan.status === "in_progress" ? "todo" : "in_progress";
    const optimisticPlan: PlanItem = {
      ...plan,
      status: nextStatus,
      completed: false,
      startedAt: nextStatus === "in_progress" ? new Date().toISOString() : null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    };

    setPlansState((current) => upsertPlan(current, optimisticPlan));

    try {
      const result = await togglePlanInProgressAction({
        planId: plan.id,
      });

      if (!result.ok) {
        setPlansState(previousSnapshot);
        setFeedback(result.error);
        return;
      }

      if ("plan" in result) {
        setPlansState((current) => upsertPlan(current, result.plan));
      }
    } finally {
      setPlanBusy(plan.id, false);
    }
  }

  async function handleFinish(plan: PlanItem) {
    setFeedback(null);
    setPlanBusy(plan.id, true);
    const previousSnapshot = cloneGroupedPlans(plansState);
    const optimisticPlan: PlanItem = {
      ...plan,
      status: "done",
      completed: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPlansState((current) => upsertPlan(current, optimisticPlan));

    try {
      const result = await finishPlanAction({
        planId: plan.id,
      });

      if (!result.ok) {
        setPlansState(previousSnapshot);
        setFeedback(result.error);
        return;
      }

      if ("plan" in result) {
        setPlansState((current) => upsertPlan(current, result.plan));
      }
    } finally {
      setPlanBusy(plan.id, false);
    }
  }

  async function handleDelete(plan: PlanItem) {
    setFeedback(null);
    setPlanBusy(plan.id, true);
    const previousSnapshot = cloneGroupedPlans(plansState);

    setPlansState((current) => removePlan(current, plan.period, plan.id));

    try {
      const result = await deletePlanAction({
        planId: plan.id,
      });

      if (!result.ok) {
        setPlansState(previousSnapshot);
        setFeedback(result.error);
      }
    } finally {
      setPlanBusy(plan.id, false);
    }
  }

  return (
    <div className="space-y-4">
      <nav className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md md:grid-cols-4">
        {orderedPeriods.map((period) => {
          const isActive = period === selectedPeriod;
          const activeCount = plansState[period].filter(
            (plan) => plan.status !== "done",
          ).length;
          const historyCount = plansState[period].filter(
            (plan) => plan.status === "done",
          ).length;

          return (
            <button
              key={period}
              type="button"
              onClick={() => {
                setSelectedPeriod(period);
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
                  {sectionConfig[period].title}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                  {selectedMode === "history" ? historyCount : activeCount}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-white/48">
                Активні: {activeCount} · Історія: {historyCount}
              </p>
            </button>
          );
        })}
      </nav>

      <section className="flex min-h-[30rem] flex-col rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
              {currentConfig.eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-medium text-white">
              {currentConfig.title}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] border border-white/10 bg-[#091122]/64 p-2">
            {(Object.keys(modeConfig) as NotesViewMode[]).map((mode) => {
              const isActive = mode === selectedMode;
              const count = plansState[selectedPeriod].filter((plan) =>
                mode === "history" ? plan.status === "done" : plan.status !== "done",
              ).length;

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSelectedMode(mode);
                  }}
                  className={[
                    "rounded-[1rem] border px-4 py-3 text-sm transition",
                    isActive
                      ? "border-sky-300/20 bg-sky-300/[0.12] text-white"
                      : "border-white/8 bg-transparent text-white/58 hover:border-white/14 hover:text-white/88",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{modeConfig[mode].label}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                      {count}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {feedback ? (
          <div className="mt-5 rounded-[1.2rem] border border-amber-300/14 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-50/92">
            {feedback}
          </div>
        ) : null}

        {selectedMode === "active" ? (
          <AddPlanForm
            period={selectedPeriod}
            isCreating={isCreating}
            onCreate={handleCreate}
          />
        ) : null}

        <div className="mt-6 flex flex-1 flex-col gap-3">
          {visiblePlans.length ? (
            visiblePlans.map((plan) =>
              selectedMode === "history" ? (
                <HistoryPlanRow
                  key={plan.id}
                  plan={plan}
                  isBusy={busyPlanIds.includes(plan.id)}
                  onDelete={handleDelete}
                />
              ) : (
                <ActivePlanRow
                  key={plan.id}
                  plan={plan}
                  now={now}
                  isBusy={busyPlanIds.includes(plan.id)}
                  onTogglePending={handleTogglePending}
                  onFinish={handleFinish}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
              ),
            )
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-[#07101f]/45 px-5 py-10 text-center text-sm leading-7 text-white/38">
              {selectedMode === "history"
                ? currentConfig.emptyHistoryText
                : currentConfig.emptyActiveText}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
