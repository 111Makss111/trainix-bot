import { randomUUID } from "crypto";
import { getSql } from "./neon";

export const planPeriods = ["today", "week", "month", "year"] as const;

export type PlanPeriod = (typeof planPeriods)[number];

export type PlanItem = {
  id: string;
  ownerEmail: string;
  period: PlanPeriod;
  title: string;
  description: string | null;
  completed: boolean;
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
      completed BOOLEAN NOT NULL DEFAULT FALSE,
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
    ADD CONSTRAINT plans_period_check
    CHECK (period IN ('today', 'week', 'month', 'year'))
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
    ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE
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
    CREATE INDEX IF NOT EXISTS idx_plans_owner_period_status
    ON plans (owner_email, period, completed, updated_at DESC)
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
      completed,
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
      completed ASC,
      updated_at DESC
  `) as Array<{
    id: string;
    owner_email: string;
    period: PlanPeriod;
    title: string | null;
    description: string | null;
    completed: boolean;
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
    completed: Boolean(row.completed),
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
      completed,
      completed_at
    )
    VALUES (
      ${randomUUID()},
      ${input.ownerEmail},
      ${input.period},
      ${title},
      ${description},
      ${buildLegacyContent(title, description)},
      FALSE,
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

export async function togglePlanCompleted(input: {
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
      completed = NOT completed,
      completed_at = CASE
        WHEN completed = FALSE THEN NOW()
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = ${input.planId}
      AND owner_email = ${input.ownerEmail}
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
