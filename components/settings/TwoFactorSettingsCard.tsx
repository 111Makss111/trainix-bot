"use client";

import { useMemo, useState } from "react";
import {
  beginTwoFactorSetupAction,
  cancelTwoFactorSetupAction,
  disableTwoFactorAction,
  enableTwoFactorAction,
  type TwoFactorMutationResult,
} from "@/app/cabinet/settings/actions";
import { CopyTextButton } from "@/components/social/shared/CopyTextButton";
import type { TwoFactorSettingsState } from "@/lib/security/two-factor";

type TwoFactorSettingsCardProps = {
  initialState: TwoFactorSettingsState;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Ще не ввімкнено";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ResultNotice({ result }: { result: TwoFactorMutationResult | null }) {
  if (!result) {
    return null;
  }

  if (result.ok && !result.message) {
    return null;
  }

  const toneClasses = result.ok
    ? "border-emerald-400/18 bg-emerald-400/8 text-emerald-100"
    : "border-red-400/18 bg-red-400/8 text-red-100";

  return (
    <div className={`rounded-[1.4rem] border px-4 py-3 text-sm leading-6 ${toneClasses}`}>
      {result.ok ? result.message : result.error}
    </div>
  );
}

function BackupCodesCard({ codes }: { codes: string[] }) {
  const joined = useMemo(() => codes.join("\n"), [codes]);

  return (
    <div className="rounded-[1.6rem] border border-amber-300/16 bg-amber-300/8 p-4 text-amber-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-amber-100/56">
            Backup Codes
          </p>
          <h3 className="mt-2 text-xl font-medium">Збережи їх зараз</h3>
        </div>

        <CopyTextButton
          text={joined}
          idleLabel="Скопіювати коди"
          copiedLabel="Коди скопійовано"
        />
      </div>

      <p className="mt-3 text-sm leading-6 text-amber-50/78">
        Кожен backup code можна використати один раз, якщо телефон недоступний.
        Після закриття сторінки цей список більше не покажеться.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {codes.map((code) => (
          <div
            key={code}
            className="rounded-2xl border border-white/10 bg-[#0b1223] px-4 py-3 font-mono text-sm tracking-[0.22em] text-white/88"
          >
            {code}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TwoFactorSettingsCard({
  initialState,
}: TwoFactorSettingsCardProps) {
  const [state, setState] = useState(initialState);
  const [result, setResult] = useState<TwoFactorMutationResult | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [isStartingSetup, setIsStartingSetup] = useState(false);
  const [isConfirmingSetup, setIsConfirmingSetup] = useState(false);
  const [isCancellingSetup, setIsCancellingSetup] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  async function handleStartSetup() {
    setIsStartingSetup(true);
    setResult(null);

    try {
      const nextResult = await beginTwoFactorSetupAction();
      setResult(nextResult);

      if (nextResult.ok) {
        setState(nextResult.state);
        setBackupCodes([]);
        setSetupCode("");
      }
    } finally {
      setIsStartingSetup(false);
    }
  }

  async function handleCancelSetup() {
    setIsCancellingSetup(true);
    setResult(null);

    try {
      const nextResult = await cancelTwoFactorSetupAction();
      setResult(nextResult);

      if (nextResult.ok) {
        setState(nextResult.state);
        setBackupCodes([]);
        setSetupCode("");
      }
    } finally {
      setIsCancellingSetup(false);
    }
  }

  async function handleConfirmSetup() {
    setIsConfirmingSetup(true);
    setResult(null);

    try {
      const nextResult = await enableTwoFactorAction({
        code: setupCode,
      });

      setResult(nextResult);

      if (nextResult.ok) {
        setState(nextResult.state);
        setBackupCodes(nextResult.backupCodes ?? []);
        setSetupCode("");
      }
    } finally {
      setIsConfirmingSetup(false);
    }
  }

  async function handleDisableTwoFactor() {
    setIsDisabling(true);
    setResult(null);

    try {
      const nextResult = await disableTwoFactorAction({
        code: disableCode,
      });

      setResult(nextResult);

      if (nextResult.ok) {
        setState(nextResult.state);
        setBackupCodes([]);
        setDisableCode("");
      }
    } finally {
      setIsDisabling(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-6 backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/42">
            Security
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">
            Двофакторний захист кабінету
          </h2>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] ${
            state.enabled
              ? "border-emerald-400/18 bg-emerald-400/10 text-emerald-100"
              : state.pendingSetup
                ? "border-sky-400/18 bg-sky-400/10 text-sky-100"
                : "border-white/12 bg-white/[0.04] text-white/60"
          }`}
        >
          {state.enabled ? "2FA active" : state.pendingSetup ? "Setup pending" : "Disabled"}
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">
        Вхід у кабінет лишається через Google, але після цього можна вимагати ще
        один код із Google Authenticator. Це дає окремий захист навіть якщо
        Google-сесію хтось перехопить.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border border-white/10 bg-[#07101e]/80 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/36">Status</p>
          <p className="mt-3 text-lg font-medium text-white">
            {state.enabled ? "Увімкнено" : state.pendingSetup ? "Налаштовується" : "Вимкнено"}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#07101e]/80 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/36">Enabled at</p>
          <p className="mt-3 text-sm leading-6 text-white/74">{formatDate(state.enabledAt)}</p>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#07101e]/80 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/36">Backup codes</p>
          <p className="mt-3 text-sm leading-6 text-white/74">
            {state.enabled
              ? `${state.backupCodesRemaining} ще залишилось`
              : "З'являться після активації"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <ResultNotice result={result} />
      </div>

      {backupCodes.length ? (
        <div className="mt-5">
          <BackupCodesCard codes={backupCodes} />
        </div>
      ) : null}

      {!state.enabled && !state.pendingSetup ? (
        <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#07101e]/80 p-5">
          <h3 className="text-lg font-medium text-white">Почати налаштування 2FA</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
            Система згенерує секретний ключ для Google Authenticator. Після цього
            ти додаєш його в застосунок і підтверджуєш перший код.
          </p>

          <button
            type="button"
            onClick={handleStartSetup}
            disabled={isStartingSetup}
            className="mt-5 rounded-full border border-white/12 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isStartingSetup ? "Готую ключ..." : "Почати налаштування"}
          </button>
        </div>
      ) : null}

      {state.pendingSetup ? (
        <div className="mt-5 rounded-[1.7rem] border border-sky-400/14 bg-sky-400/6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.28em] text-sky-100/52">
                Google Authenticator
              </p>
              <h3 className="mt-2 text-xl font-medium text-white">
                Додай цей ключ у свій authenticator app
              </h3>
            </div>

            {state.otpauthUri ? (
              <CopyTextButton
                text={state.otpauthUri}
                idleLabel="Скопіювати setup URI"
                copiedLabel="URI скопійовано"
              />
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.4rem] border border-white/10 bg-[#06101e] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/36">Secret key</p>
              <p className="mt-3 break-all font-mono text-sm tracking-[0.18em] text-white/88">
                {state.manualEntryKey}
              </p>

              {state.manualEntryKey ? (
                <div className="mt-4">
                  <CopyTextButton
                    text={state.manualEntryKey}
                    idleLabel="Скопіювати ключ"
                    copiedLabel="Ключ скопійовано"
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-[#06101e] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/36">Manual entry</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/68">
                <li>1. Відкрий Google Authenticator.</li>
                <li>2. Натисни `+` і вибери ручне додавання.</li>
                <li>3. Account: {state.accountLabel}</li>
                <li>4. Issuer: {state.issuer}</li>
                <li>5. Встав ключ і підтвердь новий 6-значний код нижче.</li>
              </ul>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              value={setupCode}
              onChange={(event) => setSetupCode(event.target.value)}
              inputMode="numeric"
              placeholder="Введи 6-значний код"
              className="w-full rounded-2xl border border-white/10 bg-[#06101e] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-sky-300/38"
            />

            <button
              type="button"
              onClick={handleConfirmSetup}
              disabled={isConfirmingSetup}
              className="rounded-full border border-sky-300/24 bg-sky-300/12 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isConfirmingSetup ? "Активую..." : "Активувати 2FA"}
            </button>

            <button
              type="button"
              onClick={handleCancelSetup}
              disabled={isCancellingSetup}
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCancellingSetup ? "Скасовую..." : "Скасувати"}
            </button>
          </div>
        </div>
      ) : null}

      {state.enabled ? (
        <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-[#07101e]/80 p-5">
          <h3 className="text-lg font-medium text-white">Керування активним 2FA</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
            Щоб вимкнути захист, введи поточний код із Google Authenticator або
            один із backup codes. Це захищає від випадкового вимкнення.
          </p>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value)}
              placeholder="Поточний код або backup code"
              className="w-full rounded-2xl border border-white/10 bg-[#06101e] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-white/22"
            />

            <button
              type="button"
              onClick={handleDisableTwoFactor}
              disabled={isDisabling}
              className="rounded-full border border-red-300/18 bg-red-300/10 px-5 py-3 text-sm font-medium text-red-50 transition hover:bg-red-300/16 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isDisabling ? "Вимикаю..." : "Вимкнути 2FA"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
