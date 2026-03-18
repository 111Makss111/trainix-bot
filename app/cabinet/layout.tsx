import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CabinetSidebar } from "@/components/cabinet";
import { authOptions } from "@/lib/auth";

export default async function CabinetLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[#02030b] px-4 py-4 text-white sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="md:h-full">
          <CabinetSidebar />
        </div>

        <div className="flex min-h-0 flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}
