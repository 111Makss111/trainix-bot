import { randomUUID } from "crypto";
import { getSql } from "@/lib/neon";
import {
  isRoutineShiftKind,
  routineShiftMeta,
  type RoutineShift,
  type RoutineShiftDraft,
  type RoutineShiftKind,
} from "@/lib/routine-shared";

type RoutineShiftRow = {
  id: string;
  owner_email: string;
  shift_date: string;
  shift_kind: RoutineShiftKind;
  work_start: string | null;
  work_end: string | null;
  leave_at: string | null;
  return_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

let routineTablesPromise:
  | Promise<Awaited<ReturnType<typeof ensureRoutineTablesInner>>>
  | null = null;

function normalizeDateKey(value: string) {
  const normalized = value.trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeClock(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : null;
}

function normalizeNotes(value: string | null | undefined) {
  const normalized = value?.replace(/\r\n/g, "\n").trim() ?? "";

  return normalized || null;
}

function mapRoutineShiftRow(row: RoutineShiftRow): RoutineShift {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    shiftDate:
      typeof row.shift_date === "string"
        ? row.shift_date.slice(0, 10)
        : String(row.shift_date),
    shiftKind: row.shift_kind,
    workStart: row.work_start,
    workEnd: row.work_end,
    leaveAt: row.leave_at,
    returnAt: row.return_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureRoutineTablesInner() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS routine_shifts (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      shift_date DATE NOT NULL,
      shift_kind TEXT NOT NULL,
      work_start TEXT,
      work_end TEXT,
      leave_at TEXT,
      return_at TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_routine_shifts_owner_date
    ON routine_shifts (owner_email, shift_date)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_routine_shifts_owner_range
    ON routine_shifts (owner_email, shift_date DESC)
  `;

  return sql;
}

async function ensureRoutineTables() {
  if (!routineTablesPromise) {
    routineTablesPromise = ensureRoutineTablesInner().catch((error) => {
      routineTablesPromise = null;
      throw error;
    });
  }

  return routineTablesPromise;
}

export async function listRoutineShiftsForOwner(input: {
  ownerEmail: string;
  fromDate: string;
  toDate: string;
}) {
  const sql = await ensureRoutineTables();
  const fromDate = normalizeDateKey(input.fromDate);
  const toDate = normalizeDateKey(input.toDate);

  if (!sql || !fromDate || !toDate) {
    return [] as RoutineShift[];
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      shift_date,
      shift_kind,
      work_start,
      work_end,
      leave_at,
      return_at,
      notes,
      created_at,
      updated_at
    FROM routine_shifts
    WHERE owner_email = ${input.ownerEmail}
      AND shift_date BETWEEN ${fromDate}::date AND ${toDate}::date
    ORDER BY shift_date ASC
  `) as RoutineShiftRow[];

  return rows.map(mapRoutineShiftRow);
}

export async function saveRoutineShift(input: {
  ownerEmail: string;
  draft: RoutineShiftDraft;
}) {
  const sql = await ensureRoutineTables();
  const shiftDate = normalizeDateKey(input.draft.shiftDate);
  const shiftKind = isRoutineShiftKind(input.draft.shiftKind)
    ? input.draft.shiftKind
    : "custom";

  if (!sql || !shiftDate) {
    return null;
  }

  const preset = routineShiftMeta[shiftKind];
  const isDayOff = shiftKind === "day_off";
  const workStart = isDayOff
    ? null
    : normalizeClock(input.draft.workStart) ?? preset.defaultWorkStart;
  const workEnd = isDayOff
    ? null
    : normalizeClock(input.draft.workEnd) ?? preset.defaultWorkEnd;
  const leaveAt = isDayOff
    ? null
    : normalizeClock(input.draft.leaveAt) ?? preset.defaultLeaveAt;
  const returnAt = isDayOff
    ? null
    : normalizeClock(input.draft.returnAt) ?? preset.defaultReturnAt;

  const rows = (await sql`
    INSERT INTO routine_shifts (
      id,
      owner_email,
      shift_date,
      shift_kind,
      work_start,
      work_end,
      leave_at,
      return_at,
      notes
    )
    VALUES (
      ${randomUUID()},
      ${input.ownerEmail},
      ${shiftDate}::date,
      ${shiftKind},
      ${workStart},
      ${workEnd},
      ${leaveAt},
      ${returnAt},
      ${normalizeNotes(input.draft.notes)}
    )
    ON CONFLICT (owner_email, shift_date)
    DO UPDATE SET
      shift_kind = EXCLUDED.shift_kind,
      work_start = EXCLUDED.work_start,
      work_end = EXCLUDED.work_end,
      leave_at = EXCLUDED.leave_at,
      return_at = EXCLUDED.return_at,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING
      id,
      owner_email,
      shift_date,
      shift_kind,
      work_start,
      work_end,
      leave_at,
      return_at,
      notes,
      created_at,
      updated_at
  `) as RoutineShiftRow[];

  return rows[0] ? mapRoutineShiftRow(rows[0]) : null;
}

export async function deleteRoutineShift(input: {
  ownerEmail: string;
  shiftId: string;
}) {
  const sql = await ensureRoutineTables();

  if (!sql) {
    return false;
  }

  const rows = (await sql`
    DELETE FROM routine_shifts
    WHERE id = ${input.shiftId}
      AND owner_email = ${input.ownerEmail}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
}
