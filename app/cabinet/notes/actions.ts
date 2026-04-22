"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerEmail } from "@/lib/auth-guards";
import {
  addPlanAttachment,
  createPlan,
  deletePlanAttachment,
  deletePlan,
  finishPlan,
  getPlanById,
  updatePlan,
  togglePlanInProgress,
  type PlanItem,
  type PlanPeriod,
} from "@/lib/plans";

export type NotesMutationResult =
  | { ok: true; plan: PlanItem }
  | { ok: true; planId: string }
  | { ok: false; error: string };

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
  const createdPlan = await createPlan({
    ownerEmail,
    period: input.period,
    title: input.title,
    description: input.description,
  });

  if (!createdPlan) {
    return invalidResult("Не вдалося створити нотатку.");
  }

  const plan = await getPlanById({
    ownerEmail,
    planId: createdPlan.id,
  });

  if (!plan) {
    return invalidResult("Не вдалося завантажити створену нотатку.");
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
  const updatedPlan = await updatePlan({
    ownerEmail,
    planId: input.planId,
    title: input.title,
    description: input.description,
  });

  if (!updatedPlan) {
    return invalidResult("Не вдалося оновити нотатку.");
  }

  const plan = await getPlanById({
    ownerEmail,
    planId: updatedPlan.id,
  });

  if (!plan) {
    return invalidResult("Не вдалося завантажити оновлену нотатку.");
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
  const toggledPlan = await togglePlanInProgress({
    ownerEmail,
    planId: input.planId,
  });

  if (!toggledPlan) {
    return invalidResult("Не вдалося змінити статус нотатки.");
  }

  const plan = await getPlanById({
    ownerEmail,
    planId: toggledPlan.id,
  });

  if (!plan) {
    return invalidResult("Не вдалося завантажити нотатку після зміни статусу.");
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
  const finishedPlan = await finishPlan({
    ownerEmail,
    planId: input.planId,
  });

  if (!finishedPlan) {
    return invalidResult("Не вдалося завершити нотатку.");
  }

  const plan = await getPlanById({
    ownerEmail,
    planId: finishedPlan.id,
  });

  if (!plan) {
    return invalidResult("Не вдалося завантажити завершену нотатку.");
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

export async function uploadPlanAttachmentAction(
  formData: FormData,
): Promise<NotesMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const planId = formData.get("planId");
  const file = formData.get("file");

  if (typeof planId !== "string" || !(file instanceof File)) {
    return invalidResult("Не вдалося зчитати вкладення.");
  }

  if (!file.size) {
    return invalidResult("Файл порожній.");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const attachment = await addPlanAttachment({
      ownerEmail,
      planId,
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    if (!attachment) {
      return invalidResult("Не вдалося додати вкладення до нотатки.");
    }

    const plan = await getPlanById({
      ownerEmail,
      planId,
    });

    if (!plan) {
      return invalidResult("Не вдалося оновити нотатку після завантаження файлу.");
    }

    revalidatePath("/cabinet/notes");

    return {
      ok: true,
      plan,
    };
  } catch (error) {
    if (error instanceof Error) {
      return invalidResult(error.message);
    }

    return invalidResult("Не вдалося завантажити вкладення.");
  }
}

export async function deletePlanAttachmentAction(input: {
  planId: string;
  attachmentId: string;
}): Promise<NotesMutationResult> {
  const ownerEmail = await requireOwnerEmail();
  const deleted = await deletePlanAttachment({
    ownerEmail,
    attachmentId: input.attachmentId,
  });

  if (!deleted) {
    return invalidResult("Не вдалося видалити вкладення.");
  }

  const plan = await getPlanById({
    ownerEmail,
    planId: input.planId,
  });

  if (!plan) {
    return invalidResult("Не вдалося оновити нотатку після видалення вкладення.");
  }

  revalidatePath("/cabinet/notes");

  return {
    ok: true,
    plan,
  };
}
