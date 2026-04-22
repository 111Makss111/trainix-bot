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

function invalid(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export async function saveJobHuntSettingsAction(input: {
  sourceFreelancehuntEnabled: boolean;
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
