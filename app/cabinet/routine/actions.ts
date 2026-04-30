"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerEmail } from "@/lib/auth-guards";
import { deleteRoutineShift, saveRoutineShift } from "@/lib/routine";
import {
  isRoutineShiftKind,
  type RoutineShift,
  type RoutineShiftDraft,
} from "@/lib/routine-shared";

export type RoutineMutationResult =
  | { ok: true; shift: RoutineShift }
  | { ok: true; shiftId: string }
  | { ok: false; error: string };

function invalid(error: string): RoutineMutationResult {
  return {
    ok: false,
    error,
  };
}

function cleanClock(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";

  return normalized || null;
}

export async function saveRoutineShiftAction(
  draft: RoutineShiftDraft,
): Promise<RoutineMutationResult> {
  const ownerEmail = await requireOwnerEmail();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.shiftDate)) {
    return invalid("Обери коректну дату зміни.");
  }

  if (!isRoutineShiftKind(draft.shiftKind)) {
    return invalid("Обери коректний тип зміни.");
  }

  const shift = await saveRoutineShift({
    ownerEmail,
    draft: {
      shiftDate: draft.shiftDate,
      shiftKind: draft.shiftKind,
      workStart: cleanClock(draft.workStart),
      workEnd: cleanClock(draft.workEnd),
      leaveAt: cleanClock(draft.leaveAt),
      returnAt: cleanClock(draft.returnAt),
      notes: draft.notes,
    },
  });

  if (!shift) {
    return invalid("Не вдалося зберегти зміну.");
  }

  revalidatePath("/cabinet/routine");

  return {
    ok: true,
    shift,
  };
}

export async function deleteRoutineShiftAction(input: {
  shiftId: string;
}): Promise<RoutineMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const deleted = await deleteRoutineShift({
    ownerEmail,
    shiftId: input.shiftId,
  });

  if (!deleted) {
    return invalid("Не вдалося видалити зміну.");
  }

  revalidatePath("/cabinet/routine");

  return {
    ok: true,
    shiftId: input.shiftId,
  };
}
