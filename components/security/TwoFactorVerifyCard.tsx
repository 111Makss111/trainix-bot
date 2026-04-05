"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyTwoFactorCodeForSessionAction } from "@/app/verify-2fa/actions";

type TwoFactorVerifyCardProps = {
  ownerEmail: string;
};

export function TwoFactorVerifyCard({
  ownerEmail,
}: TwoFactorVerifyCardProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleVerify() {
    setIsVerifying(true);
    setError(null);
    setMessage(null);

    try {
      const result = await verifyTwoFactorCodeForSessionAction({
        code,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.usedBackupCode) {
        setMessage(
          "Вхід підтверджено backup code. Один резервний код уже витрачено.",
        );
      }

      router.replace("/cabinet");
      router.refresh();
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <section className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/12 bg-[#08101f]/92 p-6 shadow-[0_0_80px_rgba(61,90,190,0.2)] backdrop-blur-xl">
      <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/46">
        Second Factor
      </p>
      <h1 className="mt-3 text-3xl font-medium text-white">
        Підтверди вхід кодом
      </h1>
      <p className="mt-4 text-sm leading-7 text-white/62">
        Google уже підтвердив, що це твій акаунт. Тепер введи код із Google
        Authenticator, щоб завершити вхід у приватний кабінет.
      </p>

      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#06101e] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.22em] text-white/36">Owner</p>
        <p className="mt-3 text-sm text-white/82">{ownerEmail}</p>
      </div>

      {error ? (
        <div className="mt-5 rounded-[1.4rem] border border-red-400/18 bg-red-400/8 px-4 py-3 text-sm leading-6 text-red-100">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-5 rounded-[1.4rem] border border-amber-300/16 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-50">
          {message}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Код із Authenticator або backup code"
          inputMode="numeric"
          className="w-full rounded-2xl border border-white/10 bg-[#06101e] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-white/22"
        />

        <button
          type="button"
          onClick={handleVerify}
          disabled={isVerifying}
          className="w-full rounded-2xl border border-white/12 bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isVerifying ? "Перевіряю..." : "Підтвердити вхід"}
        </button>
      </div>
    </section>
  );
}
