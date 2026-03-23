import { getSql } from "@/lib/neon";
import { fetchFacebookPageProfile } from "./api";

export type FacebookPageConnection = {
  ownerEmail: string;
  pageId: string | null;
  pageName: string | null;
  pageCategory: string | null;
  pageLink: string | null;
  pagePictureUrl: string | null;
  hasPageAccessToken: boolean;
  lastVerifiedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type FacebookPageConnectionRow = {
  owner_email: string;
  page_id: string | null;
  page_name: string | null;
  page_category: string | null;
  page_link: string | null;
  page_picture_url: string | null;
  page_access_token: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type FacebookPageConnectionRecord = FacebookPageConnection & {
  pageAccessToken: string | null;
};

async function ensureFacebookPageConnectionsTable() {
  if (!facebookPageConnectionsPromise) {
    facebookPageConnectionsPromise = ensureFacebookPageConnectionsTableInner().catch(
      (error) => {
        facebookPageConnectionsPromise = null;
        throw error;
      },
    );
  }

  return facebookPageConnectionsPromise;
}

let facebookPageConnectionsPromise:
  | Promise<Awaited<ReturnType<typeof ensureFacebookPageConnectionsTableInner>>>
  | null = null;

async function ensureFacebookPageConnectionsTableInner() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS facebook_page_connections (
      owner_email TEXT PRIMARY KEY,
      page_id TEXT,
      page_name TEXT,
      page_category TEXT,
      page_link TEXT,
      page_picture_url TEXT,
      page_access_token TEXT,
      last_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_facebook_page_connections_updated
    ON facebook_page_connections (updated_at DESC)
  `;

  return sql;
}

function mapFacebookPageConnection(
  row: FacebookPageConnectionRow,
): FacebookPageConnectionRecord {
  return {
    ownerEmail: row.owner_email,
    pageId: row.page_id,
    pageName: row.page_name,
    pageCategory: row.page_category,
    pageLink: row.page_link,
    pagePictureUrl: row.page_picture_url,
    pageAccessToken: row.page_access_token,
    hasPageAccessToken: Boolean(row.page_access_token),
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getFacebookPageConnectionRow(ownerEmail: string) {
  const sql = await ensureFacebookPageConnectionsTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      owner_email,
      page_id,
      page_name,
      page_category,
      page_link,
      page_picture_url,
      page_access_token,
      last_verified_at,
      created_at,
      updated_at
    FROM facebook_page_connections
    WHERE owner_email = ${ownerEmail}
    LIMIT 1
  `) as FacebookPageConnectionRow[];

  return rows[0] ? mapFacebookPageConnection(rows[0]) : null;
}

export async function getFacebookPageConnection(ownerEmail: string) {
  const connection = await getFacebookPageConnectionRow(ownerEmail);

  if (!connection) {
    return null;
  }

  return {
    ownerEmail: connection.ownerEmail,
    pageId: connection.pageId,
    pageName: connection.pageName,
    pageCategory: connection.pageCategory,
    pageLink: connection.pageLink,
    pagePictureUrl: connection.pagePictureUrl,
    hasPageAccessToken: connection.hasPageAccessToken,
    lastVerifiedAt: connection.lastVerifiedAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  } satisfies FacebookPageConnection;
}

export async function getFacebookPageConnectionCredentials(ownerEmail: string) {
  return getFacebookPageConnectionRow(ownerEmail);
}

export async function saveFacebookPageConnection(input: {
  ownerEmail: string;
  pageId: string;
  pageAccessToken?: string | null;
  pageName?: string | null;
  pageCategory?: string | null;
  pageLink?: string | null;
  pagePictureUrl?: string | null;
  lastVerifiedAt?: string | null;
}) {
  const sql = await ensureFacebookPageConnectionsTable();

  if (!sql) {
    return;
  }

  const existing = await getFacebookPageConnectionRow(input.ownerEmail);
  const normalizedPageId = input.pageId.trim();
  const normalizedPageAccessToken =
    typeof input.pageAccessToken === "string"
      ? input.pageAccessToken.trim() || null
      : existing?.pageAccessToken ?? null;
  const isSamePage = existing?.pageId === normalizedPageId;

  await sql`
    INSERT INTO facebook_page_connections (
      owner_email,
      page_id,
      page_name,
      page_category,
      page_link,
      page_picture_url,
      page_access_token,
      last_verified_at
    )
    VALUES (
      ${input.ownerEmail},
      ${normalizedPageId},
      ${
        typeof input.pageName === "string"
          ? input.pageName.trim() || null
          : isSamePage
            ? existing?.pageName ?? null
            : null
      },
      ${
        typeof input.pageCategory === "string"
          ? input.pageCategory.trim() || null
          : isSamePage
            ? existing?.pageCategory ?? null
            : null
      },
      ${
        typeof input.pageLink === "string"
          ? input.pageLink.trim() || null
          : isSamePage
            ? existing?.pageLink ?? null
            : null
      },
      ${
        typeof input.pagePictureUrl === "string"
          ? input.pagePictureUrl.trim() || null
          : isSamePage
            ? existing?.pagePictureUrl ?? null
            : null
      },
      ${normalizedPageAccessToken},
      ${
        typeof input.lastVerifiedAt === "string"
          ? input.lastVerifiedAt
          : isSamePage
            ? existing?.lastVerifiedAt ?? null
            : null
      }
    )
    ON CONFLICT (owner_email)
    DO UPDATE SET
      page_id = EXCLUDED.page_id,
      page_name = EXCLUDED.page_name,
      page_category = EXCLUDED.page_category,
      page_link = EXCLUDED.page_link,
      page_picture_url = EXCLUDED.page_picture_url,
      page_access_token = EXCLUDED.page_access_token,
      last_verified_at = EXCLUDED.last_verified_at,
      updated_at = NOW()
  `;
}

export async function clearFacebookPageConnection(ownerEmail: string) {
  const sql = await ensureFacebookPageConnectionsTable();

  if (!sql) {
    return;
  }

  await sql`
    DELETE FROM facebook_page_connections
    WHERE owner_email = ${ownerEmail}
  `;
}

export async function verifyFacebookPageConnection(input: {
  ownerEmail: string;
  pageId: string;
  pageAccessToken: string;
}) {
  const profile = await fetchFacebookPageProfile({
    pageId: input.pageId.trim(),
    pageAccessToken: input.pageAccessToken.trim(),
  });

  await saveFacebookPageConnection({
    ownerEmail: input.ownerEmail,
    pageId: profile.id || input.pageId,
    pageAccessToken: input.pageAccessToken,
    pageName: profile.name ?? null,
    pageCategory: profile.category ?? null,
    pageLink: profile.link ?? null,
    pagePictureUrl: profile.picture?.data?.url ?? null,
    lastVerifiedAt: new Date().toISOString(),
  });

  return getFacebookPageConnection(input.ownerEmail);
}
