"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerEmail } from "@/lib/auth-guards";
import {
  jobLeadStatuses,
  refreshJobLeadsForOwner,
  regenerateJobLeadProposal,
  saveJobHuntSettings,
  updateJobLeadStatus,
  type JobHuntSettings,
  type JobLead,
  type JobLeadStatus,
} from "@/lib/jobs";
import {
  sendTelegramTextMessage,
  verifyTelegramConnection,
  type TelegramBotInfo,
  type TelegramChatInfo,
} from "@/lib/telegram";

export type JobsActionResult =
  | { ok: true; settings: JobHuntSettings; leads?: JobLead[]; message?: string }
  | { ok: true; lead: JobLead; message?: string }
  | { ok: false; error: string };

export type JobHuntSettingsActionResult =
  | { ok: true; settings: JobHuntSettings; message?: string }
  | { ok: false; error: string };

export type RefreshJobLeadsActionResult =
  | { ok: true; settings: JobHuntSettings; leads: JobLead[]; message?: string }
  | { ok: false; error: string };

export type JobLeadMutationActionResult =
  | { ok: true; lead: JobLead; message?: string }
  | { ok: false; error: string };

export type JobTelegramTestActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type JobTelegramVerifyActionResult =
  | {
      ok: true;
      message: string;
      bot: TelegramBotInfo;
      chat: TelegramChatInfo;
    }
  | { ok: false; error: string };

function invalid(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export async function saveJobHuntSettingsAction(input: {
  sourceFreelancehuntEnabled: boolean;
  sourceFreelancerEnabled: boolean;
  sourceWeworkremotelyEnabled: boolean;
  autoScanEnabled: boolean;
  scanIntervalMinutes: number;
  maxLeadsPerRun: number;
  includeKeywordsText: string;
  excludeKeywordsText: string;
  telegramAlertsEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
}): Promise<JobHuntSettingsActionResult> {
  const ownerEmail = await requireOwnerEmail();
  const settings = await saveJobHuntSettings({
    ownerEmail,
    ...input,
  });

  revalidatePath("/cabinet/jobs");

  return {
    ok: true,
    settings,
    message: "Налаштування Jobs збережено.",
  };
}

export async function refreshJobLeadsAction(): Promise<RefreshJobLeadsActionResult> {
  const ownerEmail = await requireOwnerEmail();

  try {
    const result = await refreshJobLeadsForOwner(ownerEmail);
    revalidatePath("/cabinet/jobs");

    return {
      ok: true,
      settings: result.settings,
      leads: result.leads,
      message:
        result.created > 0
          ? `Знайшов ${result.created} нових lead-ів.`
          : result.scanned === 0
            ? "Увімкнені джерела поки не повернули задач або тимчасово не відповіли."
          : "Нових релевантних задач поки немає, але стрічку оновлено.",
    };
  } catch (error) {
    return invalid(
      error instanceof Error
        ? error.message
        : "Не вдалося оновити jobs radar.",
    );
  }
}

export async function updateJobLeadStatusAction(input: {
  leadId: string;
  status: JobLeadStatus;
}): Promise<JobLeadMutationActionResult> {
  if (!jobLeadStatuses.includes(input.status)) {
    return invalid("Невідомий статус lead-а.");
  }

  const ownerEmail = await requireOwnerEmail();
  const lead = await updateJobLeadStatus({
    ownerEmail,
    leadId: input.leadId,
    status: input.status,
  });

  if (!lead) {
    return invalid("Не вдалося змінити статус задачі.");
  }

  revalidatePath("/cabinet/jobs");

  return {
    ok: true,
    lead,
  };
}

export async function regenerateJobLeadProposalAction(input: {
  leadId: string;
}): Promise<JobLeadMutationActionResult> {
  const ownerEmail = await requireOwnerEmail();
  const lead = await regenerateJobLeadProposal({
    ownerEmail,
    leadId: input.leadId,
  });

  if (!lead) {
    return invalid("Не вдалося оновити текст відповіді.");
  }

  revalidatePath("/cabinet/jobs");

  return {
    ok: true,
    lead,
    message: "Текст відповіді оновлено.",
  };
}

export async function sendJobTelegramTestAction(input: {
  telegramBotToken: string;
  telegramChatId: string;
}): Promise<JobTelegramTestActionResult> {
  const ownerEmail = await requireOwnerEmail();

  if (!ownerEmail) {
    return invalid("Не вдалося підтвердити власника кабінету.");
  }

  const botToken = input.telegramBotToken.trim();
  const chatId = input.telegramChatId.trim();

  if (!botToken) {
    return invalid("Спершу додай Telegram bot token у налаштування Jobs.");
  }

  if (!chatId) {
    return invalid("Спершу додай Telegram chat id у налаштування Jobs.");
  }

  try {
    await sendTelegramTextMessage({
      botToken,
      chatId,
      text: [
        "Jobs radar test повідомлення.",
        "",
        "Telegram для модуля пошуку замовлень підключений і готовий приймати нові ліди.",
      ].join("\n"),
    });

    return {
      ok: true,
      message: "Тестове повідомлення вже має бути в Telegram.",
    };
  } catch (error) {
    return invalid(
      error instanceof Error
        ? error.message
        : "Не вдалося надіслати тест у Telegram.",
    );
  }
}

export async function verifyJobTelegramConnectionAction(input: {
  telegramBotToken: string;
  telegramChatId: string;
}): Promise<JobTelegramVerifyActionResult> {
  const ownerEmail = await requireOwnerEmail();

  if (!ownerEmail) {
    return invalid("Не вдалося підтвердити власника кабінету.");
  }

  const botToken = input.telegramBotToken.trim();
  const chatId = input.telegramChatId.trim();

  if (!botToken) {
    return invalid("Спершу встав Telegram bot token.");
  }

  if (!chatId) {
    return invalid("Спершу встав Telegram chat id.");
  }

  try {
    const result = await verifyTelegramConnection({
      botToken,
      chatId,
    });

    return {
      ok: true,
      bot: result.bot,
      chat: result.chat,
      message: "Telegram підключений коректно.",
    };
  } catch (error) {
    return invalid(
      error instanceof Error
        ? error.message
        : "Не вдалося перевірити Telegram connection.",
    );
  }
}
