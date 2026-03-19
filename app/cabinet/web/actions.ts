"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  setTelegramWebhook,
  verifyTelegramConnection,
} from "@/lib/telegram";
import {
  clearWebProjectTelegramWebhook,
  createWebProject,
  deleteWebProject,
  getWebProjectForOwner,
  saveWebProjectTelegramVerification,
  setWebProjectTelegramWebhook,
  updateWebProjectAiInstructions,
  updateWebProjectTelegramSettings,
} from "@/lib/web-projects";

async function requireOwnerEmail() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    throw new Error("Unauthorized");
  }

  return session.user.email.trim().toLowerCase();
}

export async function createWebProjectAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const name = formData.get("name");
  const description = formData.get("description");

  if (typeof name !== "string") {
    return;
  }

  await createWebProject({
    ownerEmail,
    name,
    description: typeof description === "string" ? description : null,
  });

  revalidatePath("/cabinet/web");
}

export async function deleteWebProjectAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");

  if (typeof projectId !== "string") {
    return;
  }

  await deleteWebProject({
    ownerEmail,
    projectId,
  });

  revalidatePath("/cabinet/web");
  redirect("/cabinet/web");
}

function redirectToTelegramState(projectId: string, state: string): never {
  redirect(`/cabinet/web?project=${projectId}&telegram=${state}`);
}

function redirectToAiState(projectId: string, state: string): never {
  redirect(`/cabinet/web?project=${projectId}&ai=${state}`);
}

function getTelegramWebhookBaseUrl() {
  return (
    process.env.TELEGRAM_WEBHOOK_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ""
  );
}

function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      return false;
    }

    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host === "t.me" ||
      host === "telegram.me" ||
      host === "web.telegram.org"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function updateTelegramSettingsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");
  const botToken = formData.get("botToken");
  const chatId = formData.get("chatId");
  const smartRepliesEnabled = formData.get("smartRepliesEnabled") === "on";

  if (
    typeof projectId !== "string" ||
    typeof botToken !== "string" ||
    typeof chatId !== "string"
  ) {
    return;
  }

  await updateWebProjectTelegramSettings({
    ownerEmail,
    projectId,
    botToken,
    chatId,
    smartRepliesEnabled,
  });

  revalidatePath("/cabinet/web");
  redirectToTelegramState(projectId, "saved");
}

export async function verifyTelegramSettingsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");
  const botToken = formData.get("botToken");
  const chatId = formData.get("chatId");
  const smartRepliesEnabled = formData.get("smartRepliesEnabled") === "on";

  if (
    typeof projectId !== "string" ||
    typeof botToken !== "string" ||
    typeof chatId !== "string"
  ) {
    return;
  }

  await updateWebProjectTelegramSettings({
    ownerEmail,
    projectId,
    botToken,
    chatId,
    smartRepliesEnabled,
  });

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId,
  });

  if (!project) {
    redirectToTelegramState(projectId, "failed");
  }

  if (!project.telegramBotToken || !project.telegramChatId) {
    redirectToTelegramState(projectId, "missing");
  }

  const savedBotToken = project.telegramBotToken;
  const savedChatId = project.telegramChatId;

  try {
    const { bot, chat } = await verifyTelegramConnection({
      botToken: savedBotToken,
      chatId: savedChatId,
    });

    await saveWebProjectTelegramVerification({
      ownerEmail,
      projectId,
      botName: bot.first_name,
      botUsername: bot.username ?? null,
      resolvedChatId: String(chat.id),
      chatTitle: chat.title ?? chat.username ?? null,
      chatType: chat.type,
      canJoinGroups: Boolean(bot.can_join_groups),
      canReadAllGroupMessages: Boolean(bot.can_read_all_group_messages),
    });

    revalidatePath("/cabinet/web");
    redirectToTelegramState(projectId, "verified");
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (message.includes("unauthorized")) {
      redirectToTelegramState(projectId, "invalid-token");
    }

    if (message.includes("chat not found")) {
      redirectToTelegramState(projectId, "chat-not-found");
    }

    if (message.includes("forbidden")) {
      redirectToTelegramState(projectId, "bot-no-access");
    }

    redirectToTelegramState(projectId, "failed");
  }
}

export async function enableTelegramWebhookAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");

  if (typeof projectId !== "string") {
    return;
  }

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId,
  });

  if (!project?.telegramBotToken || !project.telegramChatId) {
    redirectToTelegramState(projectId, "missing");
  }

  const baseUrl = getTelegramWebhookBaseUrl();

  if (!isPublicHttpsUrl(baseUrl)) {
    redirectToTelegramState(projectId, "webhook-public-url");
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook/${projectId}`;
  const secretToken = randomBytes(24).toString("base64url");

  try {
    await setTelegramWebhook({
      botToken: project.telegramBotToken,
      webhookUrl,
      secretToken,
    });

    const webhookInfo = await getTelegramWebhookInfo(project.telegramBotToken);

    if (webhookInfo.url !== webhookUrl) {
      redirectToTelegramState(projectId, "webhook-not-confirmed");
    }

    await setWebProjectTelegramWebhook({
      ownerEmail,
      projectId,
      webhookSecret: secretToken,
      webhookUrl,
    });

    revalidatePath("/cabinet/web");
    redirectToTelegramState(projectId, "webhook-enabled");
  } catch {
    redirectToTelegramState(projectId, "webhook-failed");
  }
}

export async function disableTelegramWebhookAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");

  if (typeof projectId !== "string") {
    return;
  }

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId,
  });

  if (!project?.telegramBotToken) {
    redirectToTelegramState(projectId, "missing");
  }

  try {
    await deleteTelegramWebhook(project.telegramBotToken);
  } catch {
    // Even if Telegram deletion fails, clear the local binding to let the user retry cleanly.
  }

  await clearWebProjectTelegramWebhook({
    ownerEmail,
    projectId,
  });

  revalidatePath("/cabinet/web");
  redirectToTelegramState(projectId, "webhook-disabled");
}

export async function updateProjectAiInstructionsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");
  const aiInstructions = formData.get("aiInstructions");

  if (typeof projectId !== "string" || typeof aiInstructions !== "string") {
    return;
  }

  await updateWebProjectAiInstructions({
    ownerEmail,
    projectId,
    aiInstructions,
  });

  revalidatePath("/cabinet/web");
  redirectToAiState(projectId, "saved");
}
