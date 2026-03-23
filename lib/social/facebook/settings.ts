import { getSql } from "@/lib/neon";

export type FacebookContentSettings = {
  ownerEmail: string;
  toneProfile: string;
  postStyle: string;
  primaryGoal: string;
  productPresence: string;
  ctaStyle: string;
  emotionalLevel: string;
  visualStyle: string;
  postingCadence: string;
  audienceFocus: string | null;
  brandNotes: string | null;
  founderStoryAngle: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function getDefaultFacebookContentSettings(ownerEmail: string) {
  return {
    ownerEmail,
    toneProfile: "human",
    postStyle: "medium",
    primaryGoal: "awareness",
    productPresence: "balanced",
    ctaStyle: "soft",
    emotionalLevel: "warm",
    visualStyle: "mixed",
    postingCadence: "4-per-week",
    audienceFocus: null,
    brandNotes: null,
    founderStoryAngle: null,
    createdAt: null,
    updatedAt: null,
  } satisfies FacebookContentSettings;
}

async function ensureFacebookContentSettingsTable() {
  if (!facebookContentSettingsPromise) {
    facebookContentSettingsPromise = ensureFacebookContentSettingsTableInner().catch(
      (error) => {
        facebookContentSettingsPromise = null;
        throw error;
      },
    );
  }

  return facebookContentSettingsPromise;
}

let facebookContentSettingsPromise:
  | Promise<Awaited<ReturnType<typeof ensureFacebookContentSettingsTableInner>>>
  | null = null;

async function ensureFacebookContentSettingsTableInner() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
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
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_facebook_content_settings_updated
    ON facebook_content_settings (updated_at DESC)
  `;

  return sql;
}

function mapFacebookContentSettings(
  row: {
    owner_email: string;
    tone_profile: string;
    post_style: string;
    primary_goal: string;
    product_presence: string;
    cta_style: string;
    emotional_level: string;
    visual_style: string;
    posting_cadence: string;
    audience_focus: string | null;
    brand_notes: string | null;
    founder_story_angle: string | null;
    created_at: string;
    updated_at: string;
  },
) {
  return {
    ownerEmail: row.owner_email,
    toneProfile: row.tone_profile,
    postStyle: row.post_style,
    primaryGoal: row.primary_goal,
    productPresence: row.product_presence,
    ctaStyle: row.cta_style,
    emotionalLevel: row.emotional_level,
    visualStyle: row.visual_style,
    postingCadence: row.posting_cadence,
    audienceFocus: row.audience_focus,
    brandNotes: row.brand_notes,
    founderStoryAngle: row.founder_story_angle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies FacebookContentSettings;
}

export async function getFacebookContentSettings(ownerEmail: string) {
  const sql = await ensureFacebookContentSettingsTable();

  if (!sql) {
    return getDefaultFacebookContentSettings(ownerEmail);
  }

  const rows = (await sql`
    SELECT
      owner_email,
      tone_profile,
      post_style,
      primary_goal,
      product_presence,
      cta_style,
      emotional_level,
      visual_style,
      posting_cadence,
      audience_focus,
      brand_notes,
      founder_story_angle,
      created_at,
      updated_at
    FROM facebook_content_settings
    WHERE owner_email = ${ownerEmail}
    LIMIT 1
  `) as Array<{
    owner_email: string;
    tone_profile: string;
    post_style: string;
    primary_goal: string;
    product_presence: string;
    cta_style: string;
    emotional_level: string;
    visual_style: string;
    posting_cadence: string;
    audience_focus: string | null;
    brand_notes: string | null;
    founder_story_angle: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows[0]
    ? mapFacebookContentSettings(rows[0])
    : getDefaultFacebookContentSettings(ownerEmail);
}

export async function saveFacebookContentSettings(
  input: Omit<FacebookContentSettings, "createdAt" | "updatedAt">,
) {
  const sql = await ensureFacebookContentSettingsTable();

  if (!sql) {
    return;
  }

  await sql`
    INSERT INTO facebook_content_settings (
      owner_email,
      tone_profile,
      post_style,
      primary_goal,
      product_presence,
      cta_style,
      emotional_level,
      visual_style,
      posting_cadence,
      audience_focus,
      brand_notes,
      founder_story_angle
    )
    VALUES (
      ${input.ownerEmail},
      ${input.toneProfile},
      ${input.postStyle},
      ${input.primaryGoal},
      ${input.productPresence},
      ${input.ctaStyle},
      ${input.emotionalLevel},
      ${input.visualStyle},
      ${input.postingCadence},
      ${input.audienceFocus?.trim() || null},
      ${input.brandNotes?.trim() || null},
      ${input.founderStoryAngle?.trim() || null}
    )
    ON CONFLICT (owner_email)
    DO UPDATE SET
      tone_profile = EXCLUDED.tone_profile,
      post_style = EXCLUDED.post_style,
      primary_goal = EXCLUDED.primary_goal,
      product_presence = EXCLUDED.product_presence,
      cta_style = EXCLUDED.cta_style,
      emotional_level = EXCLUDED.emotional_level,
      visual_style = EXCLUDED.visual_style,
      posting_cadence = EXCLUDED.posting_cadence,
      audience_focus = EXCLUDED.audience_focus,
      brand_notes = EXCLUDED.brand_notes,
      founder_story_angle = EXCLUDED.founder_story_angle,
      updated_at = NOW()
  `;
}
