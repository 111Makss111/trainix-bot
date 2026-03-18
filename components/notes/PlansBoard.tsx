import {
  createPlanAction,
  deletePlanAction,
  updatePlanAction,
} from "@/app/cabinet/notes/actions";
import type { PlanItem, PlanPeriod } from "@/lib/plans";

type PlansBoardProps = {
  groupedPlans: Record<PlanPeriod, PlanItem[]>;
};

const sectionConfig: Record<
  PlanPeriod,
  { title: string; eyebrow: string; placeholder: string }
> = {
  week: {
    title: "Плани на день",
    eyebrow: "Week",
    placeholder:
      "Наприклад: підготувати структуру проєкту, закрити головні задачі...",
  },

  month: {
    title: "Плани на Тиждень",
    eyebrow: "Month",
    placeholder:
      "Наприклад: доробити модулі кабінету, зібрати систему звітів...",
  },
  year: {
    title: "Плани на Рік",
    eyebrow: "Year",
    placeholder:
      "Наприклад: вивести весь особистий workflow в один приватний простір...",
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PlansBoard({ groupedPlans }: PlansBoardProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {(Object.keys(sectionConfig) as PlanPeriod[]).map((period) => {
        const config = sectionConfig[period];
        const plans = groupedPlans[period];

        return (
          <section
            key={period}
            className="flex min-h-[32rem] flex-col rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md"
          >
            <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
              {config.eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-medium text-white">
              {config.title}
            </h2>

            <form action={createPlanAction} className="mt-5 space-y-3">
              <input type="hidden" name="period" value={period} />
              <textarea
                name="content"
                rows={4}
                placeholder={config.placeholder}
                className="w-full resize-none rounded-[1.5rem] border border-white/10 bg-[#0a1122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18 focus:bg-[#0d152a]"
              />
              <button
                type="submit"
                className="rounded-full border border-white/14 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/88 transition hover:bg-white/12"
              >
                Додати план
              </button>
            </form>

            <div className="mt-6 flex flex-1 flex-col gap-3">
              {plans.length ? (
                plans.map((plan) => (
                  <article
                    key={plan.id}
                    className="rounded-[1.5rem] border border-white/10 bg-[#0a1122]/92 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-white/82">
                        {plan.content}
                      </p>
                      <form action={deletePlanAction}>
                        <input type="hidden" name="planId" value={plan.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white/54 transition hover:border-red-300/24 hover:text-red-100"
                        >
                          Видалити
                        </button>
                      </form>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.22em] text-white/30">
                        Оновлено {formatDate(plan.updatedAt)}
                      </span>

                      <details className="group">
                        <summary className="cursor-pointer list-none rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white/58 transition hover:border-white/14 hover:text-white/88 [&::-webkit-details-marker]:hidden">
                          Змінити
                        </summary>

                        <form
                          action={updatePlanAction}
                          className="mt-3 space-y-3"
                        >
                          <input type="hidden" name="planId" value={plan.id} />
                          <textarea
                            name="content"
                            defaultValue={plan.content}
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
                  </article>
                ))
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-[#07101f]/45 px-5 py-10 text-center text-sm leading-7 text-white/38">
                  Тут поки порожньо. Додай перший план для цього горизонту.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
