"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerEmail } from "@/lib/auth-guards";
import {
  beginTwoFactorSetup,
  cancelTwoFactorSetup,
  disableTwoFactorForOwner,
  enableTwoFactorForOwner,
  getTwoFactorSettingsState,
  type TwoFactorSettingsState,
} from "@/lib/security/two-factor";

export type TwoFactorMutationResult =
  | {
      ok: true;
      state: TwoFactorSettingsState;
      message?: string;
      backupCodes?: string[];
    }
  | {
      ok: false;
      error: string;
      state?: TwoFactorSettingsState;
    };

function okResult(
  state: TwoFactorSettingsState,
  input?: {
    message?: string;
    backupCodes?: string[];
  },
): TwoFactorMutationResult {
  return {
    ok: true,
    state,
    message: input?.message,
    backupCodes: input?.backupCodes,
  };
}

function errorResult(
  error: string,
  state?: TwoFactorSettingsState,
): TwoFactorMutationResult {
  return {
    ok: false,
    error,
    state,
  };
}

export async function beginTwoFactorSetupAction(): Promise<TwoFactorMutationResult> {
  const ownerEmail = await requireOwnerEmail();

  try {
    const state = await beginTwoFactorSetup(ownerEmail);
    revalidatePath("/cabinet/settings");

    return okResult(state, {
      message:
        "Ключ для Google Authenticator згенеровано. Додай його в застосунок і підтвердь код нижче.",
    });
  } catch (error) {
    console.error("Failed to start two-factor setup", error);
    const state = await getTwoFactorSettingsState(ownerEmail);

    return errorResult("Не вдалося почати налаштування 2FA.", state);
  }
}

export async function cancelTwoFactorSetupAction(): Promise<TwoFactorMutationResult> {
  const ownerEmail = await requireOwnerEmail();

  try {
    const state = await cancelTwoFactorSetup(ownerEmail);
    revalidatePath("/cabinet/settings");

    return okResult(state, {
      message: "Чернетку налаштування 2FA скасовано.",
    });
  } catch (error) {
    console.error("Failed to cancel two-factor setup", error);
    const state = await getTwoFactorSettingsState(ownerEmail);

    return errorResult("Не вдалося скасувати налаштування 2FA.", state);
  }
}

export async function enableTwoFactorAction(input: {
  code: string;
}): Promise<TwoFactorMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const code = input.code.trim();

  if (!code) {
    const state = await getTwoFactorSettingsState(ownerEmail);
    return errorResult("Введи 6-значний код із Google Authenticator.", state);
  }

  try {
    const result = await enableTwoFactorForOwner(ownerEmail, code);
    revalidatePath("/cabinet/settings");

    return okResult(result.state, {
      message:
        "2FA увімкнено. Збережи backup codes у безпечному місці, вони показуються лише зараз.",
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error("Failed to enable two-factor", error);
    const state = await getTwoFactorSettingsState(ownerEmail);

    return errorResult(
      error instanceof Error ? error.message : "Не вдалося увімкнути 2FA.",
      state,
    );
  }
}

export async function disableTwoFactorAction(input: {
  code: string;
}): Promise<TwoFactorMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const code = input.code.trim();

  if (!code) {
    const state = await getTwoFactorSettingsState(ownerEmail);
    return errorResult("Введи поточний код або один із backup codes.", state);
  }

  try {
    const state = await disableTwoFactorForOwner(ownerEmail, code);
    revalidatePath("/cabinet/settings");

    return okResult(state, {
      message: "2FA вимкнено для цього кабінету.",
    });
  } catch (error) {
    console.error("Failed to disable two-factor", error);
    const state = await getTwoFactorSettingsState(ownerEmail);

    return errorResult(
      error instanceof Error ? error.message : "Не вдалося вимкнути 2FA.",
      state,
    );
  }
}
