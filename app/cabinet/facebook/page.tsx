import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FacebookWorkspace } from "@/components/social";
import { authOptions } from "@/lib/auth";
import { getFacebookContentSettings } from "@/lib/social/facebook";

type FacebookPageProps = {
  searchParams?: Promise<{
    settings?: string;
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
  const settings = await getFacebookContentSettings(
    session.user.email.trim().toLowerCase(),
  );

  return (
    <FacebookWorkspace
      settings={settings}
      notice={typeof params.settings === "string" ? params.settings : undefined}
    />
  );
}
