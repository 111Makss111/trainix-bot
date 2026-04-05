import { redirect } from "next/navigation";
import { getOwnerAccessState } from "@/lib/auth-guards";
import { TwoFactorVerifyCard } from "@/components/security/TwoFactorVerifyCard";

export default async function VerifyTwoFactorPage() {
  const access = await getOwnerAccessState();

  if (!access.isOwner || !access.email) {
    redirect("/");
  }

  if (!access.twoFactorEnabled || access.twoFactorVerified) {
    redirect("/cabinet");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02030b] px-5 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(93,127,255,0.18),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(82,214,255,0.08),_transparent_28%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <TwoFactorVerifyCard ownerEmail={access.email} />
      </div>
    </main>
  );
}
