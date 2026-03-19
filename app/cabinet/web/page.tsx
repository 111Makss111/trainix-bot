import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CabinetTopbar } from "@/components/cabinet";
import {
  WebCreateProjectForm,
  WebProjectOverview,
  WebProjectSwitcher,
} from "@/components/web";
import { authOptions } from "@/lib/auth";
import {
  listRecentTelegramMessagesForProject,
  listWebProjectsForOwner,
} from "@/lib/web-projects";

type WebPageProps = {
  searchParams?: Promise<{
    project?: string;
    telegram?: string;
  }>;
};

export default async function WebPage({ searchParams }: WebPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const projects = await listWebProjectsForOwner(session.user.email);
  const activeProject =
    projects.find((project) => project.id === params.project) ?? projects[0] ?? null;
  const telegramMessages = activeProject
    ? await listRecentTelegramMessagesForProject({
        ownerEmail: session.user.email,
        projectId: activeProject.id,
        limit: 20,
      })
    : [];

  return (
    <>
      <CabinetTopbar
        eyebrow="Web Automation"
        title="Сайти, боти та AI-движок"
        description="Тут житимуть усі твої web-проєкти. Для кожного сайту буде окремий Telegram-бот, власні AI-налаштування, сценарій автопостів і джерела знань."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <WebProjectSwitcher
          projects={projects}
          activeProjectId={activeProject?.id}
        />
        <WebCreateProjectForm />
      </div>

      <WebProjectOverview
        project={activeProject}
        telegramNotice={
          typeof params.telegram === "string" ? params.telegram : undefined
        }
        telegramMessages={telegramMessages}
      />
    </>
  );
}
