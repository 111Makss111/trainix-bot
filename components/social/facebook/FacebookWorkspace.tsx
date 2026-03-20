import { CabinetTopbar } from "@/components/cabinet";
import type {
  FacebookContentSettings,
  FacebookPostDraft,
} from "@/lib/social/facebook";
import { FacebookConnectionCard } from "./FacebookConnectionCard";
import { FacebookContentSettingsCard } from "./FacebookContentSettingsCard";
import { FacebookDraftQueueCard } from "./FacebookDraftQueueCard";
import { FacebookSettingsSummaryCard } from "./FacebookSettingsSummaryCard";

type FacebookWorkspaceProps = {
  settings: FacebookContentSettings;
  drafts: FacebookPostDraft[];
  notice?: string;
};

export function FacebookWorkspace({
  settings,
  drafts,
  notice,
}: FacebookWorkspaceProps) {
  return (
    <>
      <CabinetTopbar
        eyebrow="Social / Facebook"
        title="Facebook Ecosystem"
        description="Facebook живе як окремий контент-модуль. Тут ми спершу будуємо profile layer для генерації постів: tone, goal, product presence, CTA, visual direction і cadence без змішування з іншими платформами."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <FacebookContentSettingsCard settings={settings} notice={notice} />
        <FacebookSettingsSummaryCard settings={settings} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FacebookConnectionCard />
        <FacebookDraftQueueCard
          settings={settings}
          drafts={drafts}
          notice={notice}
        />
      </div>
    </>
  );
}
