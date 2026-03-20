import { randomUUID } from "crypto";
import { getSql } from "@/lib/neon";
import type { FacebookContentSettings } from "./settings";

export type FacebookPostDraft = {
  id: string;
  ownerEmail: string;
  topicHint: string | null;
  primaryGoal: string;
  toneProfile: string;
  postStyle: string;
  productPresence: string;
  emotionalLevel: string;
  visualStyle: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  imageDirection: string | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  imageSource: string | null;
  status: string;
  publishedPostId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FacebookPublishableDraft = FacebookPostDraft & {
  storedImageUrl: string | null;
};

type DraftRow = {
  id: string;
  owner_email: string;
  topic_hint: string | null;
  primary_goal: string;
  tone_profile: string;
  post_style: string;
  product_presence: string;
  emotional_level: string;
  visual_style: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  image_direction: string | null;
  image_prompt: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_source: string | null;
  status: string;
  published_post_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

async function ensureFacebookDraftsTable() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
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
      image_prompt TEXT,
      image_url TEXT,
      image_alt TEXT,
      image_source TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_post_id TEXT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_facebook_post_drafts_owner_status
    ON facebook_post_drafts (owner_email, status, created_at DESC)
  `;

  await sql`
    ALTER TABLE facebook_post_drafts
    ADD COLUMN IF NOT EXISTS image_prompt TEXT
  `;

  await sql`
    ALTER TABLE facebook_post_drafts
    ADD COLUMN IF NOT EXISTS image_url TEXT
  `;

  await sql`
    ALTER TABLE facebook_post_drafts
    ADD COLUMN IF NOT EXISTS image_alt TEXT
  `;

  await sql`
    ALTER TABLE facebook_post_drafts
    ADD COLUMN IF NOT EXISTS image_source TEXT
  `;

  await sql`
    ALTER TABLE facebook_post_drafts
    ADD COLUMN IF NOT EXISTS published_post_id TEXT
  `;

  await sql`
    ALTER TABLE facebook_post_drafts
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ
  `;

  return sql;
}

function mapDraft(
  row: DraftRow,
  options?: {
    includeStoredImageUrl?: boolean;
  },
) {
  const rawImageUrl = row.image_url;
  const imageUrl =
    typeof rawImageUrl === "string" && rawImageUrl.startsWith("data:image/")
      ? `/api/cabinet/facebook/drafts/${row.id}/image`
      : rawImageUrl;
  const baseDraft = {
    id: row.id,
    ownerEmail: row.owner_email,
    topicHint: row.topic_hint,
    primaryGoal: row.primary_goal,
    toneProfile: row.tone_profile,
    postStyle: row.post_style,
    productPresence: row.product_presence,
    emotionalLevel: row.emotional_level,
    visualStyle: row.visual_style,
    title: row.title,
    hook: row.hook,
    body: row.body,
    cta: row.cta,
    imageDirection: row.image_direction,
    imagePrompt: row.image_prompt,
    imageUrl,
    imageAlt: row.image_alt,
    imageSource: row.image_source,
    status: row.status,
    publishedPostId: row.published_post_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies FacebookPostDraft;

  if (options?.includeStoredImageUrl) {
    return {
      ...baseDraft,
      storedImageUrl: row.image_url,
    } satisfies FacebookPublishableDraft;
  }

  return baseDraft;
}

export async function archiveFacebookDrafts(ownerEmail: string) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE facebook_post_drafts
    SET
      status = 'archived',
      updated_at = NOW()
    WHERE owner_email = ${ownerEmail}
      AND status = 'draft'
  `;
}

export async function createFacebookDrafts(input: {
  ownerEmail: string;
  topicHint: string | null;
  settings: Pick<
    FacebookContentSettings,
    | "primaryGoal"
    | "toneProfile"
    | "postStyle"
    | "productPresence"
    | "emotionalLevel"
    | "visualStyle"
  >;
  drafts: Array<{
    title: string;
    hook: string;
    body: string;
    cta: string;
    imageDirection: string | null;
    imagePrompt: string | null;
    imageUrl: string | null;
    imageAlt: string | null;
    imageSource: string | null;
  }>;
}) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql || !input.drafts.length) {
    return;
  }

  for (const draft of input.drafts) {
    await sql`
      INSERT INTO facebook_post_drafts (
        id,
        owner_email,
        topic_hint,
        primary_goal,
        tone_profile,
        post_style,
        product_presence,
        emotional_level,
        visual_style,
        title,
        hook,
        body,
        cta,
        image_direction,
        image_prompt,
        image_url,
        image_alt,
        image_source
      )
      VALUES (
        ${randomUUID()},
        ${input.ownerEmail},
        ${input.topicHint},
        ${input.settings.primaryGoal},
        ${input.settings.toneProfile},
        ${input.settings.postStyle},
        ${input.settings.productPresence},
        ${input.settings.emotionalLevel},
        ${input.settings.visualStyle},
        ${draft.title},
        ${draft.hook},
        ${draft.body},
        ${draft.cta},
        ${draft.imageDirection},
        ${draft.imagePrompt},
        ${draft.imageUrl},
        ${draft.imageAlt},
        ${draft.imageSource}
      )
    `;
  }
}

