"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createPlan,
  deletePlan,
  finishPlan,
  updatePlan,
  togglePlanInProgress,
  type PlanItem,
  type PlanPeriod,
} from "@/lib/plans";

export type NotesMutationResult =
  | { ok: true; plan: PlanItem }
  | { ok: true; planId: string }
  | { ok: false; error: string };

async function requireOwnerEmail() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    throw new Error("Unauthorized");
  }

  return session.user.email.trim().toLowerCase();
}

function invalidResult(error: string): NotesMutationResult {
  return {
    ok: false,
    error,
  };
}

export async function createPlanAction(input: {
  period: PlanPeriod;
  title: string;
  description: string;
}): Promise<NotesMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const plan = await createPlan({
    ownerEmail,
    period: input.period,
    title: input.title,
    description: input.description,
  });

  if (!plan) {
    return invalidResult("Не вдалося створити нотатку.");
  }

  revalidatePath("/cabinet/notes");

  return {
    ok: true,
    plan,
  };
}

export async function updatePlanAction(input: {
  planId: string;
  title: string;
  description: string;
}): Promise<NotesMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const plan = await updatePlan({
    ownerEmail,
    planId: input.planId,
    title: input.title,
    description: input.description,
  });

  if (!plan) {
    return invalidResult("Не вдалося оновити нотатку.");
  }

  revalidatePath("/cabinet/notes");

  return {
    ok: true,
    plan,
  };
}

export async function togglePlanInProgressAction(input: {
  planId: string;
}): Promise<NotesMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const plan = await togglePlanInProgress({
    ownerEmail,
    planId: input.planId,
  });

  if (!plan) {
    return invalidResult("Не вдалося змінити статус нотатки.");
  }

  revalidatePath("/cabinet/notes");

  return {
    ok: true,
    plan,
  };
}

export async function finishPlanAction(input: {
  planId: string;
}): Promise<NotesMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const plan = await finishPlan({
    ownerEmail,
    planId: input.planId,
  });

  if (!plan) {
    return invalidResult("Не вдалося завершити нотатку.");
  }

  revalidatePath("/cabinet/notes");

  return {
    ok: true,
    plan,
  };
}

export async function deletePlanAction(input: {
  planId: string;
}): Promise<NotesMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const deleted = await deletePlan({
    ownerEmail,
    planId: input.planId,
  });

  if (!deleted) {
    return invalidResult("Не вдалося видалити нотатку.");
  }

  revalidatePath("/cabinet/notes");

  return {
    ok: true,
    planId: input.planId,
  };
}
