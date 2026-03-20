CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  google_sub TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('week', 'month', 'year')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_owner_period
ON plans (owner_email, period, updated_at DESC);

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
);

CREATE INDEX IF NOT EXISTS idx_web_projects_owner_updated
ON web_projects (owner_email, updated_at DESC);

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
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_project_received
ON telegram_messages (project_id, received_at DESC);

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
);

CREATE INDEX IF NOT EXISTS idx_web_post_drafts_project_status
ON web_post_drafts (project_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_post_drafts_project_content_published
ON web_post_drafts (project_id, content_type, published_at DESC);

CREATE TABLE IF NOT EXISTS facebook_content_settings (
  owner_email TEXT PRIMARY KEY,
  tone_profile TEXT NOT NULL DEFAULT 'human',
  post_style TEXT NOT NULL DEFAULT 'medium',
  primary_goal TEXT NOT NULL DEFAULT 'awareness',
  product_presence TEXT NOT NULL DEFAULT 'balanced',
  cta_style TEXT NOT NULL DEFAULT 'soft',
  emotional_level TEXT NOT NULL DEFAULT 'warm',
  visual_style TEXT NOT NULL DEFAULT 'mixed',
  posting_cadence TEXT NOT NULL DEFAULT '4-per-week',
  audience_focus TEXT,
  brand_notes TEXT,
  founder_story_angle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facebook_content_settings_updated
ON facebook_content_settings (updated_at DESC);

CREATE TABLE IF NOT EXISTS facebook_post_drafts (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  topic_hint TEXT,
  primary_goal TEXT NOT NULL,
  tone_profile TEXT NOT NULL,
  post_style TEXT NOT NULL,
  product_presence TEXT NOT NULL,
  emotional_level TEXT NOT NULL,
  visual_style TEXT NOT NULL,
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  body TEXT NOT NULL,
  cta TEXT NOT NULL,
  image_direction TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facebook_post_drafts_owner_status
ON facebook_post_drafts (owner_email, status, created_at DESC);
