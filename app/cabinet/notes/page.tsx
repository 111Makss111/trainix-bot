import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CabinetTopbar } from "@/components/cabinet";
import { PlansBoard } from "@/components/notes";
import type { NotesViewMode } from "@/components/notes/PlansBoard";
import { authOptions } from "@/lib/auth";
import { isPlanPeriod, listPlansForOwner, type PlanPeriod } from "@/lib/plans";

type NotesPageProps = {
  searchParams?: Promise<{
    period?: string;
    mode?: string;
  }>;
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const activePeriod =
    typeof params.period === "string" && isPlanPeriod(params.period)
      ? params.period
      : "today";
  const activeMode: NotesViewMode =
    params.mode === "history" ? "history" : "active";
  const plans = await listPlansForOwner(session.user.email);
  const groupedPlans = {
    today: plans.filter((plan) => plan.period === "today"),
    week: plans.filter((plan) => plan.period === "week"),
    month: plans.filter((plan) => plan.period === "month"),
    year: plans.filter((plan) => plan.period === "year"),
  } satisfies Record<PlanPeriod, typeof plans>;

  return (
    <>
      <CabinetTopbar
        eyebrow="Notes"
        title="Плани та нотатки"
        description="Тепер це planner з активними задачами та історією виконаного. Можеш окремо відкривати сьогодні, тиждень, місяць і рік та в будь-який момент дивитися, що вже закрито."
      />

      <PlansBoard
        groupedPlans={groupedPlans}
        activePeriod={activePeriod}
        activeMode={activeMode}
      />
    </>
  );
}
