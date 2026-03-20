import type { FacebookContentSettings } from "@/lib/social/facebook";

type FacebookSettingsSummaryCardProps = {
  settings: FacebookContentSettings;
};

const labelMap: Record<string, Record<string, string>> = {
  toneProfile: {
    human: "Людяний",
    calm: "Спокійний",
    energetic: "Енергійний",
    expert: "Експертний",
  },
  postStyle: {
    short: "Короткий",
    medium: "Середній",
    story: "Історія",
    list: "Список / поради",
    "problem-solution": "Проблема -> рішення",
  },
  primaryGoal: {
    awareness: "Awareness",
    education: "Education",
    trust: "Trust",
    engagement: "Engagement",
    "soft-promo": "Soft promo",
  },
  productPresence: {
    minimal: "Мінімально",
    balanced: "Помірно",
    strong: "Сильно",
  },
  ctaStyle: {
    none: "Без CTA",
    soft: "М'який",
    question: "Запитання в кінці",
    follow: "Підписка / follow",
    waitlist: "Очікування запуску",
  },
  emotionalLevel: {
    reserved: "Стримано",
    warm: "Тепло",
    inspiring: "Натхненно",
    assertive: "Напористо",
  },
  visualStyle: {
    photo: "Фото",
    "ai-visual": "AI visual",
    "branded-minimal": "Branded minimal",
    mixed: "Mixed",
  },
  postingCadence: {
    daily: "Щодня",
    "5-per-week": "5 постів / тиждень",
    "4-per-week": "4 пости / тиждень",
    "3-per-week": "3 пости / тиждень",
    "2-per-week": "2 пости / тиждень",
  },
};

function readableValue(group: keyof typeof labelMap, value: string) {
  return labelMap[group][value] || value;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Ще не зберігалось";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FacebookSettingsSummaryCard({
  settings,
}: FacebookSettingsSummaryCardProps) {
  const items = [
    ["Tone", readableValue("toneProfile", settings.toneProfile)],
    ["Post style", readableValue("postStyle", settings.postStyle)],
    ["Goal", readableValue("primaryGoal", settings.primaryGoal)],
    ["Product presence", readableValue("productPresence", settings.productPresence)],
    ["CTA", readableValue("ctaStyle", settings.ctaStyle)],
    ["Emotion", readableValue("emotionalLevel", settings.emotionalLevel)],
    ["Visual", readableValue("visualStyle", settings.visualStyle)],
    ["Cadence", readableValue("postingCadence", settings.postingCadence)],
  ] as const;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Facebook
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">
            Profile Summary
          </h2>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/60">
          Live config
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3"
          >
            <span className="text-sm text-white/46">{label}</span>
            <span className="max-w-[13rem] truncate text-right text-sm font-medium text-white/84">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-[#091122]/60 px-4 py-4 text-sm leading-7 text-white/52">
        Цей summary показує активний профіль генерації. Коли почнемо будувати
        Facebook drafts engine, кожен драфт можна буде прив&apos;язати до цих
        параметрів і тестувати, які комбінації дають найсильніший результат.
      </div>

      <p className="mt-4 text-sm leading-7 text-white/46">
        Останнє оновлення: {formatDate(settings.updatedAt)}
      </p>
    </section>
  );
}
