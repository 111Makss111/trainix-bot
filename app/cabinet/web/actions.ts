"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPostDraftBatchForProject, createScheduledPostDraftBatch } from "@/lib/post-queue";
import { isPostContentType } from "@/lib/post-studio";
import {
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  sendTelegramPhotoMessage,
  sendTelegramTextMessage,
  setTelegramWebhook,
  verifyTelegramConnection,
} from "@/lib/telegram";
import {
  clearWebProjectTelegramWebhook,
  createWebProject,
  deleteWebProject,
  deleteWebPostDraftForOwner,
  getWebProjectForOwner,
  getDraftWebPostForOwner,
  listDraftWebPostsForProject,
  markWebPostDraftPublished,
  markWebProjectPostGenerationRun,
  type WebPostDraft,
  updateWebProjectPostSettings,
  type WebProject,
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

function redirectToPostState(projectId: string, state: string): never {
  redirect(`/cabinet/web?project=${projectId}&post=${state}`);
}

type PostStudioMutationResult =
  | {
      ok: true;
      notice: string;
      drafts?: WebPostDraft[];
      draftId?: string;
      publishedPost?: WebPostDraft;
      postSettings?: Partial<
        Pick<
          WebProject,
          | "postGenerationEnabled"
          | "postGenerationIntervalHours"
          | "postGenerationContentType"
          | "postGenerationThreadId"
          | "postGenerationLastRunAt"
        >
      >;
    }
  | {
      ok: false;
      error: string;
    };

function okPostStudioResult(
  input: Exclude<PostStudioMutationResult, { ok: false; error: string }>,
): PostStudioMutationResult {
  return input;
}

function errorPostStudioResult(error: string): PostStudioMutationResult {
  return {
    ok: false,
    error,
  };
}

function normalizePostSettingsInput(input: {
  postGenerationEnabled: boolean;
  postGenerationIntervalHours: number;
  postGenerationContentType: string;
  postGenerationThreadId: string | null;
}) {
  const intervalHours = Math.min(
    24,
    Math.max(1, Math.floor(input.postGenerationIntervalHours || 2)),
  );
  const contentType =
    input.postGenerationContentType === "workout" ||
    input.postGenerationContentType === "recipe" ||
    input.postGenerationContentType === "mixed"
      ? input.postGenerationContentType
      : "mixed";
  const threadId = input.postGenerationThreadId?.trim() || null;

  return {
    postGenerationEnabled: input.postGenerationEnabled,
    postGenerationIntervalHours: intervalHours,
    postGenerationContentType: contentType,
    postGenerationThreadId: threadId,
  } satisfies Pick<
    WebProject,
    | "postGenerationEnabled"
    | "postGenerationIntervalHours"
    | "postGenerationContentType"
    | "postGenerationThreadId"
  >;
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

export async function updateProjectPostSettingsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");
  const postGenerationEnabled = formData.get("postGenerationEnabled") === "on";
  const postGenerationIntervalHours = formData.get("postGenerationIntervalHours");
  const postGenerationContentType = formData.get("postGenerationContentType");
  const postGenerationThreadId = formData.get("postGenerationThreadId");

  if (
    typeof projectId !== "string" ||
    typeof postGenerationIntervalHours !== "string" ||
    typeof postGenerationContentType !== "string"
  ) {
    return;
  }

  await updateWebProjectPostSettings({
    ownerEmail,
    projectId,
    postGenerationEnabled,
    postGenerationIntervalHours: Number(postGenerationIntervalHours),
    postGenerationContentType,
    postGenerationThreadId:
      typeof postGenerationThreadId === "string" ? postGenerationThreadId : null,
  });

  revalidatePath("/cabinet/web");
  redirectToPostState(projectId, "settings-saved");
}

export async function updateProjectPostSettingsClientAction(input: {
  projectId: string;
  postGenerationEnabled: boolean;
  postGenerationIntervalHours: number;
  postGenerationContentType: string;
  postGenerationThreadId: string | null;
}): Promise<PostStudioMutationResult> {
  const ownerEmail = await requireOwnerEmail();

  if (typeof input.projectId !== "string") {
    return errorPostStudioResult("Не вдалося зберегти queue settings.");
  }

  const normalizedSettings = normalizePostSettingsInput(input);

  await updateWebProjectPostSettings({
    ownerEmail,
    projectId: input.projectId,
    ...normalizedSettings,
  });

  revalidatePath("/cabinet/web");

  return okPostStudioResult({
    ok: true,
    notice: "settings-saved",
    postSettings: normalizedSettings,
  });
}

function buildPublishedPostMessage(input: {
  title: string;
  caption: string;
  imageSource: string | null;
  imageCreditName: string | null;
}) {
  const baseText = [input.title.trim(), input.caption.trim()]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const creditLine =
    input.imageSource === "Pexels" && input.imageCreditName
      ? `\n\nPhoto: ${input.imageCreditName} / Pexels`
      : "";

  return `${baseText}${creditLine}`.trim();
}

function parseMessageThreadId(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value.trim());

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function generatePostDraftsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");
  const contentType = formData.get("contentType");
  const topicHint = formData.get("topicHint");

  if (
    typeof projectId !== "string" ||
    typeof contentType !== "string" ||
    !isPostContentType(contentType)
  ) {
    return;
  }

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId,
  });

  if (!project) {
    redirect("/cabinet/web");
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    redirectToPostState(projectId, "missing-ai-key");
  }

  try {
    await createPostDraftBatchForProject({
      project,
      contentType,
      topicHint: typeof topicHint === "string" ? topicHint : null,
    });

    revalidatePath("/cabinet/web");
    redirectToPostState(projectId, "generated");
  } catch (error) {
    console.error("Failed to generate post drafts", error);
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (message.includes("no suitable source")) {
      redirectToPostState(projectId, "source-unavailable");
    }

    redirectToPostState(projectId, "generation-failed");
  }
}

