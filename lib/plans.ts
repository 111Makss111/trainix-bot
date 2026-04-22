import { randomUUID } from "crypto";
import { getSql } from "./neon";

export const planPeriods = ["today", "week", "month", "year"] as const;
export const planStatuses = ["todo", "in_progress", "done"] as const;

export type PlanPeriod = (typeof planPeriods)[number];
export type PlanStatus = (typeof planStatuses)[number];

export type PlanAttachment = {
  id: string;
  planId: string;
  ownerEmail: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  textPreview: string | null;
  createdAt: string;
};

export type PlanItem = {
  id: string;
  ownerEmail: string;
  period: PlanPeriod;
  title: string;
  description: string | null;
  status: PlanStatus;
  completed: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: PlanAttachment[];
};

type PlanRow = {
  id: string;
  owner_email: string;
  period: PlanPeriod;
  title: string | null;
  description: string | null;
  status: PlanStatus;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlanAttachmentRow = {
  id: string;
  plan_id: string;
  owner_email: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  text_preview: string | null;
  content_base64: string;
  created_at: string;
};

let plansTablePromise: Promise<Awaited<ReturnType<typeof ensurePlansTableInner>>> | null =
  null;

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function normalizeTitle(title: string) {
  return normalizeText(title).replace(/\s*\n+\s*/g, " ");
}

function normalizeDescription(description: string) {
  const normalized = normalizeText(description);

  return normalized || null;
}

function buildLegacyContent(title: string, description: string | null) {
  return description ? `${title}\n${description}` : title;
}

function mapPlanAttachmentRow(row: PlanAttachmentRow): PlanAttachment {
  return {
    id: row.id,
    planId: row.plan_id,
    ownerEmail: row.owner_email,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    textPreview: row.text_preview,
    createdAt: row.created_at,
  };
}

function isTextPreviewable(fileName: string, mimeType: string) {
  if (mimeType.startsWith("text/")) {
    return true;
  }

  if (
    [
      "application/json",
      "application/javascript",
      "application/typescript",
      "application/xml",
    ].includes(mimeType)
  ) {
    return true;
  }

  return /\.(txt|md|json|js|jsx|ts|tsx|css|scss|html|xml|yml|yaml|svg)$/i.test(
    fileName,
  );
}

function buildTextPreview(fileName: string, mimeType: string, buffer: Buffer) {
  if (!isTextPreviewable(fileName, mimeType)) {
    return null;
  }

  const preview = buffer.toString("utf8").replace(/\r\n/g, "\n").trim();

  return preview ? preview.slice(0, 8000) : null;
}

export function isPlanPeriod(value: string): value is PlanPeriod {
  return planPeriods.includes(value as PlanPeriod);
}

function mapPlanRow(row: PlanRow): PlanItem {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    period: row.period,
    title: row.title?.trim() || "Нотатка",
    description: row.description,
    status: row.status,
    completed: row.status === "done" || Boolean(row.completed),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments: [],
  };
}

function attachPlanAttachments(
  plans: PlanItem[],
  attachments: PlanAttachment[],
) {
  const attachmentsByPlanId = new Map<string, PlanAttachment[]>();

  for (const attachment of attachments) {
    const current = attachmentsByPlanId.get(attachment.planId) ?? [];
    current.push(attachment);
    attachmentsByPlanId.set(attachment.planId, current);
  }

  return plans.map((plan) => ({
    ...plan,
    attachments:
      attachmentsByPlanId.get(plan.id)?.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ) ?? [],
  }));
}