export async function listFacebookDrafts(ownerEmail: string, limit = 6) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql) {
    return [] as FacebookPostDraft[];
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      topic_hint,
      primary_goal,
      tone_profile,
      post_style,
      product_presence,
      emotional_level,
      visual_style,
      title,
      hook,
      body,
      cta,
      image_direction,
      image_prompt,
      image_url,
      image_alt,
      image_source,
      status,
      published_post_id,
      published_at,
      created_at,
      updated_at
    FROM facebook_post_drafts
    WHERE owner_email = ${ownerEmail}
      AND status = 'draft'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as DraftRow[];

  return rows.map((row) => mapDraft(row));
}

export async function deleteFacebookDraft(input: {
  ownerEmail: string;
  draftId: string;
}) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql) {
    return;
  }

  await sql`
    DELETE FROM facebook_post_drafts
    WHERE id = ${input.draftId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function getFacebookDraftById(input: {
  ownerEmail: string;
  draftId: string;
}) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      topic_hint,
      primary_goal,
      tone_profile,
      post_style,
      product_presence,
      emotional_level,
      visual_style,
      title,
      hook,
      body,
      cta,
      image_direction,
      image_prompt,
      image_url,
      image_alt,
      image_source,
      status,
      published_post_id,
      published_at,
      created_at,
      updated_at
    FROM facebook_post_drafts
    WHERE id = ${input.draftId}
      AND owner_email = ${input.ownerEmail}
    LIMIT 1
  `) as DraftRow[];

  return rows[0]
    ? (mapDraft(rows[0], {
        includeStoredImageUrl: true,
      }) as FacebookPublishableDraft)
    : null;
}

export async function markFacebookDraftPublished(input: {
  ownerEmail: string;
  draftId: string;
  publishedPostId: string | null;
}) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE facebook_post_drafts
    SET
      status = 'published',
      published_post_id = ${input.publishedPostId},
      published_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.draftId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function attachFacebookDraftImage(input: {
  ownerEmail: string;
  draftId: string;
  imageUrl: string;
  imageAlt: string | null;
  imageSource: string;
}) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE facebook_post_drafts
    SET
      image_url = ${input.imageUrl},
      image_alt = ${input.imageAlt},
      image_source = ${input.imageSource},
      updated_at = NOW()
    WHERE id = ${input.draftId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function clearFacebookDraftImage(input: {
  ownerEmail: string;
  draftId: string;
}) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE facebook_post_drafts
    SET
      image_url = NULL,
      image_alt = NULL,
      image_source = NULL,
      updated_at = NOW()
    WHERE id = ${input.draftId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function getFacebookDraftStoredImage(input: {
  ownerEmail: string;
  draftId: string;
}) {
  const sql = await ensureFacebookDraftsTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      image_url,
      image_alt,
      image_source
    FROM facebook_post_drafts
    WHERE id = ${input.draftId}
      AND owner_email = ${input.ownerEmail}
    LIMIT 1
  `) as Array<{
    image_url: string | null;
    image_alt: string | null;
    image_source: string | null;
  }>;

  return rows[0] || null;
}
