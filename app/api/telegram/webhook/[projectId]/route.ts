import { NextResponse } from "next/server";
import { generateSmartTelegramReply } from "@/lib/smart-replies";
import { sendTelegramTextMessage } from "@/lib/telegram";
import { getWebProjectById, logTelegramIncomingMessage } from "@/lib/web-projects";

type TelegramUpdateMessage = {
  message_id?: number;
  text?: string;
  caption?: string;
  date?: number;
  entities?: Array<{
    type?: string;
    offset?: number;
    length?: number;
  }>;
  caption_entities?: Array<{
    type?: string;
    offset?: number;
    length?: number;
  }>;
  chat?: {
    id?: number | string;
    title?: string;
    type?: string;
    username?: string;
  };
  from?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
    is_bot?: boolean;
  };
  reply_to_message?: {
    from?: {
      id?: number | string;
      username?: string;
      is_bot?: boolean;
    };
  };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramUpdateMessage;
  edited_message?: TelegramUpdateMessage;
};

function pickUpdatePayload(update: TelegramUpdate) {
  if (update.message) {
    return {
      type: "message",
      payload: update.message,
    };
  }

  if (update.edited_message) {
    return {
      type: "edited_message",
      payload: update.edited_message,
    };
  }

  return null;
}

function buildSenderName(
  sender?: TelegramUpdateMessage["from"],
) {
  if (!sender) {
    return null;
  }

  const fullName = [sender.first_name, sender.last_name].filter(Boolean).join(" ").trim();

  return fullName || (sender.username ? `@${sender.username}` : null);
}

function pickMessageText(message: TelegramUpdateMessage) {
  return message.text ?? message.caption ?? null;
}

function doesChatMatchProject(
  boundChatId: string | null,
  message: TelegramUpdateMessage,
) {
  if (!boundChatId) {
    return true;
  }

  const normalizedBinding = boundChatId.trim().toLowerCase();

  if (normalizedBinding.startsWith("@")) {
    return message.chat?.username?.trim().toLowerCase() === normalizedBinding.slice(1);
  }

  return String(message.chat?.id ?? "") === boundChatId;
}

function hasBotMention(message: TelegramUpdateMessage, botUsername: string | null) {
  if (!botUsername) {
    return false;
  }

  const text = pickMessageText(message)?.toLowerCase() || "";
  return text.includes(`@${botUsername.toLowerCase()}`);
}

function isReplyToBot(message: TelegramUpdateMessage, botUsername: string | null) {
  const repliedUser = message.reply_to_message?.from;

  if (!repliedUser?.is_bot) {
    return false;
  }

  if (!botUsername) {
    return true;
  }

  return repliedUser.username?.toLowerCase() === botUsername.toLowerCase();
}

function shouldGenerateSmartReply(input: {
  projectSmartRepliesEnabled: boolean;
  botUsername: string | null;
  message: TelegramUpdateMessage;
  updateType: string;
}) {
  if (!input.projectSmartRepliesEnabled) {
    return false;
  }

  if (input.updateType !== "message") {
    return false;
  }

  if (input.message.from?.is_bot) {
    return false;
  }

  const text = pickMessageText(input.message)?.trim();

  if (!text) {
    return false;
  }

  if (input.message.chat?.type === "private") {
    return true;
  }

  return (
    hasBotMention(input.message, input.botUsername) ||
    isReplyToBot(input.message, input.botUsername)
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = await getWebProjectById(projectId);

  if (!project?.telegramWebhookEnabled || !project.telegramWebhookSecret) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (headerSecret !== project.telegramWebhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;

  if (typeof update.update_id !== "number") {
    return NextResponse.json({ ok: true });
  }

  const selected = pickUpdatePayload(update);

  if (!selected) {
    return NextResponse.json({ ok: true });
  }

  const payload = selected.payload;
  const messageText = pickMessageText(payload);

  if (!doesChatMatchProject(project.telegramChatId, payload)) {
    return NextResponse.json({ ok: true });
  }

  await logTelegramIncomingMessage({
    projectId,
    updateId: update.update_id,
    updateType: selected.type,
    telegramChatId:
      payload.chat?.id !== undefined ? String(payload.chat.id) : null,
    telegramMessageId:
      typeof payload.message_id === "number" ? payload.message_id : null,
    senderId: payload.from?.id !== undefined ? String(payload.from.id) : null,
    senderName: buildSenderName(payload.from),
    text: messageText,
    rawPayload: JSON.stringify(update),
  });

  if (
    shouldGenerateSmartReply({
      projectSmartRepliesEnabled: project.smartRepliesEnabled,
      botUsername: project.telegramBotUsername,
      message: payload,
      updateType: selected.type,
    }) &&
    project.telegramBotToken &&
    payload.chat?.id !== undefined &&
    messageText
  ) {
    try {
      const reply = await generateSmartTelegramReply({
        project,
        messageText,
        senderName: buildSenderName(payload.from),
        chatTitle: payload.chat?.title ?? payload.chat?.username ?? null,
      });

      if (reply) {
        await sendTelegramTextMessage({
          botToken: project.telegramBotToken,
          chatId: String(payload.chat.id),
          text: reply,
          replyToMessageId:
            typeof payload.message_id === "number" ? payload.message_id : null,
        });
      }
    } catch (error) {
      console.error("Failed to generate smart Telegram reply", error);
    }
  }

  return NextResponse.json({ ok: true });
}
