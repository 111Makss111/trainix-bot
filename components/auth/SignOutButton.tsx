"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(() => {
          void fetch("/api/security/two-factor/session", {
            method: "POST",
            cache: "no-store",
          })
            .catch(() => null)
            .finally(() => {
              void signOut({ callbackUrl: "/" });
            });
        });
      }}
      disabled={isPending}
      className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm text-white/84 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isPending ? "Вихід..." : "Вийти"}
    </button>
  );
}
