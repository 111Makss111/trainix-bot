import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CabinetTopbar } from "@/components/cabinet";
import { PlansBoard } from "@/components/notes";
import { authOptions } from "@/lib/auth";
import { listPlansForOwner, type PlanPeriod } from "@/lib/plans";

export default async function NotesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    redirect("/");
  }

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
        description="Тепер це компактний note-planner: окремо для сьогодні, тижня, місяця і року. У кожного пункту є заголовок, опис, статус виконання, редагування і видалення."
      />

      <PlansBoard groupedPlans={groupedPlans} />
    </>
  );
}
