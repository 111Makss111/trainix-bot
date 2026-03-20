import { saveFacebookContentSettingsAction } from "@/app/cabinet/facebook/actions";
import type { FacebookContentSettings } from "@/lib/social/facebook";
import { SocialPendingState } from "@/components/social/shared/SocialPendingState";
import { SocialSubmitButton } from "@/components/social/shared/SocialSubmitButton";

type FacebookContentSettingsCardProps = {
  settings: FacebookContentSettings;
  notice?: string;
};

const noticeMessages: Record<string, string> = {
  saved:
    "Facebook-настройки збережені. Далі генератор контенту вже зможе спиратись саме на цей профіль.",
};

const toneOptions = [
  ["human", "Людяний"],
  ["calm", "Спокійний"],
  ["energetic", "Енергійний"],
  ["expert", "Експертний"],
] as const;

const postStyleOptions = [
  ["short", "Короткий"],
  ["medium", "Середній"],
  ["story", "Історія"],
  ["list", "Список / поради"],
  ["problem-solution", "Проблема -> рішення"],
] as const;

const goalOptions = [
  ["awareness", "Awareness"],
  ["education", "Education"],
  ["trust", "Trust"],
  ["engagement", "Engagement"],
  ["soft-promo", "Soft promo"],
] as const;

const productPresenceOptions = [
  ["minimal", "Мінімально"],
  ["balanced", "Помірно"],
  ["strong", "Сильно"],
] as const;

const ctaOptions = [
  ["none", "Без CTA"],
  ["soft", "М'який"],
  ["question", "Запитання в кінці"],
  ["follow", "Підписка / follow"],
  ["waitlist", "Очікування запуску"],
] as const;

const emotionalOptions = [
  ["reserved", "Стримано"],
  ["warm", "Тепло"],
  ["inspiring", "Натхненно"],
  ["assertive", "Напористо"],
] as const;

const visualOptions = [
  ["photo", "Фото"],
  ["ai-visual", "AI visual"],
  ["branded-minimal", "Branded minimal"],
  ["mixed", "Mixed"],
] as const;

const cadenceOptions = [
  ["daily", "Щодня"],
  ["5-per-week", "5 постів на тиждень"],
  ["4-per-week", "4 пости на тиждень"],
  ["3-per-week", "3 пости на тиждень"],
  ["2-per-week", "2 пости на тиждень"],
] as const;

function SelectField(props: {
  name: string;
  label: string;
  defaultValue: string;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="text-xs uppercase tracking-[0.24em] text-white/36">
        {props.label}
      </span>
      <select
        name={props.name}
        defaultValue={props.defaultValue}
        className="h-12 min-w-0 rounded-[1.2rem] border border-white/10 bg-[#091122] px-4 text-sm text-white outline-none transition focus:border-white/18"
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FacebookContentSettingsCard({
  settings,
  notice,
}: FacebookContentSettingsCardProps) {
  const message = notice ? noticeMessages[notice] : null;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Facebook
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">
            Content Settings
          </h2>
        </div>

        <span className="rounded-full border border-sky-300/18 bg-sky-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-sky-100">
          Draft profile
        </span>
      </div>

      {message ? (
        <div className="mt-5 rounded-[1.3rem] border border-emerald-300/14 bg-emerald-300/[0.08] px-4 py-3 text-sm leading-6 text-emerald-50">
          {message}
        </div>
      ) : null}

      <form action={saveFacebookContentSettingsAction} className="mt-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectField
            name="toneProfile"
            label="Tone"
            defaultValue={settings.toneProfile}
            options={toneOptions}
          />
          <SelectField
            name="postStyle"
            label="Post style"
            defaultValue={settings.postStyle}
            options={postStyleOptions}
          />
          <SelectField
            name="primaryGoal"
            label="Goal"
            defaultValue={settings.primaryGoal}
            options={goalOptions}
          />
          <SelectField
            name="productPresence"
            label="Product presence"
            defaultValue={settings.productPresence}
            options={productPresenceOptions}
          />
          <SelectField
            name="ctaStyle"
            label="CTA style"
            defaultValue={settings.ctaStyle}
            options={ctaOptions}
          />
          <SelectField
            name="emotionalLevel"
            label="Emotional level"
            defaultValue={settings.emotionalLevel}
            options={emotionalOptions}
          />
          <SelectField
            name="visualStyle"
            label="Visual style"
            defaultValue={settings.visualStyle}
            options={visualOptions}
          />
          <SelectField
            name="postingCadence"
            label="Posting cadence"
            defaultValue={settings.postingCadence}
            options={cadenceOptions}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-white/36">
              Audience focus
            </span>
            <textarea
              name="audienceFocus"
              rows={6}
              defaultValue={settings.audienceFocus ?? ""}
              placeholder="Для кого Facebook-контент? Наприклад: новачки, люди без дисципліни, ті хто хоче повернутись до тренувань."
              className="min-h-[10rem] rounded-[1.5rem] border border-white/10 bg-[#091122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-white/36">
              Brand notes
            </span>
            <textarea
              name="brandNotes"
              rows={6}
              defaultValue={settings.brandNotes ?? ""}
              placeholder="Які правила мають бути у Facebook-постів? Що не можна вигадувати? Як має звучати Trainix у цій соцмережі?"
              className="min-h-[10rem] rounded-[1.5rem] border border-white/10 bg-[#091122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.24em] text-white/36">
            Founder story angle
          </span>
          <textarea
            name="founderStoryAngle"
            rows={5}
            defaultValue={settings.founderStoryAngle ?? ""}
            placeholder="Що саме має підсвічуватися в founder/build-in-public постах: мотивація створення, шлях розробки, філософія продукту, особисті причини?"
            className="min-h-[9rem] rounded-[1.5rem] border border-white/10 bg-[#091122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
          />
        </label>

        <div className="rounded-[1.5rem] border border-white/8 bg-[#091122]/60 px-4 py-4 text-sm leading-7 text-white/52">
          Тут ми ще не генеруємо самі пости. Це саме profile layer для
          майбутнього Facebook-generator: стиль, ціль, інтенсивність продукту,
          візуальний напрям і базові рамки, з яких потім народжуватимуться
          драфти.
        </div>

        <div className="flex flex-wrap gap-3">
          <SocialSubmitButton
            idleLabel="Зберегти Facebook settings"
            pendingLabel="Зберігаю..."
            className="rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))]"
          />
        </div>

        <SocialPendingState label="Оновлюю Facebook content settings." />
      </form>
    </section>
  );
}
