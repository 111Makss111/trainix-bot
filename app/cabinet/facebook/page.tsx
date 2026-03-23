import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FacebookWorkspace } from "@/components/social";
import { authOptions } from "@/lib/auth";
import {
  getFacebookContentSettings,
  getFacebookPageConnection,
  listFacebookDrafts,
  normalizeFacebookWorkspaceTab,
} from "@/lib/social/facebook";

type FacebookPageProps = {
  searchParams?: Promise<{
    state?: string;
    tab?: string;
  }>;
};

export default async function FacebookPage({
  searchParams,
}: FacebookPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const ownerEmail = session.user.email.trim().toLowerCase();
  const activeTab = normalizeFacebookWorkspaceTab(
    typeof params.tab === "string" ? params.tab : undefined,
  );
  const [settings, drafts, connection] = await Promise.all([
    getFacebookContentSettings(ownerEmail),
    listFacebookDrafts(ownerEmail, 6),
    getFacebookPageConnection(ownerEmail),
  ]);

  return (
    <FacebookWorkspace
      key={`${activeTab}:${typeof params.state === "string" ? params.state : "base"}`}
      settings={settings}
      drafts={drafts}
      connection={connection}
      activeTab={activeTab}
      notice={typeof params.state === "string" ? params.state : undefined}
    />
  );
}
