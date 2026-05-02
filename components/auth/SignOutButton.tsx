"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
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
      aria-label="Вийти"
      className={[
        "rounded-full border border-white/12 bg-white/6 text-sm text-white/84 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70",
        compact
          ? "flex h-11 w-11 items-center justify-center px-0 py-0"
          : "px-4 py-2",
      ].join(" ")}
    >
      {compact ? (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M10 6H6.5A1.5 1.5 0 0 0 5 7.5v9A1.5 1.5 0 0 0 6.5 18H10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M14 8l4 4-4 4M18 12H9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : isPending ? (
        "Вихід..."
      ) : (
        "Вийти"
      )}
    </button>
  );
}
