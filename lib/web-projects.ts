import { randomUUID } from "crypto";
import { getSql } from "./neon";

export type WebProject = {
  id: string;
  ownerEmail: string;
  name: string;
  slug: string;
  description: string | null;
  aiInstructions: string | null;
  telegramBotToken: string | null;
  telegramBotName: string | null;
  telegramBotUsername: string | null;
  telegramChatId: string | null;
  telegramChatTitle: string | null;
  telegramChatType: string | null;
  telegramCanJoinGroups: boolean;
  telegramCanReadAllGroupMessages: boolean;
  telegramLastVerifiedAt: string | null;
  telegramWebhookSecret: string | null;
  telegramWebhookUrl: string | null;
  telegramWebhookEnabled: boolean;
  telegramWebhookLastEnabledAt: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  smartRepliesEnabled: boolean;
  autoPostsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TelegramMessageLog = {
  id: string;
  projectId: string;
  updateId: number;
  updateType: string;
  telegramChatId: string | null;
  telegramMessageId: number | null;
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  receivedAt: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function ensureWebProjectsTable() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS web_projects (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      ai_instructions TEXT,
      telegram_bot_token TEXT,
      telegram_bot_name TEXT,
      telegram_bot_username TEXT,
      telegram_chat_id TEXT,
      telegram_chat_title TEXT,
      telegram_chat_type TEXT,
      telegram_can_join_groups BOOLEAN NOT NULL DEFAULT FALSE,
      telegram_can_read_all_group_messages BOOLEAN NOT NULL DEFAULT FALSE,
      telegram_last_verified_at TIMESTAMPTZ,
      telegram_webhook_secret TEXT,
      telegram_webhook_url TEXT,
      telegram_webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      telegram_webhook_last_enabled_at TIMESTAMPTZ,
      ai_provider TEXT,
      ai_model TEXT,
      smart_replies_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      auto_posts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (owner_email, slug)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_web_projects_owner_updated
    ON web_projects (owner_email, updated_at DESC)
  `;

  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS ai_instructions TEXT
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_bot_name TEXT
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_chat_title TEXT
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_chat_type TEXT
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_can_join_groups BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_can_read_all_group_messages BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_last_verified_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_webhook_secret TEXT
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_webhook_url TEXT
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS telegram_webhook_last_enabled_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS telegram_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES web_projects(id) ON DELETE CASCADE,
      update_id BIGINT NOT NULL,
      update_type TEXT NOT NULL,
      telegram_chat_id TEXT,
      telegram_message_id BIGINT,
      sender_id TEXT,
      sender_name TEXT,
      text_content TEXT,
      raw_payload TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, update_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_telegram_messages_project_received
    ON telegram_messages (project_id, received_at DESC)
  `;

  return sql;
}

export async function listWebProjectsForOwner(ownerEmail: string) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return [] as WebProject[];
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      name,
      slug,
      description,
      ai_instructions,
      telegram_bot_token,
      telegram_bot_name,
      telegram_bot_username,
      telegram_chat_id,
      telegram_chat_title,
      telegram_chat_type,
      telegram_can_join_groups,
      telegram_can_read_all_group_messages,
      telegram_last_verified_at,
      telegram_webhook_secret,
      telegram_webhook_url,
      telegram_webhook_enabled,
      telegram_webhook_last_enabled_at,
      ai_provider,
      ai_model,
      smart_replies_enabled,
      auto_posts_enabled,
      created_at,
      updated_at
    FROM web_projects
    WHERE owner_email = ${ownerEmail}
    ORDER BY updated_at DESC, name ASC
  `) as Array<{
    id: string;
    owner_email: string;
    name: string;
    slug: string;
    description: string | null;
    ai_instructions: string | null;
    telegram_bot_token: string | null;
    telegram_bot_name: string | null;
    telegram_bot_username: string | null;
    telegram_chat_id: string | null;
    telegram_chat_title: string | null;
    telegram_chat_type: string | null;
    telegram_can_join_groups: boolean;
    telegram_can_read_all_group_messages: boolean;
    telegram_last_verified_at: string | null;
    telegram_webhook_secret: string | null;
    telegram_webhook_url: string | null;
    telegram_webhook_enabled: boolean;
    telegram_webhook_last_enabled_at: string | null;
    ai_provider: string | null;
    ai_model: string | null;
    smart_replies_enabled: boolean;
    auto_posts_enabled: boolean;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    slug: row.slug,
    description: row.description,
    aiInstructions: row.ai_instructions,
    telegramBotToken: row.telegram_bot_token,
    telegramBotName: row.telegram_bot_name,
    telegramBotUsername: row.telegram_bot_username,
    telegramChatId: row.telegram_chat_id,
    telegramChatTitle: row.telegram_chat_title,
    telegramChatType: row.telegram_chat_type,
    telegramCanJoinGroups: row.telegram_can_join_groups,
    telegramCanReadAllGroupMessages: row.telegram_can_read_all_group_messages,
    telegramLastVerifiedAt: row.telegram_last_verified_at,
    telegramWebhookSecret: row.telegram_webhook_secret,
    telegramWebhookUrl: row.telegram_webhook_url,
    telegramWebhookEnabled: row.telegram_webhook_enabled,
    telegramWebhookLastEnabledAt: row.telegram_webhook_last_enabled_at,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    smartRepliesEnabled: row.smart_replies_enabled,
    autoPostsEnabled: row.auto_posts_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createWebProject(input: {
  ownerEmail: string;
  name: string;
  description?: string | null;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  const name = input.name.trim();

  if (!name) {
    return;
  }

  const baseSlug = slugify(name) || "project";
  const suffix = Date.now().toString(36).slice(-4);
  const slug = `${baseSlug}-${suffix}`;

  await sql`
    INSERT INTO web_projects (
      id,
      owner_email,
      name,
      slug,
      description
    )
    VALUES (
      ${randomUUID()},
      ${input.ownerEmail},
      ${name},
      ${slug},
      ${input.description?.trim() || null}
    )
  `;
}

export async function getWebProjectForOwner(input: {
  ownerEmail: string;
  projectId: string;
}) {
  const projects = await listWebProjectsForOwner(input.ownerEmail);
  return projects.find((project) => project.id === input.projectId) ?? null;
}

export async function getWebProjectById(projectId: string) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      name,
      slug,
      description,
      ai_instructions,
      telegram_bot_token,
      telegram_bot_name,
      telegram_bot_username,
      telegram_chat_id,
      telegram_chat_title,
      telegram_chat_type,
      telegram_can_join_groups,
      telegram_can_read_all_group_messages,
      telegram_last_verified_at,
      telegram_webhook_secret,
      telegram_webhook_url,
      telegram_webhook_enabled,
      telegram_webhook_last_enabled_at,
      ai_provider,
      ai_model,
      smart_replies_enabled,
      auto_posts_enabled,
      created_at,
      updated_at
    FROM web_projects
    WHERE id = ${projectId}
    LIMIT 1
  `) as Array<{
    id: string;
    owner_email: string;
    name: string;
    slug: string;
    description: string | null;
    ai_instructions: string | null;
    telegram_bot_token: string | null;
    telegram_bot_name: string | null;
    telegram_bot_username: string | null;
    telegram_chat_id: string | null;
    telegram_chat_title: string | null;
    telegram_chat_type: string | null;
    telegram_can_join_groups: boolean;
    telegram_can_read_all_group_messages: boolean;
    telegram_last_verified_at: string | null;
    telegram_webhook_secret: string | null;
    telegram_webhook_url: string | null;
    telegram_webhook_enabled: boolean;
    telegram_webhook_last_enabled_at: string | null;
    ai_provider: string | null;
    ai_model: string | null;
    smart_replies_enabled: boolean;
    auto_posts_enabled: boolean;
    created_at: string;
    updated_at: string;
  }>;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    slug: row.slug,
    description: row.description,
    aiInstructions: row.ai_instructions,
    telegramBotToken: row.telegram_bot_token,
    telegramBotName: row.telegram_bot_name,
    telegramBotUsername: row.telegram_bot_username,
    telegramChatId: row.telegram_chat_id,
    telegramChatTitle: row.telegram_chat_title,
    telegramChatType: row.telegram_chat_type,
    telegramCanJoinGroups: row.telegram_can_join_groups,
    telegramCanReadAllGroupMessages: row.telegram_can_read_all_group_messages,
    telegramLastVerifiedAt: row.telegram_last_verified_at,
    telegramWebhookSecret: row.telegram_webhook_secret,
    telegramWebhookUrl: row.telegram_webhook_url,
    telegramWebhookEnabled: row.telegram_webhook_enabled,
    telegramWebhookLastEnabledAt: row.telegram_webhook_last_enabled_at,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    smartRepliesEnabled: row.smart_replies_enabled,
    autoPostsEnabled: row.auto_posts_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies WebProject;
}