async function ensurePlansTableInner() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      period TEXT NOT NULL,
      title TEXT,
      description TEXT,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE plans
    DROP CONSTRAINT IF EXISTS plans_period_check
  `;

  await sql`
    ALTER TABLE plans
    DROP CONSTRAINT IF EXISTS plans_status_check
  `;

  await sql`
    ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS title TEXT
  `;

  await sql`
    ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS description TEXT
  `;

  await sql`
    ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'
  `;

  await sql`
    ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await sql`
    ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ
  `;

  await sql`
    ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ
  `;

  await sql`
    UPDATE plans
    SET
      title = COALESCE(
        NULLIF(BTRIM(SPLIT_PART(content, E'\n', 1)), ''),
        'Нотатка'
      ),
      description = CASE
        WHEN POSITION(E'\n' IN content) > 0
          THEN NULLIF(
            BTRIM(SUBSTRING(content FROM POSITION(E'\n' IN content) + 1)),
            ''
          )
        ELSE NULL
      END
    WHERE title IS NULL
  `;

  await sql`
    UPDATE plans
    SET
      status = CASE
        WHEN completed = TRUE THEN 'done'
        WHEN status = 'done' THEN 'done'
        WHEN status = 'in_progress' THEN 'in_progress'
        ELSE 'todo'
      END
  `;

  await sql`
    UPDATE plans
    SET
      completed = CASE
        WHEN status = 'done' THEN TRUE
        ELSE FALSE
      END,
      completed_at = CASE
        WHEN status = 'done' THEN completed_at
        ELSE NULL
      END,
      started_at = CASE
        WHEN status = 'in_progress' THEN COALESCE(started_at, updated_at)
        ELSE NULL
      END
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_plans_owner_period_status
    ON plans (owner_email, period, status, updated_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS plan_attachments (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      owner_email TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      text_preview TEXT,
      content_base64 TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_plan_attachments_plan_created
    ON plan_attachments (plan_id, created_at DESC)
  `;

  return sql;
}

async function ensurePlansTable() {
  if (!plansTablePromise) {
    plansTablePromise = ensurePlansTableInner().catch((error) => {
      plansTablePromise = null;
      throw error;
    });
  }

  return plansTablePromise;
}

async function listPlanAttachmentsForOwner(
  ownerEmail: string,
  planIds?: string[],
) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return [] as PlanAttachment[];
  }

  const rows = (planIds?.length
    ? ((await sql`
        SELECT
          id,
          plan_id,
          owner_email,
          file_name,
          mime_type,
          size_bytes,
          text_preview,
          content_base64,
          created_at
        FROM plan_attachments
        WHERE owner_email = ${ownerEmail}
          AND plan_id = ANY(${planIds})
        ORDER BY created_at DESC
      `) as PlanAttachmentRow[])
    : ((await sql`
        SELECT
          id,
          plan_id,
          owner_email,
          file_name,
          mime_type,
          size_bytes,
          text_preview,
          content_base64,
          created_at
        FROM plan_attachments
        WHERE owner_email = ${ownerEmail}
        ORDER BY created_at DESC
      `) as PlanAttachmentRow[]));

  return rows.map(mapPlanAttachmentRow);
}

export async function listPlansForOwner(ownerEmail: string) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return [] as PlanItem[];
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      period,
      title,
      description,
      status,
      completed,
      started_at,
      completed_at,
      created_at,
      updated_at
    FROM plans
    WHERE owner_email = ${ownerEmail}
    ORDER BY
      CASE period
        WHEN 'today' THEN 1
        WHEN 'week' THEN 2
        WHEN 'month' THEN 3
        WHEN 'year' THEN 4
      END,
      CASE status
        WHEN 'in_progress' THEN 1
        WHEN 'todo' THEN 2
        WHEN 'done' THEN 3
      END,
      updated_at DESC
  `) as PlanRow[];

  const plans = rows.map(mapPlanRow);
  const attachments = await listPlanAttachmentsForOwner(
    ownerEmail,
    plans.map((plan) => plan.id),
  );

  return attachPlanAttachments(plans, attachments);
}

export async function createPlan(input: {
  ownerEmail: string;
  period: PlanPeriod;
  title: string;
  description: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return null;
  }

  const title = normalizeTitle(input.title);
  const description = normalizeDescription(input.description);

  if (!title) {
    return null;
  }

  const rows = (await sql`
    INSERT INTO plans (
      id,
      owner_email,
      period,
      title,
      description,
      content,
      status,
      completed,
      started_at,
      completed_at
    )
    VALUES (
      ${randomUUID()},
      ${input.ownerEmail},
      ${input.period},
      ${title},
      ${description},
      ${buildLegacyContent(title, description)},
      'todo',
      FALSE,
      NULL,
      NULL
    )
    RETURNING
      id,
      owner_email,
      period,
      title,
      description,
      status,
      completed,
      started_at,
      completed_at,
      created_at,
      updated_at
  `) as PlanRow[];

  return rows[0] ? mapPlanRow(rows[0]) : null;
}

export async function updatePlan(input: {
  ownerEmail: string;
  planId: string;
  title: string;
  description: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return null;
  }

  const title = normalizeTitle(input.title);
  const description = normalizeDescription(input.description);

  if (!title) {
    return null;
  }

  const rows = (await sql`
    UPDATE plans
    SET
      title = ${title},
      description = ${description},
      content = ${buildLegacyContent(title, description)},
      updated_at = NOW()
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
    RETURNING
      id,
      owner_email,
      period,
      title,
      description,
      status,
      completed,
      started_at,
      completed_at,
      created_at,
      updated_at
  `) as PlanRow[];

  return rows[0] ? mapPlanRow(rows[0]) : null;
}

export async function togglePlanInProgress(input: {
  ownerEmail: string;
  planId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    UPDATE plans
    SET
      status = CASE
        WHEN status = 'in_progress' THEN 'todo'
        ELSE 'in_progress'
      END,
      started_at = CASE
        WHEN status = 'in_progress' THEN NULL
        ELSE NOW()
      END,
      completed = FALSE,
      completed_at = NULL,
      updated_at = NOW()
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
      AND status <> 'done'
    RETURNING
      id,
      owner_email,
      period,
      title,
      description,
      status,
      completed,
      started_at,
      completed_at,
      created_at,
      updated_at
  `) as PlanRow[];

  return rows[0] ? mapPlanRow(rows[0]) : null;
}

