import { createHash, randomUUID } from "crypto";
import { getSql } from "@/lib/neon";

export const practiceStacks = [
  "javascript",
  "typescript",
  "react",
  "html-css",
  "node",
] as const;

export const practiceDifficulties = ["easy", "medium", "hard"] as const;
export const practiceTaskTypes = [
  "logic",
  "components",
  "layout",
  "api",
  "state",
  "typing",
  "backend",
] as const;

export type PracticeStack = (typeof practiceStacks)[number];
export type PracticeDifficulty = (typeof practiceDifficulties)[number];
export type PracticeTaskType = (typeof practiceTaskTypes)[number];
export type PracticeTaskStatus = "active" | "solved";

export type PracticeTask = {
  id: string;
  ownerEmail: string;
  stack: PracticeStack;
  difficulty: PracticeDifficulty;
  taskType: PracticeTaskType;
  title: string;
  summary: string;
  instructions: string;
  providedData: string | null;
  starterCode: string | null;
  hint: string | null;
  expectedOutcome: string | null;
  fingerprint: string;
  status: PracticeTaskStatus;
  solvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PracticeTaskRow = {
  id: string;
  owner_email: string;
  stack: PracticeStack;
  difficulty: PracticeDifficulty;
  task_type: PracticeTaskType;
  title: string;
  summary: string;
  instructions: string;
  provided_data: string | null;
  starter_code: string | null;
  hint: string | null;
  expected_outcome: string | null;
  fingerprint: string;
  status: PracticeTaskStatus;
  solved_at: string | null;
  created_at: string;
  updated_at: string;
};

type GeneratedPracticeTask = Omit<
  PracticeTask,
  "id" | "ownerEmail" | "fingerprint" | "status" | "solvedAt" | "createdAt" | "updatedAt"
>;

let practiceTablePromise:
  | Promise<Awaited<ReturnType<typeof ensurePracticeTableInner>>>
  | null = null;

function mapPracticeTask(row: PracticeTaskRow): PracticeTask {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    stack: row.stack,
    difficulty: row.difficulty,
    taskType: row.task_type,
    title: row.title,
    summary: row.summary,
    instructions: row.instructions,
    providedData: row.provided_data,
    starterCode: row.starter_code,
    hint: row.hint,
    expectedOutcome: row.expected_outcome,
    fingerprint: row.fingerprint,
    status: row.status,
    solvedAt: row.solved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildPracticeFingerprint(input: {
  stack: PracticeStack;
  difficulty: PracticeDifficulty;
  taskType: PracticeTaskType;
  title: string;
  summary: string;
}) {
  return createHash("sha1")
    .update(
      [
        input.stack,
        input.difficulty,
        input.taskType,
        input.title.trim().toLowerCase(),
        input.summary.trim().toLowerCase(),
      ].join("|"),
    )
    .digest("hex");
}

function sanitizeGeneratedText(value: unknown, maxLength = 5000) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\r/g, "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function parseGeneratedTasks(payload: string): GeneratedPracticeTask[] {
  const normalized = payload.trim();
  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fencedMatch?.[1] ?? normalized;
  const parsed = JSON.parse(raw) as {
    tasks?: Array<Record<string, unknown>>;
  };
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

  return tasks
    .map((task) => {
      const stack = practiceStacks.includes(task.stack as PracticeStack)
        ? (task.stack as PracticeStack)
        : null;
      const difficulty = practiceDifficulties.includes(
        task.difficulty as PracticeDifficulty,
      )
        ? (task.difficulty as PracticeDifficulty)
        : null;
      const taskType = practiceTaskTypes.includes(task.taskType as PracticeTaskType)
        ? (task.taskType as PracticeTaskType)
        : null;
      const title = sanitizeGeneratedText(task.title, 120);
      const summary = sanitizeGeneratedText(task.summary, 240);
      const instructions = sanitizeGeneratedText(task.instructions, 3000);

      if (!stack || !difficulty || !taskType || !title || !summary || !instructions) {
        return null;
      }

      return {
        stack,
        difficulty,
        taskType,
        title,
        summary,
        instructions,
        providedData: sanitizeGeneratedText(task.providedData, 2000),
        starterCode: sanitizeGeneratedText(task.starterCode, 3000),
        hint: sanitizeGeneratedText(task.hint, 1200),
        expectedOutcome: sanitizeGeneratedText(task.expectedOutcome, 1200),
      } satisfies GeneratedPracticeTask;
    })
    .filter((task): task is GeneratedPracticeTask => Boolean(task));
}

function buildPrompt(input: {
  stack: PracticeStack;
  difficulty: PracticeDifficulty;
  taskType: PracticeTaskType;
  count: number;
  includeHint: boolean;
  includeStarterCode: boolean;
  includeExpectedOutcome: boolean;
  excludedFingerprints: string[];
  recentTitles: string[];
}) {
  return [
    "You generate practical coding tasks for a private developer training workspace.",
    "Return JSON only with shape: {\"tasks\":[...]}",
    `Generate exactly ${input.count} tasks.`,
    `Stack: ${input.stack}`,
    `Difficulty: ${input.difficulty}`,
    `Task type: ${input.taskType}`,
    "Rules:",
    "- Write in Ukrainian.",
    "- Make tasks concrete and realistic.",
    "- The task must include provided values or starter context so the user solves logic, not boilerplate setup.",
    "- Keep titles short and distinct.",
    "- Do not repeat recent themes or titles.",
    "- For React, give component-oriented tasks.",
    "- For HTML/CSS, focus on layout and UI behavior.",
    "- For Node, focus on backend handlers, validation, parsing, or APIs.",
    input.includeHint
      ? "- Include a useful hint."
      : "- Set hint to null.",
    input.includeStarterCode
      ? "- Include starterCode with a concise code scaffold."
      : "- Set starterCode to null.",
    input.includeExpectedOutcome
      ? "- Include expectedOutcome."
      : "- Set expectedOutcome to null.",
    input.recentTitles.length
      ? `Avoid tasks similar to these titles: ${input.recentTitles.join("; ")}`
      : "No recent titles available.",
    input.excludedFingerprints.length
      ? `Avoid reusing these fingerprints or themes: ${input.excludedFingerprints.join(", ")}`
      : "No existing fingerprints available.",
    "Each task item must contain:",
    "- stack",
    "- difficulty",
    "- taskType",
    "- title",
    "- summary",
    "- instructions",
    "- providedData",
    "- starterCode",
    "- hint",
    "- expectedOutcome",
  ].join("\n");
}

function buildFallbackTasks(input: {
  stack: PracticeStack;
  difficulty: PracticeDifficulty;
  taskType: PracticeTaskType;
  count: number;
  includeHint: boolean;
  includeStarterCode: boolean;
  includeExpectedOutcome: boolean;
}) {
  const starterCode =
    input.includeStarterCode && input.stack !== "html-css"
      ? "function solve(input) {\n  // TODO\n}\n"
      : input.includeStarterCode && input.stack === "html-css"
        ? "<section class=\"card-list\">\n  <!-- TODO -->\n</section>\n"
        : null;

  const baseTask: GeneratedPracticeTask = {
    stack: input.stack,
    difficulty: input.difficulty,
    taskType: input.taskType,
    title: `${input.stack.toUpperCase()} ${input.taskType} challenge`,
    summary: "Розв'яжи практичну задачу з чіткими вхідними даними.",
    instructions:
      "Створи рішення для задачі, використовуючи надані дані. Зосередься на логіці, структурі коду та читабельності рішення.",
    providedData:
      input.stack === "react"
        ? "products = [{ id: 1, name: 'Nike Air', inStock: true }, { id: 2, name: 'Metcon', inStock: false }]"
        : "input = [3, 7, 2, 9, 1]",
    starterCode,
    hint: input.includeHint
      ? "Почни з найпростішого сценарію, а потім покрий edge cases."
      : null,
    expectedOutcome: input.includeExpectedOutcome
      ? "Рішення має повертати або рендерити правильний результат для наданих значень."
      : null,
  };

  return Array.from({ length: input.count }, (_, index) => ({
    ...baseTask,
    title: `${baseTask.title} ${index + 1}`,
  }));
}

async function ensurePracticeTableInner() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS practice_tasks (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      stack TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      task_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      instructions TEXT NOT NULL,
      provided_data TEXT,
      starter_code TEXT,
      hint TEXT,
      expected_outcome TEXT,
      fingerprint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      solved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (owner_email, fingerprint)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_practice_tasks_owner_status_created
    ON practice_tasks (owner_email, status, created_at DESC)
  `;

  return sql;
}

export async function ensurePracticeTable() {
  if (!practiceTablePromise) {
    practiceTablePromise = ensurePracticeTableInner().catch((error) => {
      practiceTablePromise = null;
      throw error;
    });
  }

  return practiceTablePromise;
}

export async function listPracticeTasksForOwner(ownerEmail: string, limit = 80) {
  const sql = await ensurePracticeTable();

  if (!sql) {
    return [] as PracticeTask[];
  }

  const rows = (await sql`
    SELECT *
    FROM practice_tasks
    WHERE owner_email = ${ownerEmail}
    ORDER BY
      CASE WHEN status = 'active' THEN 0 ELSE 1 END,
      updated_at DESC
    LIMIT ${limit}
  `) as PracticeTaskRow[];

  return rows.map(mapPracticeTask);
}

export async function generatePracticeTasks(input: {
  ownerEmail: string;
  stack: PracticeStack;
  difficulty: PracticeDifficulty;
  taskType: PracticeTaskType;
  count: number;
  includeHint: boolean;
  includeStarterCode: boolean;
  includeExpectedOutcome: boolean;
}) {
  const sql = await ensurePracticeTable();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  const recentRows = (await sql`
    SELECT fingerprint, title
    FROM practice_tasks
    WHERE owner_email = ${input.ownerEmail}
    ORDER BY created_at DESC
    LIMIT 40
  `) as Array<{ fingerprint: string; title: string }>;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  let generated = buildFallbackTasks(input);

  if (apiKey) {
    try {
      const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: buildPrompt({
                      ...input,
                      excludedFingerprints: recentRows.map((row) => row.fingerprint),
                      recentTitles: recentRows.map((row) => row.title),
                    }),
                  },
                ],
              },
            ],
          }),
          cache: "no-store",
        },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };
        const text = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("")
          .trim();

        if (text) {
          const parsed = parseGeneratedTasks(text);

          if (parsed.length) {
            generated = parsed.slice(0, input.count);
          }
        }
      }
    } catch (error) {
      console.error("Falling back to local practice templates", error);
    }
  }

  const inserted: PracticeTask[] = [];

  for (const task of generated) {
    const fingerprint = buildPracticeFingerprint({
      stack: task.stack,
      difficulty: task.difficulty,
      taskType: task.taskType,
      title: task.title,
      summary: task.summary,
    });
    const rows = (await sql`
      INSERT INTO practice_tasks (
        id,
        owner_email,
        stack,
        difficulty,
        task_type,
        title,
        summary,
        instructions,
        provided_data,
        starter_code,
        hint,
        expected_outcome,
        fingerprint
      )
      VALUES (
        ${randomUUID()},
        ${input.ownerEmail},
        ${task.stack},
        ${task.difficulty},
        ${task.taskType},
        ${task.title},
        ${task.summary},
        ${task.instructions},
        ${task.providedData},
        ${task.starterCode},
        ${task.hint},
        ${task.expectedOutcome},
        ${fingerprint}
      )
      ON CONFLICT (owner_email, fingerprint) DO NOTHING
      RETURNING *
    `) as PracticeTaskRow[];

    if (rows[0]) {
      inserted.push(mapPracticeTask(rows[0]));
    }
  }

  return inserted;
}

export async function updatePracticeTaskStatus(input: {
  ownerEmail: string;
  taskId: string;
  status: PracticeTaskStatus;
}) {
  const sql = await ensurePracticeTable();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  const rows = (await sql`
    UPDATE practice_tasks
    SET
      status = ${input.status},
      solved_at = CASE WHEN ${input.status} = 'solved' THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = ${input.taskId}
      AND owner_email = ${input.ownerEmail}
    RETURNING *
  `) as PracticeTaskRow[];

  return rows[0] ? mapPracticeTask(rows[0]) : null;
}

export async function deletePracticeTask(input: {
  ownerEmail: string;
  taskId: string;
}) {
  const sql = await ensurePracticeTable();

  if (!sql) {
    throw new Error("Database is not configured");
  }

  await sql`
    DELETE FROM practice_tasks
    WHERE id = ${input.taskId}
      AND owner_email = ${input.ownerEmail}
  `;
}

export function isPracticeStack(value: string): value is PracticeStack {
  return practiceStacks.includes(value as PracticeStack);
}

export function isPracticeDifficulty(
  value: string,
): value is PracticeDifficulty {
  return practiceDifficulties.includes(value as PracticeDifficulty);
}

export function isPracticeTaskType(value: string): value is PracticeTaskType {
  return practiceTaskTypes.includes(value as PracticeTaskType);
}
