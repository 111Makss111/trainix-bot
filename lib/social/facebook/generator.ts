import {
  buildKnowledgePromptSections,
  loadProjectKnowledge,
} from "@/lib/project-knowledge";
import type { FacebookContentSettings } from "./settings";

type DraftSeed = {
  title: string;
  hook: string;
  body: string;
  cta: string;
  image_direction: string;
};

type FacebookDraftSeed = {
  title: string;
  hook: string;
  body: string;
  cta: string;
  imageDirection: string | null;
};

type GeminiFacebookDraftResponse = {
  drafts?: DraftSeed[];
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

function cleanText(value: string | null | undefined) {
  return value?.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim() || "";
}

function readableSetting(
  type:
    | "tone"
    | "style"
    | "goal"
    | "productPresence"
    | "cta"
    | "emotion"
    | "visual"
    | "cadence",
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
      story: "формат історії",
      list: "формат списку або порад",
      "problem-solution": "проблема -> рішення",
    },
    goal: {
      awareness: "awareness",
      education: "education",
      trust: "trust",
      engagement: "engagement",
      "soft-promo": "soft promo",
    },
    productPresence: {
      minimal: "мінімальна присутність продукту",
      balanced: "помірна присутність продукту",
      strong: "сильна присутність продукту",
    },
    cta: {
      none: "без CTA",
      soft: "м'який CTA",
      question: "питання в кінці",
      follow: "follow CTA",
      waitlist: "очікування запуску",
    },
    emotion: {
      reserved: "стриманий",
      warm: "теплий",
      inspiring: "натхненний",
      assertive: "напористий",
    },
    visual: {
      photo: "фото",
      "ai-visual": "AI visual",
      "branded-minimal": "branded minimal",
      mixed: "mixed",
    },
    cadence: {
      daily: "щодня",
      "5-per-week": "5 постів на тиждень",
      "4-per-week": "4 пости на тиждень",
      "3-per-week": "3 пости на тиждень",
      "2-per-week": "2 пости на тиждень",
    },
  } as const;

  return maps[type][value as keyof (typeof maps)[typeof type]] || value;
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

function normalizeDraft(draft: DraftSeed) {
  return {
    title: cleanText(draft.title).slice(0, 86),
    hook: cleanText(draft.hook).slice(0, 180),
    body: cleanText(draft.body).slice(0, 1400),
    cta: cleanText(draft.cta).slice(0, 160),
    imageDirection: cleanText(draft.image_direction).slice(0, 280) || null,
  } satisfies FacebookDraftSeed;
}

function parseDrafts(text: string) {
  const parsed = JSON.parse(extractJson(text)) as GeminiFacebookDraftResponse;
  const drafts = (parsed.drafts ?? [])
    .map((draft) => {
      const normalized = normalizeDraft(draft);

      if (
        !normalized.title ||
        !normalized.hook ||
        !normalized.body ||
        !normalized.cta
      ) {
        return null;
      }

      return normalized;
    })
    .filter(
      (
        draft,
      ): draft is {
        title: string;
        hook: string;
        body: string;
        cta: string;
        imageDirection: string | null;
      } => Boolean(draft),
    )
    .slice(0, 3) as FacebookDraftSeed[];

  if (drafts.length !== 3) {
    throw new Error("Gemini did not return exactly three valid Facebook drafts");
  }

  return drafts;
}

function getGeminiImageModel() {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
}

function getVisualStyleGuidance(visualStyle: string) {
  switch (visualStyle) {
    case "photo":
      return "Create a photorealistic fitness lifestyle scene, premium but believable, like a polished campaign photo for a modern training product.";
    case "ai-visual":
      return "Create a premium stylized AI visual with cinematic lighting and a modern fitness-tech atmosphere.";
    case "branded-minimal":
      return "Create a branded minimal visual with clean composition, subtle motion energy, abstract fitness cues, and premium restraint.";
    default:
      return "Blend realistic fitness lifestyle photography with a subtle branded atmosphere, keeping the result polished and feed-friendly.";
  }
}