export async function finishPlan(input: {
  ownerEmail: string;
  planId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    UPDATE plans
    SET
      status = 'done',
      completed = TRUE,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
      AND status <> 'done'
    RETURNING
      id,
      owner_email,
      period,
      title,
      description,
      status,
      completed,
      started_at,
      completed_at,
      created_at,
      updated_at
  `) as PlanRow[];

  return rows[0] ? mapPlanRow(rows[0]) : null;
}

export async function getPlanById(input: {
  ownerEmail: string;
  planId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      period,
      title,
      description,
      status,
      completed,
      started_at,
      completed_at,
      created_at,
      updated_at
    FROM plans
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
    LIMIT 1
  `) as PlanRow[];

  if (!rows[0]) {
    return null;
  }

  const attachments = await listPlanAttachmentsForOwner(input.ownerEmail, [
    input.planId,
  ]);

  return attachPlanAttachments([mapPlanRow(rows[0])], attachments)[0] ?? null;
}

export async function addPlanAttachment(input: {
  ownerEmail: string;
  planId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return null;
  }

  if (input.buffer.length > 4 * 1024 * 1024) {
    throw new Error("Файл завеликий. Максимум 4 MB.");
  }

  const fileName = normalizeTitle(input.fileName) || "attachment";
  const mimeType = input.mimeType.trim() || "application/octet-stream";
  const base64 = input.buffer.toString("base64");
  const textPreview = buildTextPreview(fileName, mimeType, input.buffer);

  const planExists = (await sql`
    SELECT id
    FROM plans
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
    LIMIT 1
  `) as Array<{ id: string }>;

  if (!planExists[0]) {
    return null;
  }

  const rows = (await sql`
    INSERT INTO plan_attachments (
      id,
      plan_id,
      owner_email,
      file_name,
      mime_type,
      size_bytes,
      text_preview,
      content_base64
    )
    VALUES (
      ${randomUUID()},
      ${input.planId},
      ${input.ownerEmail},
      ${fileName},
      ${mimeType},
      ${input.buffer.length},
      ${textPreview},
      ${base64}
    )
    RETURNING
      id,
      plan_id,
      owner_email,
      file_name,
      mime_type,
      size_bytes,
      text_preview,
      content_base64,
      created_at
  `) as PlanAttachmentRow[];

  return rows[0] ? mapPlanAttachmentRow(rows[0]) : null;
}

export async function deletePlanAttachment(input: {
  ownerEmail: string;
  attachmentId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return false;
  }

  const rows = (await sql`
    DELETE FROM plan_attachments
    WHERE id = ${input.attachmentId}
      AND owner_email = ${input.ownerEmail}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
}

export async function getPlanAttachmentById(input: {
  ownerEmail: string;
  attachmentId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      id,
      plan_id,
      owner_email,
      file_name,
      mime_type,
      size_bytes,
      text_preview,
      content_base64,
      created_at
    FROM plan_attachments
    WHERE id = ${input.attachmentId}
      AND owner_email = ${input.ownerEmail}
    LIMIT 1
  `) as PlanAttachmentRow[];

  return rows[0] ?? null;
}

export async function deletePlan(input: {
  ownerEmail: string;
  planId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return false;
  }

  const rows = (await sql`
    DELETE FROM plans
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
}
