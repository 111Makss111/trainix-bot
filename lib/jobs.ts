import { createHash, randomUUID } from "crypto";
import { getSql } from "@/lib/neon";
import { sendTelegramTextMessage } from "@/lib/telegram";

export const jobLeadStatuses = [
  "new",
  "reviewed",
  "applied",
  "ignored",
] as const;

export type JobLeadStatus = (typeof jobLeadStatuses)[number];
export type JobLeadSource = "freelancehunt";

export type JobHuntSettings = {
  ownerEmail: string;
  sourceFreelancehuntEnabled: boolean;
  autoScanEnabled: boolean;
  scanIntervalMinutes: number;
  maxLeadsPerRun: number;
  includeKeywordsText: string;
  excludeKeywordsText: string;
  telegramAlertsEnabled: boolean;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobLead = {
  id: string;
  ownerEmail: string;
  source: JobLeadSource;
  sourceLabel: string;
  externalId: string;
  title: string;
  link: string;
  summary: string;
  budgetText: string | null;
  categories: string[];
  publishedAt: string | null;
  score: number;
  matchReason: string;
  proposalText: string | null;
  status: JobLeadStatus;
  alertedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type JobHuntSettingsRow = {
  owner_email: string;
  source_freelancehunt_enabled: boolean;
  auto_scan_enabled: boolean;
  scan_interval_minutes: number;
  max_leads_per_run: number;
  include_keywords_text: string | null;
  exclude_keywords_text: string | null;
  telegram_alerts_enabled: boolean;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  last_scan_at: string | null;
  created_at: string;
  updated_at: string;
};

type JobLeadRow = {
  id: string;
  owner_email: string;
  source: JobLeadSource;
  external_id: string;
  title: string;
  link: string;
  summary: string;
  budget_text: string | null;
  categories_json: string | null;
  published_at: string | null;
  score: number;
  match_reason: string;
  proposal_text: string | null;
  status: JobLeadStatus;
  alerted_at: string | null;
  created_at: string;
  updated_at: string;
};

type FreelancehuntRssItem = {
  source: JobLeadSource;
  sourceLabel: string;
  externalId: string;
  title: string;
  link: string;
  summary: string;
  budgetText: string | null;
  categories: string[];
  publishedAt: string | null;
};

type ScoredFreelancehuntLead = FreelancehuntRssItem & {
  score: number;
  accepted: boolean;
  reasons: string[];
};

type RefreshJobLeadsResult = {
  scanned: number;
  accepted: number;
  created: number;
  alerted: number;
  settings: JobHuntSettings;
  leads: JobLead[];
};

const FREELANCEHUNT_RSS_URL = "https://freelancehunt.com/projects.rss";
const DEFAULT_INCLUDE_KEYWORDS = [
  "верстка",
  "landing",
  "лендинг",
  "сайт візитка",
  "сайт-візитка",
  "html",
  "css",
  "frontend",
  "front-end",
  "react",
  "next.js",
  "адаптив",
  "figma",
  "pixel perfect",
  "tailwind",
];
const DEFAULT_EXCLUDE_KEYWORDS = [
  "senior",
  "full stack",
  "full-stack",
  "backend",
  "laravel",
  "python",
  "wordpress support",
  "seo",
  "marketing",
  "team lead",
  "agency",
  "mobile app",
  "unity",
  "android",
  "ios",
];

let jobsTablesPromise:
  | Promise<Awaited<ReturnType<typeof ensureJobsTablesInner>>>
  | null = null;

function mapJobHuntSettings(row: JobHuntSettingsRow): JobHuntSettings {
  return {
    ownerEmail: row.owner_email,
    sourceFreelancehuntEnabled: row.source_freelancehunt_enabled,
    autoScanEnabled: row.auto_scan_enabled,
    scanIntervalMinutes: row.scan_interval_minutes,
    maxLeadsPerRun: row.max_leads_per_run,
    includeKeywordsText:
      row.include_keywords_text?.trim() || DEFAULT_INCLUDE_KEYWORDS.join("\n"),
    excludeKeywordsText:
      row.exclude_keywords_text?.trim() || DEFAULT_EXCLUDE_KEYWORDS.join("\n"),
    telegramAlertsEnabled: row.telegram_alerts_enabled,
    telegramBotToken: row.telegram_bot_token,
    telegramChatId: row.telegram_chat_id,
    lastScanAt: row.last_scan_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function defaultJobHuntSettings(ownerEmail: string): JobHuntSettings {
  const now = new Date().toISOString();

  return {
    ownerEmail,
    sourceFreelancehuntEnabled: true,
    autoScanEnabled: false,
    scanIntervalMinutes: 5,
    maxLeadsPerRun: 8,
    includeKeywordsText: DEFAULT_INCLUDE_KEYWORDS.join("\n"),
    excludeKeywordsText: DEFAULT_EXCLUDE_KEYWORDS.join("\n"),
    telegramAlertsEnabled: false,
    telegramBotToken: null,
    telegramChatId: null,
    lastScanAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function mapJobLead(row: JobLeadRow): JobLead {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    source: row.source,
    sourceLabel: row.source === "freelancehunt" ? "Freelancehunt" : row.source,
    externalId: row.external_id,
    title: row.title,
    link: row.link,
    summary: row.summary,
    budgetText: row.budget_text,
    categories: row.categories_json ? (JSON.parse(row.categories_json) as string[]) : [],
    publishedAt: row.published_at,
    score: row.score,
    matchReason: row.match_reason,
    proposalText: row.proposal_text,
    status: row.status,
    alertedAt: row.alerted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTextarea(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function parseKeywordList(value: string) {
  return normalizeTextarea(value)
    .split("\n")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCharCode(Number.parseInt(code, 10)),
    );
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function getFirstTagValue(block: string, tagName: string) {
  const cdataMatch = block.match(
    new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, "i"),
  );

  if (cdataMatch?.[1]) {
    return cdataMatch[1].trim();
  }

  const plainMatch = block.match(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"),
  );

  return plainMatch?.[1]?.trim() ?? null;
}

function getAllTagValues(block: string, tagName: string) {
  const matches = block.matchAll(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi"),
  );

  return [...matches]
    .map((match) => stripHtml(match[1] || ""))
    .filter(Boolean);
}

function extractBudgetText(summary: string) {
  const budgetMatch = summary.match(
    /(\d[\d\s.,]*\s?(?:usd|eur|uah|\$|€|грн|₴))/i,
  );

  return budgetMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function parseFreelancehuntRss(xml: string) {
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches
    .map((item): FreelancehuntRssItem | null => {
      const title = stripHtml(getFirstTagValue(item, "title") ?? "");
      const link = stripHtml(getFirstTagValue(item, "link") ?? "");
      const description = getFirstTagValue(item, "description") ?? "";
      const summary = stripHtml(description).slice(0, 1200);
      const categories = getAllTagValues(item, "category");
      const publishedAtRaw = getFirstTagValue(item, "pubDate");
      const publishedAt = publishedAtRaw
        ? new Date(publishedAtRaw).toISOString()
        : null;

      if (!title || !link || !summary) {
        return null;
      }

      return {
        source: "freelancehunt",
        sourceLabel: "Freelancehunt RSS",
        externalId: createHash("sha1").update(link).digest("hex"),
        title,
        link,
        summary,
        budgetText: extractBudgetText(summary),
        categories,
        publishedAt,
      };
    })
    .filter((item): item is FreelancehuntRssItem => Boolean(item));
}

function scoreFreelancehuntLead(input: {
  item: FreelancehuntRssItem;
  settings: JobHuntSettings;
}) {
  const haystack = [
    input.item.title,
    input.item.summary,
    input.item.categories.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  const includeKeywords = parseKeywordList(input.settings.includeKeywordsText);
  const excludeKeywords = parseKeywordList(input.settings.excludeKeywordsText);
  const reasons: string[] = [];
  let score = 10;
  let hardReject = false;

  const weightedMatches: Array<[string, number, string]> = [
    ["верстк", 18, "Є явний запит на верстку"],
    ["html", 14, "Є HTML у вимогах"],
    ["css", 14, "Є CSS у вимогах"],
    ["react", 16, "Є React у стеку"],
    ["landing", 20, "Схоже на landing або невеликий сайт"],
    ["лендинг", 20, "Схоже на landing або невеликий сайт"],
    ["візитк", 20, "Схоже на сайт-візитку"],
    ["адаптив", 12, "Є адаптивна частина"],
    ["figma", 8, "Є Figma-макет"],
    ["frontend", 14, "Це front-end задача"],
    ["front-end", 14, "Це front-end задача"],
    ["next", 10, "Підходить під твій стек"],
    ["tailwind", 8, "Є знайомий UI-стек"],
  ];

  for (const [token, weight, reason] of weightedMatches) {
    if (haystack.includes(token)) {
      score += weight;
      reasons.push(reason);
    }
  }

  for (const keyword of includeKeywords) {
    if (haystack.includes(keyword)) {
      score += 14;
      reasons.push(`Знайдено потрібний сигнал: ${keyword}`);
    }
  }

  for (const keyword of excludeKeywords) {
    if (haystack.includes(keyword)) {
      score -= 28;
      reasons.push(`Є небажаний сигнал: ${keyword}`);
    }
  }

  const hardRejectTokens = [
    "senior",
    "full-time",
    "team lead",
    "agency",
    "android",
    "ios",
    "unity",
    "devops",
  ];

  for (const token of hardRejectTokens) {
    if (haystack.includes(token)) {
      hardReject = true;
      reasons.push(`Виглядає не як швидка задача: ${token}`);
    }
  }

  if (input.item.title.length < 90) {
    score += 4;
  }

  if (input.item.summary.length < 700) {
    score += 6;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    ...input.item,
    score,
    accepted: !hardReject && score >= 52,
    reasons: reasons.slice(0, 5),
  } satisfies ScoredFreelancehuntLead;
}

function buildFallbackProposal(lead: ScoredFreelancehuntLead) {
  const shortSummary = lead.summary.split(".").slice(0, 2).join(". ").trim();

  return [
    "Вітаю!",
    `Зацікавив ваш проєкт «${lead.title}».`,
    "Я можу швидко включитись у роботу й спокійно закрити саме front-end частину без зайвого затягування.",
    shortSummary ? `З того, що бачу по опису: ${shortSummary}.` : null,
    "Можу одразу оцінити обсяг, уточнити деталі й почати з найближчого вільного часу.",
    "Якщо зручно, можу коротко написати план реалізації та орієнтир по термінах.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function generateProposalForLead(lead: ScoredFreelancehuntLead) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return buildFallbackProposal(lead);
  }

  try {
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const prompt = [
      "You write short first-contact freelance proposals.",
      "Write in Ukrainian.",
      "Do not sound desperate or generic.",
      "Do not invent years of experience or fake portfolio items.",
      "Sound like a calm, capable front-end developer who can start quickly.",
      "Keep it between 550 and 850 characters.",
      "Focus on clarity, speed, and relevance.",
      "",
      `Project title: ${lead.title}`,
      `Project summary: ${lead.summary}`,
      lead.budgetText ? `Budget mention: ${lead.budgetText}` : null,
      lead.categories.length
        ? `Categories: ${lead.categories.join(", ")}`
        : null,
      `Why it matched: ${lead.reasons.join("; ")}`,
      "",
      "Return plain text only.",
    ]
      .filter(Boolean)
      .join("\n");

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
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 700,
          },
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return buildFallbackProposal(lead);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    return text || buildFallbackProposal(lead);
  } catch {
    return buildFallbackProposal(lead);
  }
}

async function fetchFreelancehuntLeads() {
  const response = await fetch(FREELANCEHUNT_RSS_URL, {
    cache: "no-store",
    headers: {
      "User-Agent": "Trainix Jobs Radar/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error("Не вдалося завантажити Freelancehunt RSS.");
  }

  const xml = await response.text();
  return parseFreelancehuntRss(xml);
}

async function ensureJobsTablesInner() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS job_hunt_settings (
      owner_email TEXT PRIMARY KEY,
      source_freelancehunt_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      auto_scan_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      scan_interval_minutes INTEGER NOT NULL DEFAULT 5,
      max_leads_per_run INTEGER NOT NULL DEFAULT 8,
      include_keywords_text TEXT,
      exclude_keywords_text TEXT,
      telegram_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      telegram_bot_token TEXT,
      telegram_chat_id TEXT,
      last_scan_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS job_leads (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      source TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      summary TEXT NOT NULL,
      budget_text TEXT,
      categories_json TEXT,
      published_at TIMESTAMPTZ,
      score INTEGER NOT NULL DEFAULT 0,
      match_reason TEXT NOT NULL,
      proposal_text TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      alerted_at TIMESTAMPTZ,
      source_payload TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (owner_email, source, link)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_job_leads_owner_status_created
    ON job_leads (owner_email, status, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_job_leads_owner_source_published
    ON job_leads (owner_email, source, published_at DESC)
  `;

  return sql;
}

async function ensureJobsTables() {
  if (!jobsTablesPromise) {
    jobsTablesPromise = ensureJobsTablesInner().catch((error) => {
      jobsTablesPromise = null;
      throw error;
    });
  }

  return jobsTablesPromise;
}

export async function getJobHuntSettings(ownerEmail: string) {
  const sql = await ensureJobsTables();

  if (!sql) {
    return defaultJobHuntSettings(ownerEmail);
  }

  const rows = (await sql`
    SELECT
      owner_email,
      source_freelancehunt_enabled,
      auto_scan_enabled,
      scan_interval_minutes,
      max_leads_per_run,
      include_keywords_text,
      exclude_keywords_text,
      telegram_alerts_enabled,
      telegram_bot_token,
      telegram_chat_id,
      last_scan_at,
      created_at,
      updated_at
    FROM job_hunt_settings
    WHERE owner_email = ${ownerEmail}
    LIMIT 1
  `) as JobHuntSettingsRow[];

  return rows[0] ? mapJobHuntSettings(rows[0]) : defaultJobHuntSettings(ownerEmail);
}

export async function saveJobHuntSettings(input: {
  ownerEmail: string;
  sourceFreelancehuntEnabled: boolean;
  autoScanEnabled: boolean;
  scanIntervalMinutes: number;
  maxLeadsPerRun: number;
  includeKeywordsText: string;
  excludeKeywordsText: string;
  telegramAlertsEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
}) {
  const sql = await ensureJobsTables();

  if (!sql) {
    return defaultJobHuntSettings(input.ownerEmail);
  }

  const rows = (await sql`
    INSERT INTO job_hunt_settings (
      owner_email,
      source_freelancehunt_enabled,
      auto_scan_enabled,
      scan_interval_minutes,
      max_leads_per_run,
      include_keywords_text,
      exclude_keywords_text,
      telegram_alerts_enabled,
      telegram_bot_token,
      telegram_chat_id
    )
    VALUES (
      ${input.ownerEmail},
      ${input.sourceFreelancehuntEnabled},
      ${input.autoScanEnabled},
      ${Math.max(1, Math.min(60, Math.floor(input.scanIntervalMinutes)))},
      ${Math.max(1, Math.min(20, Math.floor(input.maxLeadsPerRun)))},
      ${normalizeTextarea(input.includeKeywordsText) || DEFAULT_INCLUDE_KEYWORDS.join("\n")},
      ${normalizeTextarea(input.excludeKeywordsText) || DEFAULT_EXCLUDE_KEYWORDS.join("\n")},
      ${input.telegramAlertsEnabled},
      ${input.telegramBotToken.trim() || null},
      ${input.telegramChatId.trim() || null}
    )
    ON CONFLICT (owner_email)
    DO UPDATE SET
      source_freelancehunt_enabled = EXCLUDED.source_freelancehunt_enabled,
      auto_scan_enabled = EXCLUDED.auto_scan_enabled,
      scan_interval_minutes = EXCLUDED.scan_interval_minutes,
      max_leads_per_run = EXCLUDED.max_leads_per_run,
      include_keywords_text = EXCLUDED.include_keywords_text,
      exclude_keywords_text = EXCLUDED.exclude_keywords_text,
      telegram_alerts_enabled = EXCLUDED.telegram_alerts_enabled,
      telegram_bot_token = EXCLUDED.telegram_bot_token,
      telegram_chat_id = EXCLUDED.telegram_chat_id,
      updated_at = NOW()
    RETURNING
      owner_email,
      source_freelancehunt_enabled,
      auto_scan_enabled,
      scan_interval_minutes,
      max_leads_per_run,
      include_keywords_text,
      exclude_keywords_text,
      telegram_alerts_enabled,
      telegram_bot_token,
      telegram_chat_id,
      last_scan_at,
      created_at,
      updated_at
  `) as JobHuntSettingsRow[];

  return mapJobHuntSettings(rows[0]);
}

export async function listJobLeads(ownerEmail: string, limit = 40) {
  const sql = await ensureJobsTables();

  if (!sql) {
    return [] as JobLead[];
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      source,
      external_id,
      title,
      link,
      summary,
      budget_text,
      categories_json,
      published_at,
      score,
      match_reason,
      proposal_text,
      status,
      alerted_at,
      created_at,
      updated_at
    FROM job_leads
    WHERE owner_email = ${ownerEmail}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as JobLeadRow[];

  return rows.map(mapJobLead);
}

async function setLastScanAt(ownerEmail: string) {
  const sql = await ensureJobsTables();

  if (!sql) {
    return;
  }

  await sql`
    INSERT INTO job_hunt_settings (owner_email, last_scan_at)
    VALUES (${ownerEmail}, NOW())
    ON CONFLICT (owner_email)
    DO UPDATE SET
      last_scan_at = NOW(),
      updated_at = NOW()
  `;
}

async function maybeSendTelegramLeadAlert(
  settings: JobHuntSettings,
  leads: JobLead[],
) {
  if (
    !settings.telegramAlertsEnabled ||
    !settings.telegramBotToken ||
    !settings.telegramChatId ||
    !leads.length
  ) {
    return 0;
  }

  const lines = [
    "Jobs radar знайшов нові задачі:",
    "",
    ...leads.slice(0, 3).flatMap((lead) => [
      `• ${lead.title}`,
      `  Score: ${lead.score}/100`,
      `  ${lead.link}`,
      "",
    ]),
  ];

  try {
    await sendTelegramTextMessage({
      botToken: settings.telegramBotToken,
      chatId: settings.telegramChatId,
      text: lines.join("\n").trim(),
    });

    const sql = await ensureJobsTables();

    if (sql) {
      await sql`
        UPDATE job_leads
        SET alerted_at = NOW(), updated_at = NOW()
        WHERE id = ANY(${leads.map((lead) => lead.id)})
      `;
    }

    return 1;
  } catch {
    return 0;
  }
}

export async function refreshJobLeadsForOwner(ownerEmail: string) {
  const sql = await ensureJobsTables();
  const settings = await getJobHuntSettings(ownerEmail);

  if (!sql) {
    return {
      scanned: 0,
      accepted: 0,
      created: 0,
      alerted: 0,
      settings,
      leads: [] as JobLead[],
    } satisfies RefreshJobLeadsResult;
  }

  if (!settings.sourceFreelancehuntEnabled) {
    await setLastScanAt(ownerEmail);
    return {
      scanned: 0,
      accepted: 0,
      created: 0,
      alerted: 0,
      settings: await getJobHuntSettings(ownerEmail),
      leads: await listJobLeads(ownerEmail),
    } satisfies RefreshJobLeadsResult;
  }

  const rssItems = await fetchFreelancehuntLeads();
  const scored = rssItems
    .map((item) => scoreFreelancehuntLead({ item, settings }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.publishedAt || 0).getTime() -
        new Date(left.publishedAt || 0).getTime()
      );
    });

  const accepted = scored
    .filter((lead) => lead.accepted)
    .slice(0, settings.maxLeadsPerRun);

  const acceptedLinks = accepted.map((lead) => lead.link);
  const existing = acceptedLinks.length
    ? ((await sql`
        SELECT link
        FROM job_leads
        WHERE owner_email = ${ownerEmail}
          AND source = 'freelancehunt'
          AND link = ANY(${acceptedLinks})
      `) as Array<{ link: string }>)
    : [];

  const existingLinks = new Set(existing.map((row) => row.link));
  const insertedLeads: JobLead[] = [];

  for (const lead of accepted) {
    if (existingLinks.has(lead.link)) {
      continue;
    }

    const proposalText = await generateProposalForLead(lead);
    const rows = (await sql`
      INSERT INTO job_leads (
        id,
        owner_email,
        source,
        external_id,
        title,
        link,
        summary,
        budget_text,
        categories_json,
        published_at,
        score,
        match_reason,
        proposal_text,
        status,
        source_payload
      )
      VALUES (
        ${randomUUID()},
        ${ownerEmail},
        ${lead.source},
        ${lead.externalId},
        ${lead.title},
        ${lead.link},
        ${lead.summary},
        ${lead.budgetText},
        ${JSON.stringify(lead.categories)},
        ${lead.publishedAt},
        ${lead.score},
        ${lead.reasons.join(" · ") || "Базовий match по фільтрах"},
        ${proposalText},
        'new',
        ${JSON.stringify(lead)}
      )
      RETURNING
        id,
        owner_email,
        source,
        external_id,
        title,
        link,
        summary,
        budget_text,
        categories_json,
        published_at,
        score,
        match_reason,
        proposal_text,
        status,
        alerted_at,
        created_at,
        updated_at
    `) as JobLeadRow[];

    if (rows[0]) {
      insertedLeads.push(mapJobLead(rows[0]));
    }
  }

  await setLastScanAt(ownerEmail);
  const alerted = await maybeSendTelegramLeadAlert(settings, insertedLeads);

  return {
    scanned: rssItems.length,
    accepted: accepted.length,
    created: insertedLeads.length,
    alerted,
    settings: await getJobHuntSettings(ownerEmail),
    leads: await listJobLeads(ownerEmail),
  } satisfies RefreshJobLeadsResult;
}

export async function updateJobLeadStatus(input: {
  ownerEmail: string;
  leadId: string;
  status: JobLeadStatus;
}) {
  const sql = await ensureJobsTables();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    UPDATE job_leads
    SET status = ${input.status}, updated_at = NOW()
    WHERE id = ${input.leadId}
      AND owner_email = ${input.ownerEmail}
    RETURNING
      id,
      owner_email,
      source,
      external_id,
      title,
      link,
      summary,
      budget_text,
      categories_json,
      published_at,
      score,
      match_reason,
      proposal_text,
      status,
      alerted_at,
      created_at,
      updated_at
  `) as JobLeadRow[];

  return rows[0] ? mapJobLead(rows[0]) : null;
}

export async function regenerateJobLeadProposal(input: {
  ownerEmail: string;
  leadId: string;
}) {
  const sql = await ensureJobsTables();

  if (!sql) {
    return null;
  }

  const rows = (await sql`
    SELECT
      id,
      owner_email,
      source,
      external_id,
      title,
      link,
      summary,
      budget_text,
      categories_json,
      published_at,
      score,
      match_reason,
      proposal_text,
      status,
      alerted_at,
      created_at,
      updated_at
    FROM job_leads
    WHERE id = ${input.leadId}
      AND owner_email = ${input.ownerEmail}
    LIMIT 1
  `) as JobLeadRow[];

  if (!rows[0]) {
    return null;
  }

  const currentLead = mapJobLead(rows[0]);
  const proposalText = await generateProposalForLead({
    source: currentLead.source,
    sourceLabel: currentLead.sourceLabel,
    externalId: currentLead.externalId,
    title: currentLead.title,
    link: currentLead.link,
    summary: currentLead.summary,
    budgetText: currentLead.budgetText,
    categories: currentLead.categories,
    publishedAt: currentLead.publishedAt,
    score: currentLead.score,
    accepted: true,
    reasons: currentLead.matchReason.split(" · ").filter(Boolean),
  });

  const updatedRows = (await sql`
    UPDATE job_leads
    SET proposal_text = ${proposalText}, updated_at = NOW()
    WHERE id = ${input.leadId}
      AND owner_email = ${input.ownerEmail}
    RETURNING
      id,
      owner_email,
      source,
      external_id,
      title,
      link,
      summary,
      budget_text,
      categories_json,
      published_at,
      score,
      match_reason,
      proposal_text,
      status,
      alerted_at,
      created_at,
      updated_at
  `) as JobLeadRow[];

  return updatedRows[0] ? mapJobLead(updatedRows[0]) : null;
}

export async function listDueJobScanOwners() {
  const sql = await ensureJobsTables();

  if (!sql) {
    return [] as JobHuntSettings[];
  }

  const rows = (await sql`
    SELECT
      owner_email,
      source_freelancehunt_enabled,
      auto_scan_enabled,
      scan_interval_minutes,
      max_leads_per_run,
      include_keywords_text,
      exclude_keywords_text,
      telegram_alerts_enabled,
      telegram_bot_token,
      telegram_chat_id,
      last_scan_at,
      created_at,
      updated_at
    FROM job_hunt_settings
    WHERE auto_scan_enabled = TRUE
      AND (
        last_scan_at IS NULL
        OR last_scan_at <= NOW() - (scan_interval_minutes * INTERVAL '1 minute')
      )
    ORDER BY updated_at DESC
  `) as JobHuntSettingsRow[];

  return rows.map(mapJobHuntSettings);
}

export async function refreshDueJobScans() {
  const owners = await listDueJobScanOwners();
  const results: Array<{ ownerEmail: string; created: number; alerted: number }> = [];

  for (const owner of owners) {
    const result = await refreshJobLeadsForOwner(owner.ownerEmail);
    results.push({
      ownerEmail: owner.ownerEmail,
      created: result.created,
      alerted: result.alerted,
    });
  }

  return results;
}
