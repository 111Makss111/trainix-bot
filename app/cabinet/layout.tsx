import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CabinetShell } from "@/components/cabinet";
import { getOwnerAccessState } from "@/lib/auth-guards";

export default async function CabinetLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const access = await getOwnerAccessState();

  if (!access.isOwner) {
    redirect("/");
  }

  if (!access.twoFactorVerified) {
    redirect("/verify-2fa");
  }

  return <CabinetShell>{children}</CabinetShell>;
}
