import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CabinetTopbar } from "@/components/cabinet";
import { PracticeWorkspace } from "@/components/practice";
import { authOptions } from "@/lib/auth";
import { listPracticeTasksForOwner } from "@/lib/practice";

export default async function PracticePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    redirect("/");
  }

  const tasks = await listPracticeTasksForOwner(
    session.user.email.trim().toLowerCase(),
  );

  return (
    <>
      <CabinetTopbar
        eyebrow="Practice"
        title="Code Lab"
        description="Генеруй dev-задачі під конкретний стек, складність і тип. Starter code, підказки та історія рішень зберігаються в базі, щоб модуль не крутив одні й ті самі вправи."
      />

      <PracticeWorkspace initialTasks={tasks} />
    </>
  );
}
