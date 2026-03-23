import { randomUUID } from "crypto";
import { getSql } from "./neon";

export const planPeriods = ["today", "week", "month", "year"] as const;
export const planStatuses = ["todo", "in_progress", "done"] as const;

export type PlanPeriod = (typeof planPeriods)[number];
export type PlanStatus = (typeof planStatuses)[number];

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
};

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

export function isPlanPeriod(value: string): value is PlanPeriod {
  return planPeriods.includes(value as PlanPeriod);
}

async function ensurePlansTable() {
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

  return sql;
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
  `) as Array<{
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
  }>;

  return rows.map((row) => ({
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
  }));
}

export async function createPlan(input: {
  ownerEmail: string;
  period: PlanPeriod;
  title: string;
  description: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return;
  }

  const title = normalizeTitle(input.title);
  const description = normalizeDescription(input.description);

  if (!title) {
    return;
  }

  await sql`
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
  `;
}

export async function updatePlan(input: {
  ownerEmail: string;
  planId: string;
  title: string;
  description: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return;
  }

  const title = normalizeTitle(input.title);
  const description = normalizeDescription(input.description);

  if (!title) {
    return;
  }

  await sql`
    UPDATE plans
    SET
      title = ${title},
      description = ${description},
      content = ${buildLegacyContent(title, description)},
      updated_at = NOW()
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export async function togglePlanInProgress(input: {
  ownerEmail: string;
  planId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return;
  }

  await sql`
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
  `;
}

export async function finishPlan(input: {
  ownerEmail: string;
  planId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return;
  }

  await sql`
    UPDATE plans
    SET
      status = 'done',
      completed = TRUE,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
      AND status <> 'done'
  `;
}

export async function deletePlan(input: {
  ownerEmail: string;
  planId: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return;
  }

  await sql`
    DELETE FROM plans
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
  `;
}