function buildFacebookImagePrompt(input: {
  settings: FacebookContentSettings;
  draft: FacebookDraftSeed;
  knowledgeContext: string;
}) {
  return [
    "You create premium Facebook visuals for the Trainix brand.",
    "Trainix is a fitness product focused on workouts, discipline, routine, and progress.",
    "",
    `Draft title: ${input.draft.title}`,
    `Draft hook: ${input.draft.hook}`,
    input.draft.imageDirection
      ? `Preferred image direction: ${input.draft.imageDirection}`
      : null,
    `Tone profile: ${readableSetting("tone", input.settings.toneProfile)}`,
    `Emotional level: ${readableSetting("emotion", input.settings.emotionalLevel)}`,
    `Visual style: ${readableSetting("visual", input.settings.visualStyle)}`,
    input.settings.brandNotes
      ? `Brand notes: ${input.settings.brandNotes}`
      : null,
    "",
    "Product context:",
    input.knowledgeContext.slice(0, 2200),
    "",
    getVisualStyleGuidance(input.settings.visualStyle),
    "Rules:",
    "- No text overlays, captions, UI, logos, or watermarks.",
    "- Facebook feed friendly, premium quality, polished, visually clear.",
    "- Do not make it look like a random generic stock duplicate.",
    "- The visual must fit the draft and reinforce the product tone.",
    "- Prefer square or gentle portrait composition that works well in a feed preview.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateFacebookDraftImage(input: {
  settings: FacebookContentSettings;
  draft: FacebookDraftSeed;
  knowledgeContext: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        getGeminiImageModel(),
      )}:generateContent`,
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
                  text: buildFacebookImagePrompt(input),
                },
              ],
            },
          ],
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (part) => part.inline_data?.mime_type && part.inline_data?.data,
    );
    const mimeType = imagePart?.inline_data?.mime_type;
    const base64 = imagePart?.inline_data?.data;

    if (!mimeType || !base64) {
      return null;
    }

    return {
      imageUrl: `data:${mimeType};base64,${base64}`,
      imageAlt: `Facebook visual for ${input.draft.title}`,
      imageSource: "Gemini Image",
    };
  } catch {
    return null;
  }
}

async function attachGeneratedImages(input: {
  settings: FacebookContentSettings;
  drafts: FacebookDraftSeed[];
  knowledgeContext: string;
}) {
  const generatedImages = await Promise.all(
    input.drafts.map((draft) =>
      generateFacebookDraftImage({
        settings: input.settings,
        draft,
        knowledgeContext: input.knowledgeContext,
      }),
    ),
  );

  return input.drafts.map((draft, index) => {
    const generated = generatedImages[index];

    return {
      ...draft,
      imageUrl: generated?.imageUrl || null,
      imageAlt: generated?.imageAlt || null,
      imageSource: generated?.imageSource || null,
    };
  });
}

async function buildKnowledgeContext() {
  const knowledge = await loadProjectKnowledge({
    name: "Trainix",
    slug: "trainix",
  });

  return buildKnowledgePromptSections({
    knowledge: knowledge.data,
    messageText: "Generate Facebook drafts for Trainix.",
  });
}

function buildFacebookPrompt(input: {
  settings: FacebookContentSettings;
  topicHint: string | null;
  knowledgeContext: string;
}) {
  return [
    "You are a senior Facebook content strategist for Trainix.",
    "Trainix is a fitness product and digital assistant around workouts, routine, progress, and discipline.",
    "",
    "Use this product knowledge as the source of truth:",
    input.knowledgeContext,
    "",
    "Facebook content profile:",
    `- Tone: ${readableSetting("tone", input.settings.toneProfile)}`,
    `- Post style: ${readableSetting("style", input.settings.postStyle)}`,
    `- Main goal: ${readableSetting("goal", input.settings.primaryGoal)}`,
    `- Product presence: ${readableSetting("productPresence", input.settings.productPresence)}`,
    `- CTA style: ${readableSetting("cta", input.settings.ctaStyle)}`,
    `- Emotional level: ${readableSetting("emotion", input.settings.emotionalLevel)}`,
    `- Visual style: ${readableSetting("visual", input.settings.visualStyle)}`,
    `- Posting cadence: ${readableSetting("cadence", input.settings.postingCadence)}`,
    input.settings.audienceFocus
      ? `- Audience focus: ${input.settings.audienceFocus}`
      : null,
    input.settings.brandNotes
      ? `- Brand notes: ${input.settings.brandNotes}`
      : null,
    input.settings.founderStoryAngle
      ? `- Founder story angle: ${input.settings.founderStoryAngle}`
      : null,
    input.topicHint ? `- Topic hint from owner: ${input.topicHint}` : null,
    "",
    "Task:",
    "- Generate exactly 3 distinct Facebook post drafts.",
    "- Each draft must feel like a real post for a product audience, not a generic AI paragraph.",
    "- The drafts should respect the chosen goal and tone profile.",
    "- Make them useful, readable, and native for Facebook.",
    "- They should sound like they belong to one brand, but still differ from each other.",
    "",
    "Return JSON only in this exact structure:",
    '{ "drafts": [ { "title": "...", "hook": "...", "body": "...", "cta": "...", "image_direction": "..." } ] }',
    "",
    "Rules:",
    "- Write in Ukrainian.",
    "- No markdown tables.",
    "- No hashtags spam.",
    "- No fake testimonials or fake user stories.",
    "- Do not invent features that are not present in the product knowledge.",
    "- Body can be 2-4 short paragraphs with line breaks.",
    "- CTA must match the chosen CTA style.",
    "- image_direction should describe what kind of visual would fit this post.",
    "- Make each draft strategically different: e.g. one more direct, one more story-like, one more educational, while still staying inside the saved settings.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateFacebookDrafts(input: {
  settings: FacebookContentSettings;
  topicHint: string | null;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const knowledgeContext = await buildKnowledgeContext();
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
                text: buildFacebookPrompt({
                  settings: input.settings,
                  topicHint:
                    typeof input.topicHint === "string" && input.topicHint.trim()
                      ? input.topicHint.trim()
                      : null,
                  knowledgeContext,
                }),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 1,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const drafts = parseDrafts(text);

  return attachGeneratedImages({
    settings: input.settings,
    drafts,
    knowledgeContext,
  });
}
