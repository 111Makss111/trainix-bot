import {
  buildKnowledgePromptSections,
  loadProjectKnowledge,
} from "@/lib/project-knowledge";
import type { FacebookContentSettings } from "./settings";

type GeneratedFacebookContext = {
  audienceFocus: string;
  brandNotes: string;
  founderStoryAngle: string;
};

type GeminiContextResponse = {
  audience_focus?: string;
  brand_notes?: string;
  founder_story_angle?: string;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function cleanText(value: string | null | undefined) {
  return value?.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim() || "";
}

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  const withoutFence = cleaned.replace(/```$/i, "").trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return withoutFence;
  }

  return withoutFence.slice(firstBrace, lastBrace + 1);
}

function readableSetting(
  type:
    | "tone"
    | "style"
    | "goal"
    | "productPresence"
    | "cta"
    | "emotion"
    | "visual",
  value: string,
) {
  const maps = {
    tone: {
      human: "людяний",
      calm: "спокійний",
      energetic: "енергійний",
      expert: "експертний",
    },
    style: {
      short: "короткий",
      medium: "середній",
      story: "історія",
      list: "список або поради",
      "problem-solution": "проблема -> рішення",
    },
    goal: {
      awareness: "знайомити людей із продуктом",
      education: "давати корисні пояснення й практичну цінність",
      trust: "будувати довіру до Trainix і його підходу",
      engagement: "викликати реакції, відповіді та дискусію",
      "soft-promo": "м'яко підводити до продукту без агресивного продажу",
    },
    productPresence: {
      minimal: "мінімально згадувати продукт",
      balanced: "згадувати продукт помірно й доречно",
      strong: "робити продукт помітною частиною меседжу",
    },
    cta: {
      none: "без прямого CTA",
      soft: "з м'яким CTA",
      question: "з питанням наприкінці",
      follow: "із закликом стежити за сторінкою",
      waitlist: "із закликом очікувати запуску",
    },
    emotion: {
      reserved: "стриманий",
      warm: "теплий",
      inspiring: "натхненний",
      assertive: "впевнений і більш напористий",
    },
    visual: {
      photo: "реалістичні фото",
      "ai-visual": "AI-візуали",
      "branded-minimal": "мінімалістичні брендовані візуали",
      mixed: "змішаний візуальний стиль",
    },
  } as const;

  return maps[type][value as keyof (typeof maps)[typeof type]] || value;
}

function getFallbackContext(
  settings: Pick<
    FacebookContentSettings,
    | "toneProfile"
    | "postStyle"
    | "primaryGoal"
    | "productPresence"
    | "ctaStyle"
    | "emotionalLevel"
    | "visualStyle"
  >,
): GeneratedFacebookContext {
  return {
    audienceFocus: [
      "Новачки у тренуваннях, які хочуть прості й зрозумілі орієнтири.",
      "Люди, які випадали з режиму й хочуть повернути собі дисципліну без радикальних рішень.",
      "Зайняті люди, яким потрібна система для рутини, прогресу й контролю навантаження.",
      `Основний фокус контенту: ${readableSetting("goal", settings.primaryGoal)}.`,
    ].join("\n"),
    brandNotes: [
      `Trainix має звучати ${readableSetting("tone", settings.toneProfile)} і ${readableSetting("emotion", settings.emotionalLevel)}.`,
      `У постах варто ${readableSetting("productPresence", settings.productPresence)}.`,
      "Не обіцяти магічних результатів, не вигадувати неіснуючих функцій і не перетворювати текст на агресивну рекламу.",
      "Пояснювати просто, корисно й по-людськи, щоб пост виглядав як реальна думка бренду, а не бездушний шаблон.",
      `CTA має бути ${readableSetting("cta", settings.ctaStyle)}, а візуали краще орієнтувати на ${readableSetting("visual", settings.visualStyle)}.`,
    ].join("\n"),
    founderStoryAngle: [
      "Показувати, що Trainix народився з потреби у системності: не просто тренуватись, а тримати ритм, бачити прогрес і не випадати з рутини.",
      "Підкреслювати шлях створення продукту як практичний і чесний: менше пафосу, більше реальної логіки, дисципліни та бажання спростити життя людям, яким важко тримати режим.",
      `Коли доречно, подавати це через формат "${readableSetting("style", settings.postStyle)}", щоб відчувалось живо й природно для Facebook.`,
    ].join("\n"),
  };
}

async function buildKnowledgeContext() {
  const knowledge = await loadProjectKnowledge({
    name: "Trainix",
    slug: "trainix",
  });

  return buildKnowledgePromptSections({
    knowledge: knowledge.data,
    messageText: "Generate Facebook AI context for Trainix.",
  });
}

function buildContextPrompt(input: {
  settings: Pick<
    FacebookContentSettings,
    | "toneProfile"
    | "postStyle"
    | "primaryGoal"
    | "productPresence"
    | "ctaStyle"
    | "emotionalLevel"
    | "visualStyle"
  >;
  knowledgeContext: string;
}) {
  return [
    "You build smart default AI context for a Facebook content generator.",
    "The product is Trainix, a fitness product about workouts, routine, discipline, and progress.",
    "",
    "Use this product knowledge as the main source of truth:",
    input.knowledgeContext,
    "",
    "Current Facebook settings:",
    `- Tone: ${readableSetting("tone", input.settings.toneProfile)}`,
    `- Post style: ${readableSetting("style", input.settings.postStyle)}`,
    `- Main goal: ${readableSetting("goal", input.settings.primaryGoal)}`,
    `- Product presence: ${readableSetting("productPresence", input.settings.productPresence)}`,
    `- CTA style: ${readableSetting("cta", input.settings.ctaStyle)}`,
    `- Emotional level: ${readableSetting("emotion", input.settings.emotionalLevel)}`,
    `- Visual style: ${readableSetting("visual", input.settings.visualStyle)}`,
    "",
    "Task:",
    "- Generate three compact internal fields for the owner so they do not have to write them manually.",
    "- The fields must help the Facebook draft generator produce better posts.",
    "- Keep them practical, brand-specific, and reusable.",
    "",
    "Return JSON only in this exact shape:",
    '{ "audience_focus": "...", "brand_notes": "...", "founder_story_angle": "..." }',
    "",
    "Rules:",
    "- Write in Ukrainian.",
    "- Do not ask questions.",
    "- Do not add markdown headings.",
    "- Do not invent features missing from the product knowledge.",
    "- audience_focus should describe who the content is for in 3-4 useful lines.",
    "- brand_notes should define how Trainix must sound and what it must avoid.",
    "- founder_story_angle should explain what kind of founder/build-in-public angle fits this brand.",
  ].join("\n");
}

function parseContext(text: string) {
  const parsed = JSON.parse(extractJson(text)) as GeminiContextResponse;
  const audienceFocus = cleanText(parsed.audience_focus);
  const brandNotes = cleanText(parsed.brand_notes);
  const founderStoryAngle = cleanText(parsed.founder_story_angle);

  if (!audienceFocus || !brandNotes || !founderStoryAngle) {
    throw new Error("Gemini did not return complete Facebook context");
  }

  return {
    audienceFocus,
    brandNotes,
    founderStoryAngle,
  } satisfies GeneratedFacebookContext;
}

export async function generateFacebookSettingsContext(
  settings: Pick<
    FacebookContentSettings,
    | "toneProfile"
    | "postStyle"
    | "primaryGoal"
    | "productPresence"
    | "ctaStyle"
    | "emotionalLevel"
    | "visualStyle"
  >,
) {
  const fallback = getFallbackContext(settings);
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return fallback;
  }

  try {
    const knowledgeContext = await buildKnowledgeContext();
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
                  text: buildContextPrompt({
                    settings,
                    knowledgeContext,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return fallback;
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      return fallback;
    }

    return parseContext(text);
  } catch {
    return fallback;
  }
}
