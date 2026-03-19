import type { WebProject } from "./web-projects";

export type PostContentType = "workout" | "recipe";

export type PostDraftSeed = {
  title: string;
  caption: string;
  imageAlt: string | null;
};

type PexelsPhoto = {
  alt?: string;
  photographer?: string;
  photographer_url?: string;
  src?: {
    large2x?: string;
    large?: string;
    medium?: string;
  };
};

type PexelsSearchResponse = {
  photos?: PexelsPhoto[];
};

type WgerExerciseImage = Record<string, unknown>;

type WgerExerciseTranslation = {
  language?: number;
  name?: string;
  description?: string;
};

type WgerExerciseCategory = {
  name?: string;
};

type WgerExerciseEquipment = {
  name?: string;
};

type WgerExerciseMuscle = {
  name?: string;
  name_en?: string;
};

type WgerExercise = {
  id?: number;
  category?: WgerExerciseCategory;
  equipment?: WgerExerciseEquipment[];
  muscles?: WgerExerciseMuscle[];
  images?: WgerExerciseImage[];
  translations?: WgerExerciseTranslation[];
};

type WgerExerciseInfoResponse = {
  results?: WgerExercise[];
};

type MealDbMeal = {
  idMeal?: string;
  strMeal?: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  strMealThumb?: string;
  strSource?: string;
  strYoutube?: string;
  [key: string]: string | undefined;
};

type MealDbRandomResponse = {
  meals?: MealDbMeal[];
};

type GeminiDraftResponse = {
  drafts?: Array<{
    title?: string;
    caption?: string;
    image_alt?: string;
  }>;
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

type WorkoutExerciseSummary = {
  id: number;
  title: string;
  description: string;
  category: string | null;
  equipment: string[];
  muscles: string[];
  imageCandidates: string[];
};

export type PostSource = {
  contentType: PostContentType;
  sourceKind: string;
  sourceKey: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourcePayload: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageCreditName: string | null;
  imageCreditUrl: string | null;
  imageSource: string | null;
  promptFacts: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function stripHtml(value: string | null | undefined) {
  return normalizeText(
    value
      ?.replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function shuffleArray<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex] as T;
    next[swapIndex] = current as T;
  }

  return next;
}

function getTopicScore(haystack: string, topicHint: string | null) {
  if (!topicHint) {
    return 0;
  }

  const keywords = topicHint
    .toLowerCase()
    .split(/[^a-zA-Zа-яА-ЯіїєґІЇЄҐ0-9]+/)
    .filter((part) => part.length > 2);

  return keywords.reduce((score, keyword) => {
    return haystack.includes(keyword) ? score + 2 : score;
  }, 0);
}

function extractFirstUrl(value: unknown): string | null {
  if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractFirstUrl(item);

      if (found) {
        return found;
      }
    }
  }

  if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      const found = extractFirstUrl(nested);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function normalizeWorkoutExercise(exercise: WgerExercise) {
  if (typeof exercise.id !== "number") {
    return null;
  }

  const translation =
    exercise.translations?.find(
      (item) =>
        item.language === 2 &&
        normalizeText(item.name) &&
        stripHtml(item.description),
    ) ??
    exercise.translations?.find(
      (item) => normalizeText(item.name) && stripHtml(item.description),
    );

  const title = normalizeText(translation?.name);
  const description = stripHtml(translation?.description);

  if (!title || !description) {
    return null;
  }

  const imageCandidates = (exercise.images ?? [])
    .map((image) => extractFirstUrl(image))
    .filter((value): value is string => Boolean(value));

  return {
    id: exercise.id,
    title,
    description,
    category: normalizeText(exercise.category?.name) || null,
    equipment: (exercise.equipment ?? [])
      .map((item) => normalizeText(item.name))
      .filter(Boolean),
    muscles: (exercise.muscles ?? [])
      .map((item) => normalizeText(item.name_en || item.name))
      .filter(Boolean),
    imageCandidates,
  } satisfies WorkoutExerciseSummary;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function findPexelsPhoto(query: string) {
  const apiKey = process.env.PEXELS_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "large");

  try {
    const data = await fetchJson<PexelsSearchResponse>(url.toString(), {
      headers: {
        Authorization: apiKey,
      },
    });
    const photo = data.photos?.[0];
    const photoUrl =
      photo?.src?.large2x || photo?.src?.large || photo?.src?.medium || null;

    if (!photoUrl) {
      return null;
    }

    return {
      imageUrl: photoUrl,
      imageAlt: normalizeText(photo?.alt) || query,
      imageCreditName: normalizeText(photo?.photographer) || null,
      imageCreditUrl: normalizeText(photo?.photographer_url) || null,
      imageSource: "Pexels",
    };
  } catch {
    return null;
  }
}