export async function generatePostDraftsClientAction(input: {
  projectId: string;
  contentType: string;
  topicHint?: string | null;
}): Promise<PostStudioMutationResult> {
  const ownerEmail = await requireOwnerEmail();

  if (
    typeof input.projectId !== "string" ||
    typeof input.contentType !== "string" ||
    !isPostContentType(input.contentType)
  ) {
    return errorPostStudioResult("Не вдалося згенерувати нові драфти.");
  }

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId: input.projectId,
  });

  if (!project) {
    return errorPostStudioResult("Проєкт не знайдено.");
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return errorPostStudioResult(
      "Для генерації постів потрібен `GEMINI_API_KEY` у середовищі проєкту.",
    );
  }

  try {
    await createPostDraftBatchForProject({
      project,
      contentType: input.contentType,
      topicHint:
        typeof input.topicHint === "string" ? input.topicHint : null,
    });

    const drafts = await listDraftWebPostsForProject({
      ownerEmail,
      projectId: input.projectId,
      limit: 24,
    });

    revalidatePath("/cabinet/web");

    return okPostStudioResult({
      ok: true,
      notice: "generated",
      drafts,
    });
  } catch (error) {
    console.error("Failed to generate post drafts", error);
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (message.includes("no suitable source")) {
      return errorPostStudioResult(
        "Зараз не вдалося взяти свіже джерело з API без повторів. Спробуй ще раз трохи пізніше або зміни тип поста.",
      );
    }

    return errorPostStudioResult(
      "Генерація драфтів не завершилась. Перевір API-ключі та спробуй ще раз.",
    );
  }
}

export async function runScheduledPostGenerationNowAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");

  if (typeof projectId !== "string") {
    return;
  }

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId,
  });

  if (!project) {
    redirect("/cabinet/web");
  }

  try {
    await createScheduledPostDraftBatch({
      project,
    });

    revalidatePath("/cabinet/web");
    redirectToPostState(projectId, "queue-generated");
  } catch (error) {
    console.error("Failed to generate scheduled post drafts", error);
    redirectToPostState(projectId, "generation-failed");
  }
}

