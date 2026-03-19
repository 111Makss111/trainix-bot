type TelegramBotInfo = {
  id: number;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
};

type TelegramChatInfo = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

type TelegramApiResult<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  ip_address?: string;
};

type TelegramSentMessage = {
  message_id: number;
  chat?: {
    id?: number | string;
  };
  text?: string;
};

async function callTelegramApi<T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>,
) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: payload ? "POST" : "GET",
    headers: payload
      ? {
          "Content-Type": "application/json",
        }
      : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });

  const data = (await response.json()) as TelegramApiResult<T>;

  if (!data.ok || !data.result) {
    throw new Error(data.description || "Telegram API request failed");
  }

  return data.result;
}

function parseDataUrl(value: string) {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(value);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

export async function verifyTelegramConnection(input: {
  botToken: string;
  chatId: string;
}) {
  const bot = await callTelegramApi<TelegramBotInfo>(input.botToken, "getMe");
  const chat = await callTelegramApi<TelegramChatInfo>(input.botToken, "getChat", {
    chat_id: input.chatId,
  });

  return {
    bot,
    chat,
  };
}

export async function setTelegramWebhook(input: {
  botToken: string;
  webhookUrl: string;
  secretToken: string;
}) {
  return callTelegramApi<boolean>(input.botToken, "setWebhook", {
    url: input.webhookUrl,
    secret_token: input.secretToken,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: true,
  });
}

export async function deleteTelegramWebhook(botToken: string) {
  return callTelegramApi<boolean>(botToken, "deleteWebhook", {
    drop_pending_updates: true,
  });
}

export async function getTelegramWebhookInfo(botToken: string) {
  return callTelegramApi<TelegramWebhookInfo>(botToken, "getWebhookInfo");
}

export async function sendTelegramTextMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
  messageThreadId?: number | null;
  replyToMessageId?: number | null;
}) {
  const payload: Record<string, unknown> = {
    chat_id: input.chatId,
    text: input.text,
  };

  if (typeof input.messageThreadId === "number") {
    payload.message_thread_id = input.messageThreadId;
  }

  if (typeof input.replyToMessageId === "number") {
    payload.reply_parameters = {
      message_id: input.replyToMessageId,
      allow_sending_without_reply: true,
    };
  }

  return callTelegramApi<TelegramSentMessage>(input.botToken, "sendMessage", payload);
}

export async function sendTelegramPhotoMessage(input: {
  botToken: string;
  chatId: string;
  photoUrl: string;
  caption: string;
  messageThreadId?: number | null;
}) {
  const dataUrl = parseDataUrl(input.photoUrl);

  if (dataUrl) {
    const formData = new FormData();
    const buffer = Buffer.from(dataUrl.base64, "base64");
    const extension = dataUrl.mimeType.split("/")[1] || "png";

    formData.set("chat_id", input.chatId);
    formData.set("caption", input.caption.slice(0, 1024));
    formData.set(
      "photo",
      new Blob([buffer], { type: dataUrl.mimeType }),
      `generated-post.${extension}`,
    );

    if (typeof input.messageThreadId === "number") {
      formData.set("message_thread_id", String(input.messageThreadId));
    }

    const response = await fetch(
      `https://api.telegram.org/bot${input.botToken}/sendPhoto`,
      {
        method: "POST",
        body: formData,
        cache: "no-store",
      },
    );
    const data = (await response.json()) as TelegramApiResult<TelegramSentMessage>;

    if (!data.ok || !data.result) {
      throw new Error(data.description || "Telegram API request failed");
    }

    return data.result;
  }

  const payload: Record<string, unknown> = {
    chat_id: input.chatId,
    photo: input.photoUrl,
    caption: input.caption.slice(0, 1024),
  };

  if (typeof input.messageThreadId === "number") {
    payload.message_thread_id = input.messageThreadId;
  }

  return callTelegramApi<TelegramSentMessage>(input.botToken, "sendPhoto", payload);
}
