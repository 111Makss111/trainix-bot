"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createPlan,
  deletePlan,
  isPlanPeriod,
  updatePlan,
} from "@/lib/plans";

async function requireOwnerEmail() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    throw new Error("Unauthorized");
  }

  return session.user.email.trim().toLowerCase();
}

export async function createPlanAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const period = formData.get("period");
  const content = formData.get("content");

  if (typeof period !== "string" || typeof content !== "string") {
    return;
  }

  if (!isPlanPeriod(period)) {
    return;
  }

  await createPlan({
    ownerEmail,
    period,
    content,
  });

  revalidatePath("/cabinet/notes");
}

export async function updatePlanAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const planId = formData.get("planId");
  const content = formData.get("content");

  if (typeof planId !== "string" || typeof content !== "string") {
    return;
  }

  await updatePlan({
    ownerEmail,
    planId,
    content,
  });

  revalidatePath("/cabinet/notes");
}

export async function deletePlanAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const planId = formData.get("planId");

  if (typeof planId !== "string") {
    return;
  }

  await deletePlan({
    ownerEmail,
    planId,
  });

  revalidatePath("/cabinet/notes");
}