export async function runScheduledPostGenerationNowClientAction(input: {
  projectId: string;
}): Promise<PostStudioMutationResult> {
  const ownerEmail = await requireOwnerEmail();

  if (typeof input.projectId !== "string") {
    return errorPostStudioResult("Не вдалося запустити queue.");
  }

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId: input.projectId,
  });

  if (!project) {
    return errorPostStudioResult("Проєкт не знайдено.");
  }

  try {
    await createScheduledPostDraftBatch({
      project,
    });

    await markWebProjectPostGenerationRun(project.id);

    const drafts = await listDraftWebPostsForProject({
      ownerEmail,
      projectId: input.projectId,
      limit: 24,
    });

    revalidatePath("/cabinet/web");

    return okPostStudioResult({
      ok: true,
      notice: "queue-generated",
      drafts,
      postSettings: {
        postGenerationEnabled: project.postGenerationEnabled,
        postGenerationIntervalHours: project.postGenerationIntervalHours,
        postGenerationContentType: project.postGenerationContentType,
        postGenerationThreadId: project.postGenerationThreadId,
        postGenerationLastRunAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to generate scheduled post drafts", error);

    return errorPostStudioResult(
      "Не вдалося запустити генерацію backlog-постів. Спробуй ще раз.",
    );
  }
}

export async function deleteWebPostDraftAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");
  const draftId = formData.get("draftId");

  if (typeof projectId !== "string" || typeof draftId !== "string") {
    return;
  }

  await deleteWebPostDraftForOwner({
    ownerEmail,
    projectId,
    draftId,
  });

  revalidatePath("/cabinet/web");
  redirectToPostState(projectId, "draft-deleted");
}

export async function deleteWebPostDraftClientAction(input: {
  projectId: string;
  draftId: string;
}): Promise<PostStudioMutationResult> {
  const ownerEmail = await requireOwnerEmail();

  if (typeof input.projectId !== "string" || typeof input.draftId !== "string") {
    return errorPostStudioResult("Не вдалося видалити драфт.");
  }

  await deleteWebPostDraftForOwner({
    ownerEmail,
    projectId: input.projectId,
    draftId: input.draftId,
  });

  revalidatePath("/cabinet/web");

  return okPostStudioResult({
    ok: true,
    notice: "draft-deleted",
    draftId: input.draftId,
  });
}

export async function publishWebPostDraftAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const projectId = formData.get("projectId");
  const draftId = formData.get("draftId");

  if (typeof projectId !== "string" || typeof draftId !== "string") {
    return;
  }

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId,
  });

  if (!project?.telegramBotToken || !project.telegramChatId) {
    redirectToPostState(projectId, "missing-telegram");
  }

  const draft = await getDraftWebPostForOwner({
    ownerEmail,
    projectId,
    draftId,
  });

  if (!draft) {
    redirectToPostState(projectId, "draft-not-found");
  }

  const messageText = buildPublishedPostMessage({
    title: draft.title,
    caption: draft.caption,
    imageSource: draft.imageSource,
    imageCreditName: draft.imageCreditName,
  });
  const messageThreadId = parseMessageThreadId(project.postGenerationThreadId);

  try {
    let publishedMessageId: number | null = null;

    if (draft.imageUrl) {
      try {
        const sentPhoto = await sendTelegramPhotoMessage({
          botToken: project.telegramBotToken,
          chatId: project.telegramChatId,
          photoUrl: draft.imageUrl,
          caption: messageText,
          messageThreadId,
        });

        publishedMessageId = sentPhoto.message_id;
      } catch {
        const sentText = await sendTelegramTextMessage({
          botToken: project.telegramBotToken,
          chatId: project.telegramChatId,
          text: messageText,
          messageThreadId,
        });

        publishedMessageId = sentText.message_id;
      }
    } else {
      const sentText = await sendTelegramTextMessage({
        botToken: project.telegramBotToken,
        chatId: project.telegramChatId,
        text: messageText,
        messageThreadId,
      });

      publishedMessageId = sentText.message_id;
    }

    await markWebPostDraftPublished({
      ownerEmail,
      projectId,
      draftId,
      publishedMessageId,
    });

    revalidatePath("/cabinet/web");
    redirectToPostState(projectId, "published");
  } catch (error) {
    console.error("Failed to publish post draft", error);
    redirectToPostState(projectId, "publish-failed");
  }
}

export async function publishWebPostDraftClientAction(input: {
  projectId: string;
  draftId: string;
}): Promise<PostStudioMutationResult> {
  const ownerEmail = await requireOwnerEmail();

  if (typeof input.projectId !== "string" || typeof input.draftId !== "string") {
    return errorPostStudioResult("Не вдалося опублікувати драфт.");
  }

  const project = await getWebProjectForOwner({
    ownerEmail,
    projectId: input.projectId,
  });

  if (!project?.telegramBotToken || !project.telegramChatId) {
    return errorPostStudioResult(
      "Спершу підключи Telegram-бота й групу для цього проєкту, щоб можна було публікувати драфти.",
    );
  }

  const draft = await getDraftWebPostForOwner({
    ownerEmail,
    projectId: input.projectId,
    draftId: input.draftId,
  });

  if (!draft) {
    return errorPostStudioResult(
      "Обраний драфт не знайдено. Спробуй згенерувати варіанти ще раз.",
    );
  }

  const messageText = buildPublishedPostMessage({
    title: draft.title,
    caption: draft.caption,
    imageSource: draft.imageSource,
    imageCreditName: draft.imageCreditName,
  });
  const messageThreadId = parseMessageThreadId(project.postGenerationThreadId);

  try {
    let publishedMessageId: number | null = null;

    if (draft.imageUrl) {
      try {
        const sentPhoto = await sendTelegramPhotoMessage({
          botToken: project.telegramBotToken,
          chatId: project.telegramChatId,
          photoUrl: draft.imageUrl,
          caption: messageText,
          messageThreadId,
        });

        publishedMessageId = sentPhoto.message_id;
      } catch {
        const sentText = await sendTelegramTextMessage({
          botToken: project.telegramBotToken,
          chatId: project.telegramChatId,
          text: messageText,
          messageThreadId,
        });

        publishedMessageId = sentText.message_id;
      }
    } else {
      const sentText = await sendTelegramTextMessage({
        botToken: project.telegramBotToken,
        chatId: project.telegramChatId,
        text: messageText,
        messageThreadId,
      });

      publishedMessageId = sentText.message_id;
    }

    await markWebPostDraftPublished({
      ownerEmail,
      projectId: input.projectId,
      draftId: input.draftId,
      publishedMessageId,
    });

    revalidatePath("/cabinet/web");

    return okPostStudioResult({
      ok: true,
      notice: "published",
      draftId: draft.id,
      publishedPost: {
        ...draft,
        status: "published",
        publishedMessageId,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to publish post draft", error);
    return errorPostStudioResult(
      "Не вдалося опублікувати драфт у Telegram. Перевір bot token, chat id і доступи бота.",
    );
  }
}
