import { access, readFile } from "fs/promises";
import path from "path";
import type { WebProject } from "./web-projects";

type ProjectKnowledgeIdentity = {
  summary?: string;
  audience?: string[];
  tone?: string;
  positioning?: string;
};

type ProjectKnowledgeFaqItem = {
  question: string;
  answer: string;
};

type ProjectKnowledgeWorkoutTemplate = {
  id: string;
  title: string;
  goal?: string;
  level?: string;
  duration?: string;
  equipment?: string[];
  warmup?: string[];
  main?: string[];
  finisher?: string[];
  notes?: string[];
};

export type ProjectKnowledgeBase = {
  identity?: ProjectKnowledgeIdentity;
  capabilities?: string[];
  limitations?: string[];
  response_rules?: string[];
  faq?: ProjectKnowledgeFaqItem[];
  workout_templates?: ProjectKnowledgeWorkoutTemplate[];
};

export type LoadedProjectKnowledge = {
  data: ProjectKnowledgeBase | null;
  key: string | null;
  relativePath: string | null;
};

function slugifyValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCandidateKeys(project: Pick<WebProject, "slug" | "name">) {
  const keys = new Set<string>();
  const normalizedSlug = slugifyValue(project.slug || "");
  const normalizedName = slugifyValue(project.name || "");

  if (normalizedSlug) {
    keys.add(normalizedSlug);
    keys.add(normalizedSlug.replace(/-[a-z0-9]{4}$/, ""));
  }

  if (normalizedName) {
    keys.add(normalizedName);
  }

  return [...keys].filter(Boolean);
}

export async function loadProjectKnowledge(
  project: Pick<WebProject, "slug" | "name">,
): Promise<LoadedProjectKnowledge> {
  const baseDir = path.join(process.cwd(), "knowledge", "web-projects");

  for (const key of buildCandidateKeys(project)) {
    const relativePath = path.join("knowledge", "web-projects", `${key}.json`);
    const absolutePath = path.join(baseDir, `${key}.json`);

    try {
      await access(absolutePath);
      const raw = await readFile(absolutePath, "utf8");
      const data = JSON.parse(raw) as ProjectKnowledgeBase;

      return {
        data,
        key,
        relativePath: relativePath.replace(/\\/g, "/"),
      };
    } catch {
      continue;
    }
  }

  return {
    data: null,
    key: null,
    relativePath: null,
  };
}

function formatList(title: string, items?: string[]) {
  if (!items?.length) {
    return null;
  }

  return `${title}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function formatFaq(faq?: ProjectKnowledgeFaqItem[]) {
  if (!faq?.length) {
    return null;
  }

  return [
    "FAQ:",
    ...faq.map((item) => `Q: ${item.question}\nA: ${item.answer}`),
  ].join("\n");
}

export function isWorkoutRequest(messageText: string) {
  const text = messageText.toLowerCase();

  return /тренув|вправ|програм|розмин|кардіо|прес|ноги|спина|workout|exercise|training|routine/.test(
    text,
  );
}

function templateScore(template: ProjectKnowledgeWorkoutTemplate, text: string) {
  let score = 0;
  const haystack = [
    template.title,
    template.goal,
    template.level,
    template.duration,
    ...(template.equipment ?? []),
    ...(template.notes ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const keywords = text
    .toLowerCase()
    .split(/[^a-zA-Zа-яА-ЯіїєґІЇЄҐ0-9]+/)
    .filter((item) => item.length > 2);

  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += 2;
    }
  }

  if (text.includes("дом") && haystack.includes("дом")) score += 3;
  if (text.includes("зал") && haystack.includes("зал")) score += 3;
  if (text.includes("новач") && haystack.includes("новач")) score += 3;
  if (text.includes("схуд") && haystack.includes("схуд")) score += 3;

  return score;
}

function formatWorkoutTemplate(template: ProjectKnowledgeWorkoutTemplate) {
  const sections = [
    `Template: ${template.title}`,
    template.goal ? `Goal: ${template.goal}` : null,
    template.level ? `Level: ${template.level}` : null,
    template.duration ? `Duration: ${template.duration}` : null,
    template.equipment?.length
      ? `Equipment: ${template.equipment.join(", ")}`
      : "Equipment: none specified",
    template.warmup?.length
      ? `Warm-up:\n${template.warmup.map((item) => `- ${item}`).join("\n")}`
      : null,
    template.main?.length
      ? `Main block:\n${template.main.map((item) => `- ${item}`).join("\n")}`
      : null,
    template.finisher?.length
      ? `Finisher:\n${template.finisher.map((item) => `- ${item}`).join("\n")}`
      : null,
    template.notes?.length
      ? `Notes:\n${template.notes.map((item) => `- ${item}`).join("\n")}`
      : null,
  ].filter(Boolean);

  return sections.join("\n");
}

export function buildKnowledgePromptSections(input: {
  knowledge: ProjectKnowledgeBase | null;
  messageText: string;
}) {
  if (!input.knowledge) {
    return "No structured JSON knowledge base found.";
  }

  const sections = [
    input.knowledge.identity?.summary
      ? `Identity summary: ${input.knowledge.identity.summary}`
      : null,
    input.knowledge.identity?.positioning
      ? `Positioning: ${input.knowledge.identity.positioning}`
      : null,
    input.knowledge.identity?.tone
      ? `Preferred tone: ${input.knowledge.identity.tone}`
      : null,
    formatList("Audience", input.knowledge.identity?.audience),
    formatList("Capabilities", input.knowledge.capabilities),
    formatList("Limitations", input.knowledge.limitations),
    formatList("Response rules", input.knowledge.response_rules),
    formatFaq(input.knowledge.faq),
  ].filter(Boolean);

  if (isWorkoutRequest(input.messageText) && input.knowledge.workout_templates?.length) {
    const templates = [...input.knowledge.workout_templates]
      .sort(
        (left, right) =>
          templateScore(right, input.messageText) - templateScore(left, input.messageText),
      )
      .slice(0, 2)
      .map(formatWorkoutTemplate);

    sections.push(
      [
        "Relevant workout templates:",
        ...templates,
      ].join("\n\n"),
    );
  }

  return sections.join("\n\n");
}
