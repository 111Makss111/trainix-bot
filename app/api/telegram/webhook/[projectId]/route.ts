import { NextResponse } from "next/server";
import { getWebProjectById, logTelegramIncomingMessage } from "@/lib/web-projects";

type TelegramUpdateMessage = {
  message_id?: number;
  text?: string;
  caption?: string;
  date?: number;
  chat?: {
    id?: number | string;
    title?: string;
    type?: string;
  };
  from?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
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
    text: payload.text ?? payload.caption ?? null,
    rawPayload: JSON.stringify(update),
  });

  return NextResponse.json({ ok: true });
}
