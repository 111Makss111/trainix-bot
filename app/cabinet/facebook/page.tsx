import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FacebookWorkspace } from "@/components/social";
import { authOptions } from "@/lib/auth";
import {
  getFacebookContentSettings,
  listFacebookDrafts,
} from "@/lib/social/facebook";

type FacebookPageProps = {
  searchParams?: Promise<{
    state?: string;
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
  const settings = await getFacebookContentSettings(ownerEmail);
  const drafts = await listFacebookDrafts(ownerEmail, 6);

  return (
    <FacebookWorkspace
      settings={settings}
      drafts={drafts}
      notice={typeof params.state === "string" ? params.state : undefined}
    />
  );
}
