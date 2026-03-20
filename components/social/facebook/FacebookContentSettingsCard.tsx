import {
  autofillFacebookContextAction,
  saveFacebookContentSettingsAction,
} from "@/app/cabinet/facebook/actions";
import type {
  FacebookContentSettings,
  FacebookWorkspaceTab,
} from "@/lib/social/facebook";
import { SocialPendingState } from "@/components/social/shared/SocialPendingState";
import { SocialSubmitButton } from "@/components/social/shared/SocialSubmitButton";

type FacebookContentSettingsCardProps = {
  settings: FacebookContentSettings;
  activeTab: FacebookWorkspaceTab;
  notice?: string;
};

const noticeMessages: Record<
  string,
  { tone: "success"; text: string }
> = {
  saved: {
    tone: "success",
    text: "Facebook-настройки збережені. Далі генератор контенту вже зможе спиратись саме на цей профіль.",
  },
  "ai-context-filled": {
    tone: "success",
    text: "AI сам заповнив audience, brand і founder context. Тепер можна одразу тестувати генерацію постів без ручного тексту.",
  },
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
  activeTab,
  notice,
}: FacebookContentSettingsCardProps) {
  const message = notice ? noticeMessages[notice] : null;
  const hasAdvancedContext = Boolean(
    settings.audienceFocus || settings.brandNotes || settings.founderStoryAngle,
  );

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
          {message.text}
        </div>
      ) : null}

      <form action={saveFacebookContentSettingsAction} className="mt-5 space-y-5">
        <input type="hidden" name="tab" value={activeTab} />

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

        <details
          open={hasAdvancedContext || notice === "ai-context-filled"}
          className="rounded-[1.6rem] border border-white/8 bg-[#091122]/44 px-4 py-4"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Advanced AI context</p>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-white/48">
                Ці поля необов&apos;язкові для ручного заповнення. Натисни
                `Заповнити AI`, і Trainix сам збере audience, brand rules та
                founder angle під поточні dropdown-настройки.
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/56">
              Optional
            </span>
          </summary>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.24em] text-white/36">
                Audience focus
              </span>
              <textarea
                name="audienceFocus"
                rows={6}
                defaultValue={settings.audienceFocus ?? ""}
                placeholder="AI заповнить це поле сам на базі product profile і поточних Facebook settings."
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
                placeholder="AI заповнить правила тону, заборони і бренд-рамки без твого ручного тексту."
                className="min-h-[10rem] rounded-[1.5rem] border border-white/10 bg-[#091122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
              />
            </label>
          </div>

          <label className="mt-4 grid gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-white/36">
              Founder story angle
            </span>
            <textarea
              name="founderStoryAngle"
              rows={5}
              defaultValue={settings.founderStoryAngle ?? ""}
              placeholder="AI сам сформує founder/build-in-public angle під Trainix."
              className="min-h-[9rem] rounded-[1.5rem] border border-white/10 bg-[#091122] px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <SocialSubmitButton
              formAction={autofillFacebookContextAction}
              idleLabel="Заповнити AI"
              pendingLabel="AI заповнює..."
              className="rounded-full border border-sky-300/18 bg-sky-300/10 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-300/16"
            />
          </div>
        </details>

        <div className="rounded-[1.5rem] border border-white/8 bg-[#091122]/60 px-4 py-4 text-sm leading-7 text-white/52">
          Тут формується profile layer для Facebook-generator: стиль, ціль,
          інтенсивність продукту, візуальний напрям і додатковий AI context.
          Тобто навіть без ручного копірайту система зможе сама зібрати базу
          для сильніших драфтів.
        </div>

        <div className="flex flex-wrap gap-3">
          <SocialSubmitButton
            idleLabel="Зберегти Facebook settings"
            pendingLabel="Зберігаю..."
            className="rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(124,150,255,0.3),rgba(255,255,255,0.12))]"
          />
        </div>

        <SocialPendingState label="Оновлюю Facebook profile і AI context." />
      </form>
    </section>
  );
}
