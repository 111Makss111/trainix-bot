import Link from "next/link";
import {
  createPlanAction,
  deletePlanAction,
  finishPlanAction,
  updatePlanAction,
} from "@/app/cabinet/notes/actions";
import type { PlanItem, PlanPeriod } from "@/lib/plans";
import { PlanProgressToggle } from "./PlanProgressToggle";

export type NotesViewMode = "active" | "history";

type PlansBoardProps = {
  groupedPlans: Record<PlanPeriod, PlanItem[]>;
  activePeriod: PlanPeriod;
  activeMode: NotesViewMode;
};

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatElapsedTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
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

function AddPlanForm({
  period,
}: {
  period: PlanPeriod;
}) {
  const config = sectionConfig[period];

  return (
    <form action={createPlanAction} className="mt-5 space-y-3">
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="viewPeriod" value={period} />
      <input type="hidden" name="viewMode" value="active" />
      <input
        type="text"
        name="title"
        placeholder={config.titlePlaceholder}
        className="h-12 w-full rounded-[1.3rem] border border-white/10 bg-[#0a1122] px-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18 focus:bg-[#0d152a]"
      />
      <textarea
        name="description"
        rows={3}
        placeholder={config.descriptionPlaceholder}
        className="w-full resize-none rounded-[1.5rem] border border-white/10 bg-[#0a1122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18 focus:bg-[#0d152a]"
      />
      <button
        type="submit"
        className="rounded-full border border-white/14 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/88 transition hover:bg-white/12"
      >
        Додати нотатку
      </button>
    </form>
  );
}

function ActivePlanRow({
  plan,
  activePeriod,
}: {
  plan: PlanItem;
  activePeriod: PlanPeriod;
}) {
  const isPending = plan.status === "in_progress";

  return (
    <article
      className={[
        "rounded-[1.5rem] border px-4 py-4 transition",
        isPending
          ? "border-sky-300/26 bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(10,17,34,0.94),rgba(56,189,248,0.04))] shadow-[0_0_0_1px_rgba(125,211,252,0.08),0_0_40px_rgba(56,189,248,0.08)]"
          : "border-white/10 bg-[#0a1122]/92",
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
                <span>В роботі {formatElapsedTime(plan.startedAt)}</span>
              ) : null}
            </div>

            <details className="group/edit">
              <summary className="cursor-pointer list-none rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white/58 transition hover:border-white/14 hover:text-white/88 [&::-webkit-details-marker]:hidden">
                Змінити
              </summary>

              <form action={updatePlanAction} className="mt-3 space-y-3">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="viewPeriod" value={activePeriod} />
                <input type="hidden" name="viewMode" value="active" />
                <input
                  type="text"
                  name="title"
                  defaultValue={plan.title}
                  className="h-11 w-full rounded-[1rem] border border-white/10 bg-[#07101f] px-4 text-sm text-white outline-none transition focus:border-white/18 focus:bg-[#091327]"
                />
                <textarea
                  name="description"
                  defaultValue={plan.description || ""}
                  rows={4}
                  className="w-full resize-none rounded-[1.2rem] border border-white/10 bg-[#07101f] px-4 py-3 text-sm leading-7 text-white outline-none transition focus:border-white/18 focus:bg-[#091327]"
                />
                <button
                  type="submit"
                  className="rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-medium text-white/88 transition hover:bg-white/12"
                >
                  Зберегти
                </button>
              </form>
            </details>
          </div>
        </details>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-0.5">
          <PlanProgressToggle
            planId={plan.id}
            activePeriod={activePeriod}
            activeMode="active"
            isPending={isPending}
          />

          {isPending ? (
            <form action={finishPlanAction}>
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="viewPeriod" value={activePeriod} />
              <input type="hidden" name="viewMode" value="active" />
              <button
                type="submit"
                className="rounded-full border border-emerald-300/20 bg-emerald-300/12 px-3 py-2 text-[0.68rem] uppercase tracking-[0.2em] text-emerald-50 transition hover:bg-emerald-300/18"
              >
                Закінчити
              </button>
            </form>
          ) : null}

          <form action={deletePlanAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="viewPeriod" value={activePeriod} />
            <input type="hidden" name="viewMode" value="active" />
            <button
              type="submit"
              className="rounded-full border border-white/10 px-3 py-2 text-[0.68rem] uppercase tracking-[0.2em] text-white/52 transition hover:border-red-300/24 hover:text-red-100"
            >
              Видалити
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

function HistoryPlanRow({
  plan,
  activePeriod,
}: {
  plan: PlanItem;
  activePeriod: PlanPeriod;
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

        <form action={deletePlanAction} className="shrink-0">
          <input type="hidden" name="planId" value={plan.id} />
          <input type="hidden" name="viewPeriod" value={activePeriod} />
          <input type="hidden" name="viewMode" value="history" />
          <button
            type="submit"
            className="rounded-full border border-white/10 px-3 py-2 text-[0.68rem] uppercase tracking-[0.2em] text-white/52 transition hover:border-red-300/24 hover:text-red-100"
          >
            Видалити
          </button>
        </form>
      </div>
    </article>
  );
}

export function PlansBoard({
  groupedPlans,
  activePeriod,
  activeMode,
}: PlansBoardProps) {
  const config = sectionConfig[activePeriod];
  const visiblePlans = groupedPlans[activePeriod].filter((plan) =>
    activeMode === "history" ? plan.status === "done" : plan.status !== "done",
  );

  return (
    <div className="space-y-4">
      <nav className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md md:grid-cols-4">
        {orderedPeriods.map((period) => {
          const isActive = period === activePeriod;
          const activeCount = groupedPlans[period].filter(
            (plan) => plan.status !== "done",
          ).length;
          const historyCount = groupedPlans[period].filter(
            (plan) => plan.status === "done",
          ).length;

          return (
            <Link
              key={period}
              href={`/cabinet/notes?period=${period}&mode=${activeMode}`}
              className={[
                "rounded-[1.4rem] border px-4 py-4 transition",
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
                  {activeMode === "history" ? historyCount : activeCount}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-white/48">
                Активні: {activeCount} · Історія: {historyCount}
              </p>
            </Link>
          );
        })}
      </nav>

      <section className="flex min-h-[30rem] flex-col rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
              {config.eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-medium text-white">
              {config.title}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] border border-white/10 bg-[#091122]/64 p-2">
            {(Object.keys(modeConfig) as NotesViewMode[]).map((mode) => {
              const isActive = mode === activeMode;
              const count = groupedPlans[activePeriod].filter((plan) =>
                mode === "history" ? plan.status === "done" : plan.status !== "done",
              ).length;

              return (
                <Link
                  key={mode}
                  href={`/cabinet/notes?period=${activePeriod}&mode=${mode}`}
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
                </Link>
              );
            })}
          </div>
        </div>

        {activeMode === "active" ? <AddPlanForm period={activePeriod} /> : null}

        <div className="mt-6 flex flex-1 flex-col gap-3">
          {visiblePlans.length ? (
            visiblePlans.map((plan) =>
              activeMode === "history" ? (
                <HistoryPlanRow
                  key={plan.id}
                  plan={plan}
                  activePeriod={activePeriod}
                />
              ) : (
                <ActivePlanRow
                  key={plan.id}
                  plan={plan}
                  activePeriod={activePeriod}
                />
              ),
            )
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-[#07101f]/45 px-5 py-10 text-center text-sm leading-7 text-white/38">
              {activeMode === "history"
                ? config.emptyHistoryText
                : config.emptyActiveText}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
