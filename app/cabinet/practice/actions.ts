"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerEmail } from "@/lib/auth-guards";
import {
  deletePracticeTask,
  generatePracticeTasks,
  isPracticeDifficulty,
  isPracticeStack,
  isPracticeTaskType,
  updatePracticeTaskStatus,
} from "@/lib/practice";

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

export async function generatePracticeTasksAction(input: {
  stack: string;
  difficulty: string;
  taskType: string;
  count: number;
  includeHint: boolean;
  includeStarterCode: boolean;
  includeExpectedOutcome: boolean;
}) {
  const ownerEmail = await requireOwnerEmail();

  if (
    !isPracticeStack(input.stack) ||
    !isPracticeDifficulty(input.difficulty) ||
    !isPracticeTaskType(input.taskType)
  ) {
    return {
      ok: false as const,
      error: "Параметри генерації виглядають некоректно.",
    };
  }

  const count = [1, 3, 5].includes(input.count) ? input.count : 3;

  try {
    const tasks = await generatePracticeTasks({
      ownerEmail,
      stack: input.stack,
      difficulty: input.difficulty,
      taskType: input.taskType,
      count,
      includeHint: normalizeBoolean(input.includeHint),
      includeStarterCode: normalizeBoolean(input.includeStarterCode),
      includeExpectedOutcome: normalizeBoolean(input.includeExpectedOutcome),
    });

    revalidatePath("/cabinet/practice");

    if (!tasks.length) {
      return {
        ok: false as const,
        error: "Нових задач не згенерувалось. Спробуй інший тип або складність.",
      };
    }

    return {
      ok: true as const,
      tasks,
    };
  } catch (error) {
    console.error("Failed to generate practice tasks", error);

    return {
      ok: false as const,
      error: "Не вдалося згенерувати задачі. Спробуй ще раз.",
    };
  }
}

export async function updatePracticeTaskStatusAction(input: {
  taskId: string;
  status: "active" | "solved";
}) {
  const ownerEmail = await requireOwnerEmail();

  try {
    const task = await updatePracticeTaskStatus({
      ownerEmail,
      taskId: input.taskId,
      status: input.status,
    });

    if (!task) {
      return {
        ok: false as const,
        error: "Не вдалося знайти цю задачу.",
      };
    }

    revalidatePath("/cabinet/practice");

    return {
      ok: true as const,
      task,
    };
  } catch (error) {
    console.error("Failed to update practice task status", error);

    return {
      ok: false as const,
      error: "Не вдалося оновити статус задачі.",
    };
  }
}

export async function deletePracticeTaskAction(input: { taskId: string }) {
  const ownerEmail = await requireOwnerEmail();

  try {
    await deletePracticeTask({
      ownerEmail,
      taskId: input.taskId,
    });

    revalidatePath("/cabinet/practice");

    return {
      ok: true as const,
    };
  } catch (error) {
    console.error("Failed to delete practice task", error);

    return {
      ok: false as const,
      error: "Не вдалося видалити задачу.",
    };
  }
}