function buildWorkoutPromptFacts(exercises: WorkoutExerciseSummary[], topicHint: string | null) {
  return [
    topicHint ? `Topic hint from owner: ${topicHint}` : null,
    "Exercises pulled from WGER:",
    ...exercises.map((exercise, index) =>
      [
        `${index + 1}. ${exercise.title}`,
        exercise.category ? `Category: ${exercise.category}` : null,
        exercise.muscles.length
          ? `Target muscles: ${exercise.muscles.join(", ")}`
          : null,
        exercise.equipment.length
          ? `Equipment: ${exercise.equipment.join(", ")}`
          : "Equipment: bodyweight or not specified",
        `Description: ${exercise.description}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function fetchWorkoutSource(input: {
  topicHint: string | null;
  recentSourceKeys: string[];
}) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const offset = Math.floor(Math.random() * 240);
    const url = new URL("https://wger.de/api/v2/exerciseinfo/");
    url.searchParams.set("language", "2");
    url.searchParams.set("limit", "24");
    url.searchParams.set("offset", String(offset));

    const data = await fetchJson<WgerExerciseInfoResponse>(url.toString());
    const candidates = (data.results ?? [])
      .map(normalizeWorkoutExercise)
      .filter((item): item is WorkoutExerciseSummary => Boolean(item));

    if (candidates.length < 4) {
      continue;
    }

    const ranked = [...candidates].sort((left, right) => {
      const leftScore = getTopicScore(
        [
          left.title,
          left.category,
          left.description,
          left.equipment.join(" "),
          left.muscles.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        input.topicHint,
      );
      const rightScore = getTopicScore(
        [
          right.title,
          right.category,
          right.description,
          right.equipment.join(" "),
          right.muscles.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        input.topicHint,
      );

      return rightScore - leftScore;
    });

    const selected = shuffleArray(ranked.slice(0, 8)).slice(0, 4);
    const sourceKey = `wger:${selected
      .map((exercise) => exercise.id)
      .sort((left, right) => left - right)
      .join("-")}`;

    if (input.recentSourceKeys.includes(sourceKey)) {
      continue;
    }

    const pexelsQuery = [
      input.topicHint,
      selected[0]?.category,
      "fitness workout",
    ]
      .filter(Boolean)
      .join(" ");
    const pexelsPhoto = await findPexelsPhoto(pexelsQuery);
    const fallbackImage = selected
      .flatMap((exercise) => exercise.imageCandidates)
      .find(Boolean);

    return {
      contentType: "workout",
      sourceKind: "wger",
      sourceKey,
      sourceTitle:
        input.topicHint?.trim() || `${selected[0]?.title} + ${selected.length - 1} вправи`,
      sourceUrl: `https://wger.de/api/v2/exerciseinfo/${selected[0]?.id ?? ""}/`,
      sourcePayload: JSON.stringify({
        topicHint: input.topicHint,
        exercises: selected,
      }),
      imageUrl: pexelsPhoto?.imageUrl || fallbackImage || null,
      imageAlt:
        pexelsPhoto?.imageAlt ||
        (input.topicHint?.trim()
          ? `Тренування ${input.topicHint.trim()}`
          : "Фітнес тренування"),
      imageCreditName: pexelsPhoto?.imageCreditName || null,
      imageCreditUrl: pexelsPhoto?.imageCreditUrl || null,
      imageSource: pexelsPhoto?.imageSource || (fallbackImage ? "WGER" : null),
      promptFacts: buildWorkoutPromptFacts(selected, input.topicHint),
    } satisfies PostSource;
  }

  return null;
}

function extractMealIngredients(meal: MealDbMeal) {
  const ingredients: string[] = [];

  for (let index = 1; index <= 20; index += 1) {
    const ingredient = normalizeText(meal[`strIngredient${index}`]);
    const measure = normalizeText(meal[`strMeasure${index}`]);

    if (!ingredient) {
      continue;
    }

    ingredients.push(measure ? `${measure} ${ingredient}`.trim() : ingredient);
  }

  return ingredients;
}

function scoreMealFitnessProfile(meal: MealDbMeal, ingredients: string[]) {
  const category = normalizeText(meal.strCategory).toLowerCase();
  const title = normalizeText(meal.strMeal).toLowerCase();
  const instructions = stripHtml(meal.strInstructions).toLowerCase();
  const haystack = [category, title, instructions, ...ingredients]
    .join(" ")
    .toLowerCase();

  const positiveKeywords = [
    "chicken",
    "turkey",
    "tuna",
    "salmon",
    "cod",
    "prawn",
    "shrimp",
    "egg",
    "eggs",
    "yogurt",
    "greek yogurt",
    "cottage cheese",
    "quark",
    "tofu",
    "broccoli",
    "spinach",
    "asparagus",
    "cucumber",
    "tomato",
    "lettuce",
    "beans",
    "lentil",
    "chickpea",
    "oats",
    "quinoa",
    "rice",
    "vegetable",
    "salad",
  ];
  const negativeKeywords = [
    "bacon",
    "pork",
    "sausage",
    "salami",
    "chorizo",
    "lard",
    "duck",
    "goose",
    "cream",
    "double cream",
    "heavy cream",
    "mayonnaise",
    "mayo",
    "butter",
    "fried",
    "deep fry",
    "fries",
    "pastry",
    "syrup",
    "chocolate",
    "dessert",
    "ice cream",
    "condensed milk",
  ];

  let score = 0;

  for (const keyword of positiveKeywords) {
    if (haystack.includes(keyword)) {
      score += 2;
    }
  }

  for (const keyword of negativeKeywords) {
    if (haystack.includes(keyword)) {
      score -= 4;
    }
  }

  if (category.includes("vegetarian") || category.includes("seafood")) {
    score += 2;
  }

  if (category.includes("dessert") || category.includes("pork")) {
    score -= 5;
  }

  return score;
}

function buildRecipePromptFacts(meal: MealDbMeal, ingredients: string[], topicHint: string | null) {
  return [
    topicHint ? `Topic hint from owner: ${topicHint}` : null,
    "Nutrition direction: prefer lighter, lower-calorie, training-friendly meals with lean protein, vegetables, simple cooking, and without heavy fatty ingredients.",
    `Meal name: ${normalizeText(meal.strMeal)}`,
    normalizeText(meal.strCategory)
      ? `Category: ${normalizeText(meal.strCategory)}`
      : null,
    normalizeText(meal.strArea) ? `Cuisine: ${normalizeText(meal.strArea)}` : null,
    ingredients.length ? `Ingredients:\n- ${ingredients.join("\n- ")}` : null,
    stripHtml(meal.strInstructions)
      ? `Instructions: ${stripHtml(meal.strInstructions).slice(0, 1400)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function fetchRecipeSource(input: {
  topicHint: string | null;
  recentSourceKeys: string[];
}) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const data = await fetchJson<MealDbRandomResponse>(
      "https://www.themealdb.com/api/json/v1/1/random.php",
    );
    const meal = data.meals?.[0];
    const mealId = normalizeText(meal?.idMeal);

    if (!meal || !mealId) {
      continue;
    }

    const sourceKey = `mealdb:${mealId}`;

    if (input.recentSourceKeys.includes(sourceKey)) {
      continue;
    }

    const ingredients = extractMealIngredients(meal);
    const mealName = normalizeText(meal.strMeal);
    const fitnessScore = scoreMealFitnessProfile(meal, ingredients);

    if (
      !mealName ||
      !ingredients.length ||
      !stripHtml(meal.strInstructions) ||
      fitnessScore < 2
    ) {
      continue;
    }

    return {
      contentType: "recipe",
      sourceKind: "themealdb",
      sourceKey,
      sourceTitle: mealName,
      sourceUrl:
        normalizeText(meal.strSource) || normalizeText(meal.strYoutube) || null,
      sourcePayload: JSON.stringify({
        topicHint: input.topicHint,
        idMeal: mealId,
        mealName,
        category: normalizeText(meal.strCategory) || null,
        area: normalizeText(meal.strArea) || null,
        ingredients,
        instructions: stripHtml(meal.strInstructions),
      }),
      imageUrl: normalizeText(meal.strMealThumb) || null,
      imageAlt: mealName,
      imageCreditName: null,
      imageCreditUrl: null,
      imageSource: "TheMealDB",
      promptFacts: buildRecipePromptFacts(meal, ingredients, input.topicHint),
    } satisfies PostSource;
  }

  return null;
}

export function isPostContentType(value: string): value is PostContentType {
  return value === "workout" || value === "recipe";
}

export async function fetchPostSource(input: {
  contentType: PostContentType;
  topicHint: string | null;
  recentSourceKeys: string[];
}) {
  if (input.contentType === "workout") {
    return fetchWorkoutSource(input);
  }

  return fetchRecipeSource(input);
}

function extractJsonText(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  const withoutFence = cleaned.replace(/```$/i, "").trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return withoutFence;
  }

  return withoutFence.slice(firstBrace, lastBrace + 1);
}

