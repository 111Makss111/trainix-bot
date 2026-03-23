"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createPlan,
  deletePlan,
  isPlanPeriod,
  togglePlanCompleted,
  updatePlan,
} from "@/lib/plans";

async function requireOwnerEmail() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    throw new Error("Unauthorized");
  }

  return session.user.email.trim().toLowerCase();
}

function getViewPeriod(formData: FormData) {
  const viewPeriod = formData.get("viewPeriod");

  if (typeof viewPeriod === "string" && isPlanPeriod(viewPeriod)) {
    return viewPeriod;
  }

  return "today";
}

function getViewMode(formData: FormData) {
  const viewMode = formData.get("viewMode");

  return viewMode === "history" ? "history" : "active";
}

export async function createPlanAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const viewPeriod = getViewPeriod(formData);
  const viewMode = getViewMode(formData);
  const period = formData.get("period");
  const title = formData.get("title");
  const description = formData.get("description");

  if (
    typeof period !== "string" ||
    typeof title !== "string" ||
    typeof description !== "string"
  ) {
    return;
  }

  if (!isPlanPeriod(period)) {
    return;
  }

  await createPlan({
    ownerEmail,
    period,
    title,
    description,
  });

  revalidatePath("/cabinet/notes");
  redirect(`/cabinet/notes?period=${viewPeriod}&mode=${viewMode}`);
}

export async function updatePlanAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const viewPeriod = getViewPeriod(formData);
  const viewMode = getViewMode(formData);
  const planId = formData.get("planId");
  const title = formData.get("title");
  const description = formData.get("description");

  if (
    typeof planId !== "string" ||
    typeof title !== "string" ||
    typeof description !== "string"
  ) {
    return;
  }

  await updatePlan({
    ownerEmail,
    planId,
    title,
    description,
  });

  revalidatePath("/cabinet/notes");
  redirect(`/cabinet/notes?period=${viewPeriod}&mode=${viewMode}`);
}

export async function togglePlanCompletedAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const viewPeriod = getViewPeriod(formData);
  const viewMode = getViewMode(formData);
  const planId = formData.get("planId");

  if (typeof planId !== "string") {
    return;
  }

  await togglePlanCompleted({
    ownerEmail,
    planId,
  });

  revalidatePath("/cabinet/notes");
  redirect(`/cabinet/notes?period=${viewPeriod}&mode=${viewMode}`);
}

export async function deletePlanAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const viewPeriod = getViewPeriod(formData);
  const viewMode = getViewMode(formData);
  const planId = formData.get("planId");

  if (typeof planId !== "string") {
    return;
  }

  await deletePlan({
    ownerEmail,
    planId,
  });

  revalidatePath("/cabinet/notes");
  redirect(`/cabinet/notes?period=${viewPeriod}&mode=${viewMode}`);
}
