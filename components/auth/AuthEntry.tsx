"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

const authErrorMessages: Record<string, string> = {
  AccessDenied: "Доступ дозволений лише власнику цього кабінету.",
  Configuration: "Вхід поки не налаштований. Перевір Google та env-змінні.",
  OAuthSignin: "Не вдалося почати вхід через Google. Спробуй ще раз.",
  OAuthCallback: "Google не підтвердив вхід. Спробуй ще раз.",
  Default: "Не вдалося виконати вхід. Спробуй ще раз.",
};

type AuthEntryProps = {
  authError?: string;
  isAuthenticated: boolean;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M21.8 12.23c0-.76-.07-1.49-.19-2.2H12v4.16h5.5a4.75 4.75 0 0 1-2.04 3.12v2.6h3.3c1.94-1.79 3.04-4.43 3.04-7.68Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.08-.92 6.77-2.5l-3.3-2.6c-.92.62-2.1.98-3.47.98-2.67 0-4.94-1.8-5.75-4.23H2.84v2.68A10.22 10.22 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.25 13.65A6.14 6.14 0 0 1 5.93 12c0-.57.1-1.12.32-1.65V7.67H2.84A10.03 10.03 0 0 0 1.8 12c0 1.6.38 3.11 1.04 4.33l3.41-2.68Z"
        fill="#FBBC04"
      />
      <path
        d="M12 6.12c1.5 0 2.84.52 3.9 1.54l2.92-2.92C17.07 3.12 14.75 2 12 2A10.22 10.22 0 0 0 2.84 7.67l3.41 2.68C7.06 7.92 9.33 6.12 12 6.12Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthEntry({ authError, isAuthenticated }: AuthEntryProps) {
  const [isOpen, setIsOpen] = useState(Boolean(authError));
  const [isPending, startTransition] = useTransition();

  if (isAuthenticated) {
    return (
      <Link
        href="/cabinet"
        className="rounded-full border border-white/14 bg-white/7 px-5 py-2.5 text-sm font-medium text-white/90 shadow-[0_0_24px_rgba(117,143,255,0.08)] backdrop-blur-md transition hover:bg-white/10"
      >
        Кабінет
      </Link>
    );
  }

  const errorMessage = authError
    ? authErrorMessages[authError] ?? authErrorMessages.Default
    : null;

  const handleGoogleSignIn = () => {
    startTransition(() => {
      void signIn("google", { callbackUrl: "/cabinet" });
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-white/14 bg-white/7 px-5 py-2.5 text-sm font-medium text-white/90 shadow-[0_0_24px_rgba(117,143,255,0.08)] backdrop-blur-md transition hover:bg-white/10"
      >
        Вхід
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-5">
          <button
            type="button"
            aria-label="Закрити модальне вікно"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-[#02030b]/78 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/12 bg-[#08101f]/92 p-6 shadow-[0_0_80px_rgba(61,90,190,0.2)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/46">
                  Owner Access
                </p>
                <h2 className="mt-3 text-2xl font-medium text-white">
                  Вхід лише для власника
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/60 transition hover:text-white/92"
              >
                Закрити
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-white/62">
              Реєстрації немає. Доступ відкривається тільки через один
              дозволений Google-акаунт.
            </p>

            {errorMessage ? (
              <div className="mt-5 rounded-2xl border border-red-400/18 bg-red-400/8 px-4 py-3 text-sm leading-6 text-red-100">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isPending}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <GoogleIcon />
              {isPending ? "Підключення..." : "Продовжити через Google"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
