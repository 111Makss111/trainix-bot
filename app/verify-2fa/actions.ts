"use server";

import { requireOwnerEmail } from "@/lib/auth-guards";
import {
  getTwoFactorSettingsState,
  setTwoFactorVerificationCookie,
  verifyTwoFactorCode,
} from "@/lib/security/two-factor";

export type TwoFactorVerificationResult =
  | {
      ok: true;
      usedBackupCode: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export async function verifyTwoFactorCodeForSessionAction(input: {
  code: string;
}): Promise<TwoFactorVerificationResult> {
  const ownerEmail = await requireOwnerEmail({ requireTwoFactor: false });
  const state = await getTwoFactorSettingsState(ownerEmail);
  const code = input.code.trim();

  if (!state.enabled) {
    return {
      ok: true,
      usedBackupCode: false,
    };
  }

  if (!code) {
    return {
      ok: false,
      error: "Введи код із Google Authenticator або один із backup codes.",
    };
  }

  const verification = await verifyTwoFactorCode(ownerEmail, code);

  if (!verification.ok) {
    return {
      ok: false,
      error: "Код не підтвердився. Перевір цифри і спробуй ще раз.",
    };
  }

  await setTwoFactorVerificationCookie(ownerEmail);

  return {
    ok: true,
    usedBackupCode: verification.usedBackupCode,
  };
}