export async function updateWebProjectTelegramSettings(input: {
  ownerEmail: string;
  projectId: string;
  botToken: string;
  chatId: string;
  smartRepliesEnabled: boolean;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  const botToken = input.botToken.trim();
  const chatId = input.chatId.trim();

  await sql`
    UPDATE web_projects
    SET
      telegram_bot_token = ${botToken || null},
      telegram_chat_id = ${chatId || null},
      smart_replies_enabled = ${input.smartRepliesEnabled},
      updated_at = NOW()
    WHERE id = ${input.projectId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function updateWebProjectAiInstructions(input: {
  ownerEmail: string;
  projectId: string;
  aiInstructions: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  const aiInstructions = input.aiInstructions.trim();

  await sql`
    UPDATE web_projects
    SET
      ai_instructions = ${aiInstructions || null},
      updated_at = NOW()
    WHERE id = ${input.projectId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function saveWebProjectTelegramVerification(input: {
  ownerEmail: string;
  projectId: string;
  botName: string;
  botUsername: string | null;
  resolvedChatId: string;
  chatTitle: string | null;
  chatType: string;
  canJoinGroups: boolean;
  canReadAllGroupMessages: boolean;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE web_projects
    SET
      telegram_bot_name = ${input.botName},
      telegram_bot_username = ${input.botUsername},
      telegram_chat_id = ${input.resolvedChatId},
      telegram_chat_title = ${input.chatTitle},
      telegram_chat_type = ${input.chatType},
      telegram_can_join_groups = ${input.canJoinGroups},
      telegram_can_read_all_group_messages = ${input.canReadAllGroupMessages},
      telegram_last_verified_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.projectId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function setWebProjectTelegramWebhook(input: {
  ownerEmail: string;
  projectId: string;
  webhookSecret: string;
  webhookUrl: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE web_projects
    SET
      telegram_webhook_secret = ${input.webhookSecret},
      telegram_webhook_url = ${input.webhookUrl},
      telegram_webhook_enabled = TRUE,
      telegram_webhook_last_enabled_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.projectId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function clearWebProjectTelegramWebhook(input: {
  ownerEmail: string;
  projectId: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE web_projects
    SET
      telegram_webhook_secret = NULL,
      telegram_webhook_url = NULL,
      telegram_webhook_enabled = FALSE,
      updated_at = NOW()
    WHERE id = ${input.projectId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function listRecentTelegramMessagesForProject(input: {
  ownerEmail: string;
  projectId: string;
  limit?: number;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return [] as TelegramMessageLog[];
  }

  const limit = input.limit ?? 12;

  const rows = (await sql`
    SELECT
      tm.id,
      tm.project_id,
      tm.update_id,
      tm.update_type,
      tm.telegram_chat_id,
      tm.telegram_message_id,
      tm.sender_id,
      tm.sender_name,
      tm.text_content,
      tm.received_at
    FROM telegram_messages tm
    INNER JOIN web_projects wp ON wp.id = tm.project_id
    WHERE tm.project_id = ${input.projectId}
      AND wp.owner_email = ${input.ownerEmail}
    ORDER BY tm.received_at DESC
    LIMIT ${limit}
  `) as Array<{
    id: string;
    project_id: string;
    update_id: number;
    update_type: string;
    telegram_chat_id: string | null;
    telegram_message_id: number | null;
    sender_id: string | null;
    sender_name: string | null;
    text_content: string | null;
    received_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    updateId: row.update_id,
    updateType: row.update_type,
    telegramChatId: row.telegram_chat_id,
    telegramMessageId: row.telegram_message_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    text: row.text_content,
    receivedAt: row.received_at,
  }));
}

export async function logTelegramIncomingMessage(input: {
  projectId: string;
  updateId: number;
  updateType: string;
  telegramChatId: string | null;
  telegramMessageId: number | null;
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  rawPayload: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    INSERT INTO telegram_messages (
      id,
      project_id,
      update_id,
      update_type,
      telegram_chat_id,
      telegram_message_id,
      sender_id,
      sender_name,
      text_content,
      raw_payload
    )
    VALUES (
      ${randomUUID()},
      ${input.projectId},
      ${input.updateId},
      ${input.updateType},
      ${input.telegramChatId},
      ${input.telegramMessageId},
      ${input.senderId},
      ${input.senderName},
      ${input.text},
      ${input.rawPayload}
    )
    ON CONFLICT (project_id, update_id) DO NOTHING
  `;
}

export async function deleteWebProject(input: {
  ownerEmail: string;
  projectId: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  // Future project-scoped tables should reference web_projects.id and
  // either be removed here or use ON DELETE CASCADE.
  await sql`
    DELETE FROM web_projects
    WHERE id = ${input.projectId}
      AND owner_email = ${input.ownerEmail}
  `;
}
