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
