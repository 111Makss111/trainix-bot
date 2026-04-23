import { createHash, randomUUID } from "crypto";
import { getSql } from "@/lib/neon";
import { sendTelegramTextMessage } from "@/lib/telegram";

export const jobLeadStatuses = [
  "new",
  "reviewed",
  "applied",
  "ignored",
  "hidden",
] as const;

export type JobLeadStatus = (typeof jobLeadStatuses)[number];
export type JobLeadSource = "freelancehunt" | "freelancer" | "weworkremotely";

export type JobHuntSettings = {
  ownerEmail: string;
  sourceFreelancehuntEnabled: boolean;
  sourceFreelancerEnabled: boolean;
  sourceWeworkremotelyEnabled: boolean;
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
  source_freelancer_enabled: boolean;
  source_weworkremotely_enabled: boolean;
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

type JobFeedItem = {
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

type ScoredJobLead = JobFeedItem & {
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
const FREELANCER_ACTIVE_PROJECTS_URL =
  "https://www.freelancer.com/api/projects/0.1/projects/active/";
const WEWORKREMOTELY_FRONTEND_RSS_URL =
  "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss";

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

function createDeterministicIndex(seed: string, length: number) {
  if (length <= 0) {
    return 0;
  }

  const digest = createHash("sha1").update(seed).digest("hex");
  const numeric = Number.parseInt(digest.slice(0, 8), 16);

  return numeric % length;
}

function mapJobHuntSettings(row: JobHuntSettingsRow): JobHuntSettings {
  return {
    ownerEmail: row.owner_email,
    sourceFreelancehuntEnabled: row.source_freelancehunt_enabled,
    sourceFreelancerEnabled: row.source_freelancer_enabled,
    sourceWeworkremotelyEnabled: row.source_weworkremotely_enabled,
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
    sourceFreelancerEnabled: true,
    sourceWeworkremotelyEnabled: false,
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
  const sourceLabelBySource: Record<JobLeadSource, string> = {
    freelancehunt: "Freelancehunt",
    freelancer: "Freelancer.com",
    weworkremotely: "We Work Remotely",
  };

  return {
    id: row.id,
    ownerEmail: row.owner_email,
    source: row.source,
    sourceLabel: sourceLabelBySource[row.source] ?? row.source,
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

function parseRssFeed(input: {
  xml: string;
  source: JobLeadSource;
  sourceLabel: string;
}) {
  const { xml, source, sourceLabel } = input;
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches
    .map((item): JobFeedItem | null => {
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
        source,
        sourceLabel,
        externalId: createHash("sha1").update(link).digest("hex"),
        title,
        link,
        summary,
        budgetText: extractBudgetText(summary),
        categories,
        publishedAt,
      };
    })
    .filter((item): item is JobFeedItem => Boolean(item));
}

function parseFreelancehuntRss(xml: string) {
  return parseRssFeed({
    xml,
    source: "freelancehunt",
    sourceLabel: "Freelancehunt RSS",
  });
}

function parseWeWorkRemotelyRss(xml: string) {
  return parseRssFeed({
    xml,
    source: "weworkremotely",
    sourceLabel: "We Work Remotely RSS",
  });
}

function scoreJobLead(input: {
  item: JobFeedItem;
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
  } satisfies ScoredJobLead;
}

function chooseVariant(seed: string, salt: string, variants: string[]) {
  return variants[createDeterministicIndex(`${seed}:${salt}`, variants.length)];
}

function inferProposalAngle(lead: ScoredJobLead) {
  const haystack = [
    lead.title,
    lead.summary,
    lead.categories.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const seed = `${lead.externalId}:${lead.title}`;

  if (
    haystack.includes("kindle") ||
    haystack.includes("ebook") ||
    haystack.includes("e-book") ||
    haystack.includes("epub") ||
    haystack.includes("mobi") ||
    haystack.includes("formatting")
  ) {
    return {
      observation: chooseVariant(seed, "ebook-observation", [
        "У задачах з Kindle проблема майже завжди не в одному “кривому абзаці”, а в тому, як поводяться стилі, відступи, зміст і переломи блоків на різних рідерах.",
        "У форматуванні для Kindle дрібниць немає: якщо не добити стилі, chapter breaks, TOC або вкладені елементи, книга швидко починає виглядати непрофесійно вже на першому перегляді.",
        "Такі задачі виглядають простими тільки зверху, але в EPUB/Kindle саме деталізація вирішує, чи текст буде читабельним, чи все “поїде” після експорту.",
      ]),
      execution: chooseVariant(seed, "ebook-execution", [
        "Я б спочатку пройшовся по структурі файлу, стилях і проблемних місцях рендера, а вже потім довів би форматування до стабільного вигляду на реальному Kindle-потоці, а не лише “щоб відкривалось”.",
        "Мій підхід тут був би простий: знайти, що саме ламає верстку або навігацію, нормалізувати стилі і привести файл до передбачуваної поведінки на пристроях, а не просто поправити один симптом.",
        "Я б дивився на це як на задачу по сумісності: спочатку локалізувати, де пливе структура, потім стабілізувати formatting так, щоб книга виглядала акуратно і не ламалась після чергового експорту.",
      ]),
      question: chooseVariant(seed, "ebook-question", [
        "Що саме зараз ламається найбільше: зміст, відступи, переноси розділів, стилі заголовків чи поведінка на конкретному Kindle-пристрої?",
        "У вас уже є готовий `.epub/.mobi`, який треба виправити, чи ще можна втрутитись у вихідний файл і спростити проблему на рівні структури?",
        "Потрібно довести до ладу лише візуальне форматування, чи ще й перевірити навігацію, chapter breaks і коректність відображення на різних рідерах?",
      ]),
    };
  }

  if (
    haystack.includes("wordpress") &&
    (haystack.includes("layout issue") ||
      haystack.includes("layout issues") ||
      haystack.includes("repair") ||
      haystack.includes("fix") ||
      haystack.includes("broken") ||
      haystack.includes("bug"))
  ) {
    return {
      observation: chooseVariant(seed, "wp-fix-observation", [
        "Коли у WordPress пливе layout, причина часто сидить не в одному CSS-рядку, а в конфлікті теми, плагіна або невдалих кастомних правках, які ланцюжком ламають сторінку.",
        "Такі WordPress-задачі зазвичай потребують не “підмалювати блок”, а швидко відрізати джерело поломки: тема, плагін, responsive-breakpoints чи перевантажені overrides.",
        "По задачах на repair layout issues важливо не просто підправити екран, а зрозуміти, чому верстка зламалась, щоб це не повернулося після наступного оновлення.",
      ]),
      execution: chooseVariant(seed, "wp-fix-execution", [
        "Я б пішов від діагностики: локалізував, що саме ламає структуру, акуратно прибрав конфлікт і вже після цього зібрав би стабільний вигляд на desktop і mobile.",
        "Мій підхід тут був би через швидкий аудит шаблону, плагінів і кастомних стилів, щоб виправлення було не косметичним, а нормальним робочим рішенням.",
        "Я б почав не з хаотичних правок, а з чіткого пошуку джерела поломки, після чого вже довів би layout до чистого стану без накопичення нового технічного сміття.",
      ]),
      question: chooseVariant(seed, "wp-fix-question", [
        "Проблема зараз локальна на одній сторінці, чи layout “поїхав” ширше по сайту після оновлення теми/плагіна?",
        "Чи вже зрозуміло, після чого саме все зламалось: апдейт, новий плагін, кастомний код або зміни в темі?",
        "Вам потрібен просто швидкий repair конкретних блоків чи ще й коротка діагностика, щоб подібна проблема не повторилась далі?",
      ]),
    };
  }

  if (
    haystack.includes("woocommerce") ||
    ((haystack.includes("ecommerce") || haystack.includes("e-commerce")) &&
      haystack.includes("wordpress"))
  ) {
    return {
      observation: chooseVariant(seed, "woo-observation", [
        "У WooCommerce-проєктах важливо не тільки зібрати красиву вітрину, а провести людину від першого екрану до картки товару й покупки без тертя, особливо з телефона.",
        "Для eCommerce тут ключове не просто “посадити дизайн”, а зробити так, щоб каталог, картки товарів і шлях до checkout виглядали довірливо й не розсипались на мобільному.",
        "У магазині такого типу вирішує не тільки верстка, а те, наскільки переконливо подані товари, чи не губиться людина в каталозі і як працює вся воронка до покупки.",
      ]),
      execution: chooseVariant(seed, "woo-execution", [
        "Я б дивився на це як на збірку storefront: структура каталогу, картки товарів, акценти довіри, мобільний UX і вже потім доведення до чистого production-стану.",
        "Почав би з ключових комерційних точок: головний екран, навігація по товарах, product page і базова логіка WooCommerce, щоб сайт не тільки виглядав красиво, а реально продавав.",
        "Я б зібрав це так, щоб магазин виглядав цілісно вже з першої версії: без випадкової верстки, з нормальним ритмом сторінки, читабельними картками й адекватною mobile-поведінкою.",
      ]),
      question: chooseVariant(seed, "woo-question", [
        "У вас уже є готовий дизайн і структура каталогу, чи ще треба допомогти з тим, як краще подати товари й зібрати шлях до покупки?",
        "Зараз пріоритет у візуальній частині storefront, чи ще потрібно одразу продумати WooCommerce-логіку: картки товару, фільтри, checkout і mobile UX?",
        "Що для вас критичніше на старті: швидко запустити сильну вітрину чи відразу детально довести весь магазин разом із WooCommerce-потоком?",
      ]),
    };
  }

  if (
    haystack.includes("shopify") &&
    (haystack.includes("landing") || haystack.includes("storefront"))
  ) {
    return {
      observation: chooseVariant(seed, "shopify-observation", [
        "Landing під Shopify має не просто виглядати охайно, а одразу працювати на продаж: офер, ритм блоків, довіра і нормальна поведінка на мобільних тут критичні.",
        "У Shopify storefront головне не лише “посадити дизайн”, а побудувати сторінку так, щоб вона тримала увагу, підводила до товару і не розсипалась у реальному використанні.",
        "Тут цінність саме в комбінації дизайну й конверсії: сильний перший екран, логічні секції, clean mobile-flow і адекватна реалізація всередині Shopify.",
      ]),
      execution: chooseVariant(seed, "shopify-execution", [
        "Я б почав із каркасу landing: перший екран, блоки довіри, продуктові акценти, адаптив, а вже потім довів би це до чистого Shopify-стану без візуального шуму.",
        "Мій підхід тут був би через структуру і конверсію: спочатку зібрати сторінку так, щоб вона продавала, а не просто гарно виглядала в макеті, і вже після цього шліфувати деталі.",
        "Я б збирав це як сильний storefront-екран: чиста секційна логіка, нормальний mobile UX і реалізація, яку не доведеться переробляти після першого запуску.",
      ]),
      question: chooseVariant(seed, "shopify-question", [
        "Чи є вже готовий макет/референс і чи потрібна саме секційна реалізація всередині Shopify, чи можна зібрати окремим кастомним шаблоном?",
        "Це має бути один сильний landing для запуску магазину, чи далі відразу потрібна основа під ширший storefront із кількома ключовими сторінками?",
        "Вам зараз важливіше швидко зібрати красивий launch-ready landing, чи одразу продумати реалізацію так, щоб її легко було масштабувати в межах Shopify?",
      ]),
    };
  }

  if (
    haystack.includes("journal") ||
    haystack.includes("author") ||
    haystack.includes("admin review") ||
    haystack.includes("publish workflow")
  ) {
    return {
      observation: chooseVariant(seed, "workflow-observation", [
        "У таких системах головне не просто намалювати admin-панель, а правильно зібрати сам процес: хто що створює, хто перевіряє, що стає платним, а що публікується без плутанини в статусах.",
        "Тут цінність не в окремих екранах, а в тому, наскільки чисто буде побудований workflow між ролями, review, approval і публікацією.",
        "Подібні проєкти часто ламаються не по UI, а по логіці переходів, коли статуси й ролі погано продумані. Саме це тут і варто зібрати акуратно з самого старту.",
      ]),
      execution: chooseVariant(seed, "workflow-execution", [
        "Я б спочатку розклав це на ролі, статуси та переходи, а вже потім будував інтерфейси, щоб система реально підтримувала редакційний процес, а не лише гарно виглядала.",
        "Мій підхід тут був би через схему workflow: author → review → approve → free/paid → publish, щоб на рівні UI вже не було хаосу й подвійного трактування станів.",
        "Я б почав із логіки процесу й моделі станів, після чого вже збирав би інтерфейси так, щоб кожна роль бачила саме свої потрібні дії без перевантаження.",
      ]),
      question: chooseVariant(seed, "workflow-question", [
        "Чи вже зафіксовані ролі, статуси та правила переходів між review, approval, paid/free і publish, чи це ще треба допомогти структурувати?",
        "У вас уже є схема доступів і логіка модерації, чи зараз саме це ще треба розкласти, щоб не ускладнювати реалізацію далі?",
        "Пріоритет зараз у побудові самого workflow, чи потрібно ще одразу продумати й admin/UI-шар для щоденної роботи з матеріалами?",
      ]),
    };
  }

  if (haystack.includes("next.js") || haystack.includes("nextjs")) {
    return {
      observation: chooseVariant(seed, "next-observation", [
        "У Next.js задачах сильна реалізація починається не з окремого екрана, а з того, наскільки чисто зібрані компоненти, стани й сама структура сторінки під подальший розвиток.",
        "Тут важливо не лише “зробити інтерфейс”, а закласти нормальну основу під Next.js, щоб після першої ітерації не довелося переробляти половину дерева компонентів.",
        "По таких задачах одразу видно різницю між швидкою латкою і продуманою реалізацією: структура, reusable components, поведінка станів і clean rendering-потік вирішують багато.",
      ]),
      execution: chooseVariant(seed, "next-execution", [
        "Я б робив це через чисту компонентну структуру, адаптив і уважну збірку ключових сценаріїв, щоб проєкт можна було нормально розвивати далі без болючого рефакторингу.",
        "Почав би з каркасу сторінки та компонентів, які справді мають сенс пере використовувати, а не з хаотичного нашарування блоків під одну задачу.",
        "Я б зібрав це так, щоб перша версія вже виглядала зібрано, але при цьому не перетворилася на тупик для подальшого розвитку Next.js-проєкту.",
      ]),
      question: chooseVariant(seed, "next-question", [
        "Проєкт уже має готову архітектуру/components tree, чи потрібно ще й допомогти нормально зібрати основу під подальший розвиток?",
        "Це задача на локальну сторінку/фічу, чи варто одразу дивитися ширше на структуру компонентів і станів у самому Next.js-проєкті?",
        "У вас уже є чітка компонента база, чи зараз якраз важливо зібрати все так, щоб потім не довелось перетрушувати структуру після першої поставки?",
      ]),
    };
  }

  if (haystack.includes("react")) {
    return {
      observation: chooseVariant(seed, "react-observation", [
        "У React-задачах зазвичай вирішує не загальна обіцянка “зроблю UI”, а те, наскільки чисто буде зібрана взаємодія, структура компонентів і поведінка екрана в реальних сценаріях.",
        "Тут сильна реалізація — це не просто зібрати JSX, а розкласти задачу на адекватні компоненти й не залишити після себе хаотичний шар умов і побічних ефектів.",
        "По React-проєктах клієнт дуже швидко бачить різницю між “ніби працює” і справді чистим UI-flow, де логіка не сиплеться від першої зміни.",
      ]),
      execution: chooseVariant(seed, "react-execution", [
        "Я б взяв це як нормальний React-флоу: розкласти екран на компоненти, акуратно пройтись по станах, зробити clean UI і не залишити після себе крихку конструкцію.",
        "Почав би з ключових сценаріїв екрана, а потім уже збирав би компоненти так, щоб вони лишались читабельними й контрольованими навіть після подальших змін.",
        "Я б зосередився на тому, щоб UI виглядав зібрано, а логіка не була розмазана по випадкових умовах і швидких патчах.",
      ]),
      question: chooseVariant(seed, "react-question", [
        "Чи є вже готові API/дані для інтеграції, чи зараз ключова задача саме у збірці інтерфейсу та UX-поведінки?",
        "Потрібно зараз більше зібрати сам UI-шар, чи ще й допомогти спокійно розкласти логіку станів і взаємодій між компонентами?",
        "У вас уже є готові дані й сценарії, чи спершу важливо правильно зібрати каркас компонента/екрана, щоб далі було легко рухатись?",
      ]),
    };
  }

  if (
    haystack.includes("html") ||
    haystack.includes("css") ||
    haystack.includes("figma") ||
    haystack.includes("frontend") ||
    haystack.includes("front-end")
  ) {
    return {
      observation: chooseVariant(seed, "frontend-observation", [
        "У front-end задачах такого типу вирішує не загальна фраза про верстку, а те, наскільки точно буде перенесена структура, адаптив і дрібні візуальні деталі без ефекту “майже збігається”.",
        "Подібні задачі виграються уважністю до макета, ритму блоків і мобільної поведінки, бо саме там найчастіше й видно різницю між посередньою і сильною реалізацією.",
        "Тут результат сильно залежить від того, чи буде верстка зібрана щільно і чисто, без накопичення дрібних перекосів, які потім псують усе враження від сторінки.",
      ]),
      execution: chooseVariant(seed, "frontend-execution", [
        "Я б сфокусувався на точному перенесенні структури, clean responsive-поведінці й тому, щоб сторінка виглядала зібрано вже з першої відправленої версії.",
        "Почав би з найважливіших блоків і breakpoint-логіки, щоб одразу зібрати нормальний desktop/mobile результат, а не латати адаптив уже після верстки.",
        "Я б збирав це через акуратну верстку, контроль ритму сторінки й перевірку поведінки на різних ширинах, щоб не залишати після себе дрібних візуальних провалів.",
      ]),
      question: chooseVariant(seed, "frontend-question", [
        "Чи є вже готовий макет/референс і які блоки для вас критичні в першій ітерації, щоб можна було швидко зібрати найважливіше?",
        "Потрібно зараз точно перенести готовий макет, чи ще можна трохи підсилити саму структуру сторінки там, де це покращить результат?",
        "Що для вас тут найважливіше на старті: pixel-accurate перенесення, mobile-адаптив чи швидке складання першої чистої версії сторінки?",
      ]),
    };
  }

  if (haystack.includes("api") || haystack.includes("dashboard")) {
    return {
      observation: chooseVariant(seed, "dashboard-observation", [
        "У dashboard/API-задачах слабке місце зазвичай не в самому екрані, а в тому, як інтерфейс поводиться зі станами, помилками, порожніми даними й реальними сценаріями користувача.",
        "Тут важливо, щоб UI не просто показував дані, а давав людині зрозумілий робочий потік: loading, empty states, validation, edge-cases і нормальна структура взаємодії.",
        "Подібні задачі добре видно на демо: якщо не продумати стани й логіку під’єднання даних, навіть красивий dashboard швидко починає виглядати сирим.",
      ]),
      execution: chooseVariant(seed, "dashboard-execution", [
        "Я б одразу зібрав основу так, щоб API було легко під’єднувати, а сам інтерфейс не губився у станах і не вимагав потім серії швидких латок.",
        "Почав би з ключових сценаріїв екрана, loading/error/empty states і структури даних, щоб далі реалізація була передбачуваною, а не реактивною.",
        "Я б дивився на це як на робочий інтерфейс, а не просто набір блоків: логіка даних, сценарії користувача і чисте збирання UI тут мають йти разом.",
      ]),
      question: chooseVariant(seed, "dashboard-question", [
        "Чи вже є опис основних сценаріїв користувача й структура даних, чи це ще можна підсилити на етапі реалізації?",
        "Потрібно зараз більше зібрати сам інтерфейс, чи ще й допомогти розкласти API/state-flow, щоб екран нормально поводився в реальній роботі?",
        "У вас уже зафіксовані стани та структура даних, чи саме це ще потрібно допомогти продумати до початку реалізації?",
      ]),
    };
  }

  return {
    observation: chooseVariant(seed, "generic-observation", [
      "Задача виглядає не як абстрактний “потрібен фронтенд”, а як робота, де вирішує швидке розуміння пріоритету і чиста реалізація без зайвого хаосу.",
      "По опису видно, що тут важливий не просто факт виконання, а те, наскільки уважно буде зібрана сама логіка і фінальний користувацький результат.",
      "Тут сильна сторона виконавця — не в красивій заявці, а в тому, щоб швидко вловити суть задачі і зібрати її без розмитих рішень.",
    ]),
    execution: chooseVariant(seed, "generic-execution", [
      "Я можу зайти в таку задачу спокійно й предметно: швидко розібрати обсяг, запропонувати робочий підхід і зосередитись на тому, що справді потрібно в першій версії.",
      "Мій підхід тут був би без зайвої метушні: швидко визначити головний фокус, зібрати сильну першу ітерацію і вже далі шліфувати деталі там, де це реально дає цінність.",
      "Я б почав із короткої декомпозиції задачі й збирав би рішення так, щоб уже перший результат виглядав як робоча версія, а не як чорновий компроміс.",
    ]),
    question: chooseVariant(seed, "generic-question", [
      "Що для вас тут найкритичніше на старті: швидко зібрати першу робочу версію чи відразу детально продумати повний сценарій?",
      "Який саме результат для вас тут пріоритетний у першій ітерації: швидкість запуску, чистота реалізації чи готовність до подальшого масштабування?",
      "На чому зараз варто сфокусуватись у першу чергу: швидко закрити ключовий сценарій чи відразу зібрати сильну основу під розвиток далі?",
    ]),
  };
}

function normalizeProposalOutput(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function looksLikeMixedOrWeakProposal(text: string) {
  const normalized = normalizeProposalOutput(text).toLowerCase();

  if (!normalized) {
    return true;
  }

  if (/[ыэъё]/i.test(normalized)) {
    return true;
  }

  const bannedPhrases = [
    "я можу швидко включитись у роботу",
    "можу одразу оцінити обсяг",
    "якщо зручно, можу коротко написати план реалізації",
    "з того, що бачу по опису:",
  ];

  return bannedPhrases.some((phrase) => normalized.includes(phrase));
}

function buildFallbackProposal(lead: ScoredJobLead) {
  const angle = inferProposalAngle(lead);
  const openerVariants = [
    `Доброго дня. Переглянув ваш проєкт «${lead.title}» і тут якраз та задача, де хороше рішення починається не з шаблонної відповіді, а з правильного читання самої проблеми.`,
    `Вітаю. По «${lead.title}» видно, що тут ціну матиме не загальна балачка, а виконавець, який швидко вловить суть і не піде в хаотичні правки.`,
    `Доброго дня. Ваш проєкт «${lead.title}» виглядає як робота, де сильний результат дає не “гучна” заявка, а точне розуміння вузького місця задачі.`,
    `Вітаю. Мені сподобалась задача «${lead.title}», бо тут важливо не просто щось доробити, а акуратно зібрати рішення так, щоб воно не розсипалось після першої ж ітерації.`,
  ];
  const closerVariants = [
    "Якщо хочете, я відразу напишу, з чого саме почав би цю задачу і де бачу перші технічні ризики.",
    "Якщо вам підходить такий підхід, я можу одразу дати короткий стартовий план без води і зайвого листування.",
    "Якщо зручно, після вашої відповіді я швидко розкладу це на перші кроки й скажу, як би рухався по реалізації.",
    "Якщо хочете, я не тягнутиму розмову і відразу дам предметний план старту по цій задачі.",
  ];
  const seed = `${lead.externalId}:${lead.title}`;
  const opener = openerVariants[createDeterministicIndex(seed, openerVariants.length)];
  const closer = closerVariants[createDeterministicIndex(`${seed}:closer`, closerVariants.length)];

  return normalizeProposalOutput(
    [
      opener,
      angle.observation,
      angle.execution,
      angle.question,
      closer,
    ].join("\n\n"),
  );
}

async function generateProposalForLead(lead: ScoredJobLead) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return buildFallbackProposal(lead);
  }

  try {
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const angle = inferProposalAngle(lead);
    const prompt = [
      "You write first-contact freelance proposals for a front-end developer.",
      "Write in clean natural Ukrainian only.",
      "Never use Russian words, Russian grammar, surzhyk, or mixed-language phrasing.",
      "If the project description is in English, understand it and answer in Ukrainian. Do not quote raw English sentences back to the client.",
      "The client will compare many generic bids, so the opening must feel specific and thoughtful, not templated.",
      "Do not invent years of experience, fake portfolio items, or fake team size.",
      "Sound calm, precise, and switched-on. Low-profile freelancer, but sharp and attentive.",
      "Avoid generic phrases like 'можу швидко включитись у роботу', 'можу оцінити обсяг', 'можу написати план реалізації'.",
      "Structure: 1) strong opening, 2) one concrete observation about this task, 3) one clear execution angle, 4) one smart clarifying question, 5) short confident close.",
      "No bullet points. No emojis. Plain text only.",
      "Length: 650-1100 characters.",
      "Vary sentence rhythm and phrasing so different projects do not get the same skeleton.",
      "",
      `Project title: ${lead.title}`,
      `Project summary: ${lead.summary}`,
      lead.budgetText ? `Budget mention: ${lead.budgetText}` : null,
      lead.categories.length
        ? `Categories: ${lead.categories.join(", ")}`
        : null,
      `Why it matched: ${lead.reasons.join("; ")}`,
      `Useful observation to incorporate: ${angle.observation}`,
      `Useful execution angle to incorporate: ${angle.execution}`,
      `Useful clarifying question to incorporate: ${angle.question}`,
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

    if (!text) {
      return buildFallbackProposal(lead);
    }

    const normalizedText = normalizeProposalOutput(text);

    return looksLikeMixedOrWeakProposal(normalizedText)
      ? buildFallbackProposal(lead)
      : normalizedText;
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

async function fetchWeWorkRemotelyLeads() {
  const response = await fetch(WEWORKREMOTELY_FRONTEND_RSS_URL, {
    cache: "no-store",
    headers: {
      "User-Agent": "Trainix Jobs Radar/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error("Не вдалося завантажити We Work Remotely RSS.");
  }

  const xml = await response.text();
  return parseWeWorkRemotelyRss(xml);
}

type FreelancerProjectResponse = {
  status?: string;
  result?: {
    projects?: Array<{
      id?: number | string;
      title?: string;
      seo_url?: string;
      preview_description?: string;
      description?: string;
      submitdate?: number;
      budget?: {
        minimum?: number;
        maximum?: number;
      };
      currency?: {
        code?: string;
        sign?: string;
      };
      jobs?: Array<{
        name?: string;
      }>;
    }>;
  };
};

type FreelancerProject = NonNullable<
  NonNullable<FreelancerProjectResponse["result"]>["projects"]
>[number];

function formatFreelancerBudget(project: FreelancerProject) {
  const minimum = project.budget?.minimum;
  const maximum = project.budget?.maximum;

  if (typeof minimum !== "number" && typeof maximum !== "number") {
    return null;
  }

  const currency = project.currency?.sign || project.currency?.code || "";
  const formatAmount = (value: number) =>
    `${currency}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`.trim();

  if (typeof minimum === "number" && typeof maximum === "number") {
    return minimum === maximum
      ? formatAmount(minimum)
      : `${formatAmount(minimum)}-${formatAmount(maximum)}`;
  }

  return formatAmount(typeof minimum === "number" ? minimum : (maximum as number));
}

function parseFreelancerProjects(data: FreelancerProjectResponse) {
  const projects = data.result?.projects ?? [];

  return projects
    .map((project): JobFeedItem | null => {
      const id = String(project.id ?? "").trim();
      const title = stripHtml(project.title ?? "");
      const summary = stripHtml(
        project.preview_description || project.description || "",
      ).slice(0, 1200);
      const categories =
        project.jobs?.map((job) => stripHtml(job.name ?? "")).filter(Boolean) ?? [];
      const link = project.seo_url
        ? `https://www.freelancer.com/projects/${project.seo_url}`
        : id
          ? `https://www.freelancer.com/projects/${id}`
          : "";
      const publishedAt =
        typeof project.submitdate === "number"
          ? new Date(project.submitdate * 1000).toISOString()
          : null;

      if (!id || !title || !link || !summary) {
        return null;
      }

      return {
        source: "freelancer",
        sourceLabel: "Freelancer.com API",
        externalId: `freelancer-${id}`,
        title,
        link,
        summary,
        budgetText: formatFreelancerBudget(project),
        categories,
        publishedAt,
      };
    })
    .filter((item): item is JobFeedItem => Boolean(item));
}

async function fetchFreelancerLeads() {
  const url = new URL(FREELANCER_ACTIVE_PROJECTS_URL);
  url.searchParams.set("limit", "50");
  url.searchParams.set("compact", "true");
  url.searchParams.set("full_description", "true");
  url.searchParams.set("job_details", "true");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Trainix Jobs Radar/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Не вдалося завантажити Freelancer.com API.");
  }

  const data = (await response.json()) as FreelancerProjectResponse;

  return parseFreelancerProjects(data);
}

async function fetchEnabledJobFeedItems(settings: JobHuntSettings) {
  const tasks: Array<Promise<JobFeedItem[]>> = [];

  if (settings.sourceFreelancehuntEnabled) {
    tasks.push(fetchFreelancehuntLeads());
  }

  if (settings.sourceFreelancerEnabled) {
    tasks.push(fetchFreelancerLeads());
  }

  if (settings.sourceWeworkremotelyEnabled) {
    tasks.push(fetchWeWorkRemotelyLeads());
  }

  if (!tasks.length) {
    return [] as JobFeedItem[];
  }

  const results = await Promise.allSettled(tasks);

  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
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
      source_freelancer_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      source_weworkremotely_enabled BOOLEAN NOT NULL DEFAULT FALSE,
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
    ALTER TABLE job_hunt_settings
    ADD COLUMN IF NOT EXISTS source_freelancer_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `;

  await sql`
    ALTER TABLE job_hunt_settings
    ADD COLUMN IF NOT EXISTS source_weworkremotely_enabled BOOLEAN NOT NULL DEFAULT FALSE
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
      source_freelancer_enabled,
      source_weworkremotely_enabled,
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
  sourceFreelancerEnabled: boolean;
  sourceWeworkremotelyEnabled: boolean;
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
      source_freelancer_enabled,
      source_weworkremotely_enabled,
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
      ${input.sourceFreelancerEnabled},
      ${input.sourceWeworkremotelyEnabled},
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
      source_freelancer_enabled = EXCLUDED.source_freelancer_enabled,
      source_weworkremotely_enabled = EXCLUDED.source_weworkremotely_enabled,
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
      source_freelancer_enabled,
      source_weworkremotely_enabled,
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

  const hasEnabledSource =
    settings.sourceFreelancehuntEnabled ||
    settings.sourceFreelancerEnabled ||
    settings.sourceWeworkremotelyEnabled;

  if (!hasEnabledSource) {
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

  const feedItems = await fetchEnabledJobFeedItems(settings);
  const scored = feedItems
    .map((item) => scoreJobLead({ item, settings }))
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
        SELECT source, link
        FROM job_leads
        WHERE owner_email = ${ownerEmail}
          AND link = ANY(${acceptedLinks})
      `) as Array<{ source: JobLeadSource; link: string }>)
    : [];

  const existingKeys = new Set(
    existing.map((row) => `${row.source}:${row.link}`),
  );
  const insertedLeads: JobLead[] = [];

  for (const lead of accepted) {
    if (existingKeys.has(`${lead.source}:${lead.link}`)) {
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
    scanned: feedItems.length,
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

export async function deleteJobLead(input: {
  ownerEmail: string;
  leadId: string;
}) {
  const sql = await ensureJobsTables();

  if (!sql) {
    return false;
  }

  const rows = (await sql`
    DELETE FROM job_leads
    WHERE id = ${input.leadId}
      AND owner_email = ${input.ownerEmail}
    RETURNING id
  `) as Array<{ id: string }>;

  return Boolean(rows[0]?.id);
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
      source_freelancer_enabled,
      source_weworkremotely_enabled,
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
