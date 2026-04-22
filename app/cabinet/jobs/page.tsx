import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { JobsWorkspace } from "@/components/jobs/JobsWorkspace";
import { authOptions } from "@/lib/auth";
import { getJobHuntSettings, listJobLeads } from "@/lib/jobs";

export default async function JobsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    redirect("/");
  }

  const ownerEmail = session.user.email.trim().toLowerCase();
  const [settings, leads] = await Promise.all([
    getJobHuntSettings(ownerEmail),
    listJobLeads(ownerEmail, 60),
  ]);

  return <JobsWorkspace initialSettings={settings} initialLeads={leads} />;
}
