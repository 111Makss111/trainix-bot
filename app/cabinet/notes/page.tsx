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
    week: plans.filter((plan) => plan.period === "week"),
    month: plans.filter((plan) => plan.period === "month"),
    year: plans.filter((plan) => plan.period === "year"),
  } satisfies Record<PlanPeriod, typeof plans>;

  return (
    <>
      <CabinetTopbar
        eyebrow="Notes"
        title="Плани та нотатки"
        description="Тут уже працює твій приватний planner: окремо для тижня, місяця і року. Записи зберігаються в базі, їх можна редагувати та видаляти прямо зі сторінки."
      />

      <PlansBoard groupedPlans={groupedPlans} />
    </>
  );
}
