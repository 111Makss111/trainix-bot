import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CabinetTopbar } from "@/components/cabinet";
import { PlansBoard } from "@/components/notes";
import { authOptions } from "@/lib/auth";
import { isPlanPeriod, listPlansForOwner, type PlanPeriod } from "@/lib/plans";

type NotesPageProps = {
  searchParams?: Promise<{
    period?: string;
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
  const plans = await listPlansForOwner(session.user.email);
  const groupedPlans = {
    today: plans.filter((plan) => plan.period === "today"),
    week: plans.filter((plan) => plan.period === "week"),
    month: plans.filter((plan) => plan.period === "month"),
    year: plans.filter((plan) => plan.period === "year"),
  } satisfies Record<PlanPeriod, typeof plans>;

  return (
    <>
      <PlansBoard groupedPlans={groupedPlans} activePeriod={activePeriod} />
    </>
  );
}