function normalizeDraftTitle(value: string) {
  return normalizeText(value).slice(0, 84);
}

function normalizeDraftCaption(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 880);
}

function parseGeminiDrafts(text: string) {
  const parsed = JSON.parse(extractJsonText(text)) as GeminiDraftResponse;
  const drafts = (parsed.drafts ?? [])
    .map((draft) => {
      const title = normalizeDraftTitle(draft.title || "");
      const caption = normalizeDraftCaption(draft.caption || "");

      if (!title || !caption) {
        return null;
      }

      return {
        title,
        caption,
        imageAlt: normalizeText(draft.image_alt) || null,
      } satisfies PostDraftSeed;
    })
    .filter((draft): draft is PostDraftSeed => Boolean(draft))
    .slice(0, 3);

  if (drafts.length !== 3) {
    throw new Error("Gemini did not return exactly three valid drafts");
  }

  return drafts;
}

function buildGenerationPrompt(input: {
  project: WebProject;
  contentType: PostContentType;
  topicHint: string | null;
  source: PostSource;
}) {
  const voiceNotes = normalizeText(input.project.aiInstructions) || "No extra owner notes.";
  const projectSummary =
    normalizeText(input.project.description) ||
    `${input.project.name} is a fitness and wellness project.`;

  return [
    "You create Telegram post drafts for a fitness-focused project.",
    `Project: ${input.project.name}`,
    `Project summary: ${projectSummary}`,
    `Owner notes: ${voiceNotes}`,
    `Requested post type: ${input.contentType}`,
    input.topicHint ? `Topic hint: ${input.topicHint}` : null,
    "",
    "Source facts from external API:",
    input.source.promptFacts,
    "",
    "Return JSON only with this shape:",
    '{ "drafts": [ { "title": "...", "caption": "...", "image_alt": "..." } ] }',
    "",
    "Rules:",
    "- Write in Ukrainian.",
    "- Create exactly 3 distinct draft options for Telegram.",
    "- Make each draft genuinely useful, not generic filler.",
    "- Use only the provided source facts as factual material.",
    "- It is allowed to improve phrasing, structure, CTA, and hook.",
    "- Add a few natural emojis so the post feels alive.",
    "- Avoid repeating the same opening or CTA across drafts.",
    "- Do not mention APIs, JSON, or hidden system details.",
    "- Do not invent medical claims, calorie numbers, macros, or project features that were not provided.",
    "- Keep each title under 80 characters.",
    "- Keep each caption under 850 characters.",
    "- Use plain text only, no markdown tables.",
    input.contentType === "workout"
      ? "- For workout drafts, turn the source into a practical mini-workout with clear structure and rest cues when appropriate."
      : "- For recipe drafts, keep the meal clearly fit-friendly: lighter, simpler, lower-calorie in spirit, with leaner ingredients and no heavy fatty framing.",
    input.contentType === "recipe"
      ? "- If the source feels too heavy, do not glorify indulgence; keep the tone focused on a cleaner, more training-friendly meal."
      : null,
    "- End with a short CTA that fits a Telegram group.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generatePostDrafts(input: {
  project: WebProject;
  contentType: PostContentType;
  topicHint: string | null;
  source: PostSource;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const model =
    input.project.aiModel?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash";
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
                text: buildGenerationPrompt(input),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 1.05,
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

  return parseGeminiDrafts(text);
}
