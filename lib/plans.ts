import { randomUUID } from "crypto";
import { getSql } from "./neon";

export const planPeriods = ["week", "month", "year"] as const;

export type PlanPeriod = (typeof planPeriods)[number];

export type PlanItem = {
  id: string;
  ownerEmail: string;
  period: PlanPeriod;
  content: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeContent(content: string) {
  return content.replace(/\r\n/g, "\n").trim();
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
      period TEXT NOT NULL CHECK (period IN ('week', 'month', 'year')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_plans_owner_period
    ON plans (owner_email, period, updated_at DESC)
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
      content,
      created_at,
      updated_at
    FROM plans
    WHERE owner_email = ${ownerEmail}
    ORDER BY
      CASE period
        WHEN 'week' THEN 1
        WHEN 'month' THEN 2
        WHEN 'year' THEN 3
      END,
      updated_at DESC
  `) as Array<{
    id: string;
    owner_email: string;
    period: PlanPeriod;
    content: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    ownerEmail: row.owner_email,
    period: row.period,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createPlan(input: {
  ownerEmail: string;
  period: PlanPeriod;
  content: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return;
  }

  const content = normalizeContent(input.content);

  if (!content) {
    return;
  }

  await sql`
    INSERT INTO plans (
      id,
      owner_email,
      period,
      content
    )
    VALUES (
      ${randomUUID()},
      ${input.ownerEmail},
      ${input.period},
      ${content}
    )
  `;
}

export async function updatePlan(input: {
  ownerEmail: string;
  planId: string;
  content: string;
}) {
  const sql = await ensurePlansTable();

  if (!sql) {
    return;
  }

  const content = normalizeContent(input.content);

  if (!content) {
    return;
  }

  await sql`
    UPDATE plans
    SET
      content = ${content},
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
