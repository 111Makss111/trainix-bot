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
  postGenerationEnabled: boolean;
  postGenerationIntervalHours: number;
  postGenerationContentType: string;
  postGenerationThreadId: string | null;
  postGenerationLastRunAt: string | null;
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

export type WebPostDraft = {
  id: string;
  projectId: string;
  contentType: string;
  topicHint: string | null;
  sourceKind: string;
  sourceKey: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  title: string;
  caption: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageCreditName: string | null;
  imageCreditUrl: string | null;
  imageSource: string | null;
  status: string;
  publishedMessageId: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type WebPostDraftRow = {
  id: string;
  project_id: string;
  content_type: string;
  topic_hint: string | null;
  source_kind: string;
  source_key: string;
  source_title: string | null;
  source_url: string | null;
  title: string;
  caption: string;
  image_url: string | null;
  image_alt: string | null;
  image_credit_name: string | null;
  image_credit_url: string | null;
  image_source: string | null;
  status: string;
  published_message_id: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

let webProjectsTablePromise: Promise<Awaited<ReturnType<typeof ensureWebProjectsTableInner>>> | null =
  null;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function ensureWebProjectsTableInner() {
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
      post_generation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      post_generation_interval_hours INTEGER NOT NULL DEFAULT 2,
      post_generation_content_type TEXT NOT NULL DEFAULT 'mixed',
      post_generation_thread_id TEXT,
      post_generation_last_run_at TIMESTAMPTZ,
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
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS post_generation_enabled BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS post_generation_interval_hours INTEGER NOT NULL DEFAULT 2
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS post_generation_content_type TEXT NOT NULL DEFAULT 'mixed'
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS post_generation_thread_id TEXT
  `;
  await sql`
    ALTER TABLE web_projects
    ADD COLUMN IF NOT EXISTS post_generation_last_run_at TIMESTAMPTZ
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

  await sql`
    CREATE TABLE IF NOT EXISTS web_post_drafts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES web_projects(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL,
      topic_hint TEXT,
      source_kind TEXT NOT NULL,
      source_key TEXT NOT NULL,
      source_title TEXT,
      source_url TEXT,
      source_payload TEXT NOT NULL,
      title TEXT NOT NULL,
      caption TEXT NOT NULL,
      image_url TEXT,
      image_alt TEXT,
      image_credit_name TEXT,
      image_credit_url TEXT,
      image_source TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_message_id BIGINT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_web_post_drafts_project_status
    ON web_post_drafts (project_id, status, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_web_post_drafts_project_content_published
    ON web_post_drafts (project_id, content_type, published_at DESC)
  `;

  return sql;
}

async function ensureWebProjectsTable() {
  if (!webProjectsTablePromise) {
    webProjectsTablePromise = ensureWebProjectsTableInner().catch((error) => {
      webProjectsTablePromise = null;
      throw error;
    });
  }

  return webProjectsTablePromise;
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
      post_generation_enabled,
      post_generation_interval_hours,
      post_generation_content_type,
      post_generation_thread_id,
      post_generation_last_run_at,
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
    post_generation_enabled: boolean;
    post_generation_interval_hours: number;
    post_generation_content_type: string;
    post_generation_thread_id: string | null;
    post_generation_last_run_at: string | null;
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
    postGenerationEnabled: row.post_generation_enabled,
    postGenerationIntervalHours: row.post_generation_interval_hours,
    postGenerationContentType: row.post_generation_content_type,
    postGenerationThreadId: row.post_generation_thread_id,
    postGenerationLastRunAt: row.post_generation_last_run_at,
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
  const project = await getWebProjectById(input.projectId);

  if (!project || project.ownerEmail !== input.ownerEmail) {
    return null;
  }

  return project;
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
      post_generation_enabled,
      post_generation_interval_hours,
      post_generation_content_type,
      post_generation_thread_id,
      post_generation_last_run_at,
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
    post_generation_enabled: boolean;
    post_generation_interval_hours: number;
    post_generation_content_type: string;
    post_generation_thread_id: string | null;
    post_generation_last_run_at: string | null;
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
    postGenerationEnabled: row.post_generation_enabled,
    postGenerationIntervalHours: row.post_generation_interval_hours,
    postGenerationContentType: row.post_generation_content_type,
    postGenerationThreadId: row.post_generation_thread_id,
    postGenerationLastRunAt: row.post_generation_last_run_at,
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

export async function updateWebProjectPostSettings(input: {
  ownerEmail: string;
  projectId: string;
  postGenerationEnabled: boolean;
  postGenerationIntervalHours: number;
  postGenerationContentType: string;
  postGenerationThreadId: string | null;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

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

  await sql`
    UPDATE web_projects
    SET
      post_generation_enabled = ${input.postGenerationEnabled},
      post_generation_interval_hours = ${intervalHours},
      post_generation_content_type = ${contentType},
      post_generation_thread_id = ${threadId},
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

export async function listWebProjectsDueForPostGeneration() {
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
      post_generation_enabled,
      post_generation_interval_hours,
      post_generation_content_type,
      post_generation_thread_id,
      post_generation_last_run_at,
      created_at,
      updated_at
    FROM web_projects
    WHERE post_generation_enabled = TRUE
      AND telegram_bot_token IS NOT NULL
      AND telegram_chat_id IS NOT NULL
      AND COALESCE(post_generation_interval_hours, 0) > 0
      AND (
        post_generation_last_run_at IS NULL
        OR post_generation_last_run_at <= NOW() - make_interval(hours => post_generation_interval_hours)
      )
    ORDER BY COALESCE(post_generation_last_run_at, to_timestamp(0)) ASC, updated_at ASC
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
    post_generation_enabled: boolean;
    post_generation_interval_hours: number;
    post_generation_content_type: string;
    post_generation_thread_id: string | null;
    post_generation_last_run_at: string | null;
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
    postGenerationEnabled: row.post_generation_enabled,
    postGenerationIntervalHours: row.post_generation_interval_hours,
    postGenerationContentType: row.post_generation_content_type,
    postGenerationThreadId: row.post_generation_thread_id,
    postGenerationLastRunAt: row.post_generation_last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function markWebProjectPostGenerationRun(projectId: string) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE web_projects
    SET
      post_generation_last_run_at = NOW(),
      updated_at = NOW()
    WHERE id = ${projectId}
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

export async function listRecentTelegramMessagesForChat(input: {
  projectId: string;
  telegramChatId: string;
  limit?: number;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return [] as TelegramMessageLog[];
  }

  const limit = input.limit ?? 8;

  const rows = (await sql`
    SELECT
      id,
      project_id,
      update_id,
      update_type,
      telegram_chat_id,
      telegram_message_id,
      sender_id,
      sender_name,
      text_content,
      received_at
    FROM telegram_messages
    WHERE project_id = ${input.projectId}
      AND telegram_chat_id = ${input.telegramChatId}
    ORDER BY received_at DESC
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

  return rows
    .map((row) => ({
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
    }))
    .reverse();
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

export async function logTelegramOutgoingMessage(input: {
  projectId: string;
  telegramChatId: string;
  telegramMessageId: number | null;
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  rawPayload: string;
}) {
  const syntheticUpdateId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));

  await logTelegramIncomingMessage({
    projectId: input.projectId,
    updateId: syntheticUpdateId,
    updateType: "bot_reply",
    telegramChatId: input.telegramChatId,
    telegramMessageId: input.telegramMessageId,
    senderId: input.senderId,
    senderName: input.senderName,
    text: input.text,
    rawPayload: input.rawPayload,
  });
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

export async function archiveDraftWebPostsForProject(input: {
  ownerEmail: string;
  projectId: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE web_post_drafts
    SET
      status = 'archived',
      updated_at = NOW()
    WHERE project_id = ${input.projectId}
      AND status = 'draft'
      AND EXISTS (
        SELECT 1
        FROM web_projects
        WHERE id = ${input.projectId}
          AND owner_email = ${input.ownerEmail}
      )
  `;
}

export async function createWebPostDrafts(input: {
  projectId: string;
  contentType: string;
  topicHint: string | null;
  sourceKind: string;
  sourceKey: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourcePayload: string;
  drafts: Array<{
    title: string;
    caption: string;
    imageUrl: string | null;
    imageAlt: string | null;
    imageCreditName: string | null;
    imageCreditUrl: string | null;
    imageSource: string | null;
  }>;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql || !input.drafts.length) {
    return;
  }

  for (const draft of input.drafts) {
    await sql`
      INSERT INTO web_post_drafts (
        id,
        project_id,
        content_type,
        topic_hint,
        source_kind,
        source_key,
        source_title,
        source_url,
        source_payload,
        title,
        caption,
        image_url,
        image_alt,
        image_credit_name,
        image_credit_url,
        image_source,
        status
      )
      VALUES (
        ${randomUUID()},
        ${input.projectId},
        ${input.contentType},
        ${input.topicHint},
        ${input.sourceKind},
        ${input.sourceKey},
        ${input.sourceTitle},
        ${input.sourceUrl},
        ${input.sourcePayload},
        ${draft.title},
        ${draft.caption},
        ${draft.imageUrl},
        ${draft.imageAlt},
        ${draft.imageCreditName},
        ${draft.imageCreditUrl},
        ${draft.imageSource},
        'draft'
      )
    `;
  }
}

function mapWebPostDraft(row: WebPostDraftRow) {
  const imageUrl =
    typeof row.image_url === "string" && row.image_url.startsWith("data:image/")
      ? `/api/cabinet/web/drafts/${row.id}/image`
      : row.image_url;

  return {
    id: row.id,
    projectId: row.project_id,
    contentType: row.content_type,
    topicHint: row.topic_hint,
    sourceKind: row.source_kind,
    sourceKey: row.source_key,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    title: row.title,
    caption: row.caption,
    imageUrl,
    imageAlt: row.image_alt,
    imageCreditName: row.image_credit_name,
    imageCreditUrl: row.image_credit_url,
    imageSource: row.image_source,
    status: row.status,
    publishedMessageId: row.published_message_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies WebPostDraft;
}

export async function listDraftWebPostsForProject(input: {
  ownerEmail: string;
  projectId: string;
  limit?: number;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return [] as WebPostDraft[];
  }

  const limit = input.limit ?? 24;

  const rows = (await sql`
    SELECT
      wpd.id,
      wpd.project_id,
      wpd.content_type,
      wpd.topic_hint,
      wpd.source_kind,
      wpd.source_key,
      wpd.source_title,
      wpd.source_url,
      wpd.title,
      wpd.caption,
      wpd.image_url,
      wpd.image_alt,
      wpd.image_credit_name,
      wpd.image_credit_url,
      wpd.image_source,
      wpd.status,
      wpd.published_message_id,
      wpd.published_at,
      wpd.created_at,
      wpd.updated_at
    FROM web_post_drafts wpd
    INNER JOIN web_projects wp ON wp.id = wpd.project_id
    WHERE wpd.project_id = ${input.projectId}
      AND wp.owner_email = ${input.ownerEmail}
      AND wpd.status = 'draft'
    ORDER BY wpd.created_at DESC
    LIMIT ${limit}
  `) as WebPostDraftRow[];

  return rows.map(mapWebPostDraft);
}

export async function listPublishedWebPostsForProject(input: {
  ownerEmail: string;
  projectId: string;
  limit?: number;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return [] as WebPostDraft[];
  }

  const limit = input.limit ?? 8;

  const rows = (await sql`
    SELECT
      wpd.id,
      wpd.project_id,
      wpd.content_type,
      wpd.topic_hint,
      wpd.source_kind,
      wpd.source_key,
      wpd.source_title,
      wpd.source_url,
      wpd.title,
      wpd.caption,
      wpd.image_url,
      wpd.image_alt,
      wpd.image_credit_name,
      wpd.image_credit_url,
      wpd.image_source,
      wpd.status,
      wpd.published_message_id,
      wpd.published_at,
      wpd.created_at,
      wpd.updated_at
    FROM web_post_drafts wpd
    INNER JOIN web_projects wp ON wp.id = wpd.project_id
    WHERE wpd.project_id = ${input.projectId}
      AND wp.owner_email = ${input.ownerEmail}
      AND wpd.status = 'published'
    ORDER BY COALESCE(wpd.published_at, wpd.created_at) DESC
    LIMIT ${limit}
  `) as WebPostDraftRow[];

  return rows.map(mapWebPostDraft);
}

export async function listRecentPublishedPostSourceKeys(input: {
  projectId: string;
  contentType: string;
  limit?: number;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return [] as string[];
  }

  const limit = input.limit ?? 30;
  const rows = (await sql`
    SELECT source_key
    FROM web_post_drafts
    WHERE project_id = ${input.projectId}
      AND content_type = ${input.contentType}
      AND status = 'published'
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  `) as Array<{ source_key: string }>;

  return rows.map((row) => row.source_key);
}

export async function getDraftWebPostForOwner(input: {
  ownerEmail: string;
  projectId: string;
  draftId: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      wpd.id,
      wpd.project_id,
      wpd.content_type,
      wpd.topic_hint,
      wpd.source_kind,
      wpd.source_key,
      wpd.source_title,
      wpd.source_url,
      wpd.title,
      wpd.caption,
      wpd.image_url,
      wpd.image_alt,
      wpd.image_credit_name,
      wpd.image_credit_url,
      wpd.image_source,
      wpd.status,
      wpd.published_message_id,
      wpd.published_at,
      wpd.created_at,
      wpd.updated_at
    FROM web_post_drafts wpd
    INNER JOIN web_projects wp ON wp.id = wpd.project_id
    WHERE wpd.id = ${input.draftId}
      AND wpd.project_id = ${input.projectId}
      AND wp.owner_email = ${input.ownerEmail}
    LIMIT 1
  `) as WebPostDraftRow[];

  return rows[0] ? mapWebPostDraft(rows[0]) : null;
}

export async function markWebPostDraftPublished(input: {
  ownerEmail: string;
  projectId: string;
  draftId: string;
  publishedMessageId: number | null;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE web_post_drafts
    SET
      status = 'published',
      published_message_id = ${input.publishedMessageId},
      published_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.draftId}
      AND project_id = ${input.projectId}
      AND EXISTS (
        SELECT 1
        FROM web_projects
        WHERE id = ${input.projectId}
          AND owner_email = ${input.ownerEmail}
      )
  `;
}

export async function deleteWebPostDraftForOwner(input: {
  ownerEmail: string;
  projectId: string;
  draftId: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    DELETE FROM web_post_drafts
    WHERE id = ${input.draftId}
      AND project_id = ${input.projectId}
      AND EXISTS (
        SELECT 1
        FROM web_projects
        WHERE id = ${input.projectId}
          AND owner_email = ${input.ownerEmail}
      )
  `;
}

export async function attachWebPostDraftImageForOwner(input: {
  ownerEmail: string;
  projectId: string;
  draftId: string;
  imageUrl: string;
  imageAlt: string | null;
  imageSource: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE web_post_drafts
    SET
      image_url = ${input.imageUrl},
      image_alt = ${input.imageAlt},
      image_source = ${input.imageSource},
      updated_at = NOW()
    WHERE id = ${input.draftId}
      AND project_id = ${input.projectId}
      AND EXISTS (
        SELECT 1
        FROM web_projects
        WHERE id = ${input.projectId}
          AND owner_email = ${input.ownerEmail}
      )
  `;
}

export async function clearWebPostDraftImageForOwner(input: {
  ownerEmail: string;
  projectId: string;
  draftId: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE web_post_drafts
    SET
      image_url = NULL,
      image_alt = NULL,
      image_source = NULL,
      updated_at = NOW()
    WHERE id = ${input.draftId}
      AND project_id = ${input.projectId}
      AND EXISTS (
        SELECT 1
        FROM web_projects
        WHERE id = ${input.projectId}
          AND owner_email = ${input.ownerEmail}
      )
  `;
}

export async function getWebPostDraftStoredImage(input: {
  ownerEmail: string;
  draftId: string;
}) {
  const sql = await ensureWebProjectsTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      wpd.image_url,
      wpd.image_alt,
      wpd.image_source
    FROM web_post_drafts wpd
    INNER JOIN web_projects wp ON wp.id = wpd.project_id
    WHERE wpd.id = ${input.draftId}
      AND wp.owner_email = ${input.ownerEmail}
    LIMIT 1
  `) as Array<{
    image_url: string | null;
    image_alt: string | null;
    image_source: string | null;
  }>;

  return rows[0] || null;
}
