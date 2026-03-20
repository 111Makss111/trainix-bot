import { CabinetTopbar } from "@/components/cabinet";
import type {
  FacebookContentSettings,
  FacebookPostDraft,
  FacebookWorkspaceTab,
} from "@/lib/social/facebook";
import { FacebookConnectionCard } from "./FacebookConnectionCard";
import { FacebookContentSettingsCard } from "./FacebookContentSettingsCard";
import { FacebookDraftQueueCard } from "./FacebookDraftQueueCard";
import { FacebookSettingsSummaryCard } from "./FacebookSettingsSummaryCard";
import { FacebookWorkspaceTabs } from "./FacebookWorkspaceTabs";

type FacebookWorkspaceProps = {
  settings: FacebookContentSettings;
  drafts: FacebookPostDraft[];
  activeTab: FacebookWorkspaceTab;
  notice?: string;
};

export function FacebookWorkspace({
  settings,
  drafts,
  activeTab,
  notice,
}: FacebookWorkspaceProps) {
  return (
    <>
      <CabinetTopbar
        eyebrow="Social / Facebook"
        title="Facebook Ecosystem"
        description="Facebook живе окремо від інших платформ. Тепер модуль розкладений по вкладках, щоб налаштування, драфти й platform-layer не зливалися в одну довгу сторінку."
      />

      <FacebookWorkspaceTabs activeTab={activeTab} draftsCount={drafts.length} />

      {activeTab === "settings" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
          <FacebookContentSettingsCard
            settings={settings}
            notice={notice}
            activeTab={activeTab}
          />
          <FacebookSettingsSummaryCard settings={settings} />
        </div>
      ) : null}

      {activeTab === "drafts" ? (
        <FacebookDraftQueueCard
          settings={settings}
          drafts={drafts}
          notice={notice}
          activeTab={activeTab}
        />
      ) : null}

      {activeTab === "facebook" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(22rem,1.08fr)]">
          <FacebookConnectionCard />
          <FacebookSettingsSummaryCard settings={settings} />
        </div>
      ) : null}
    </>
  );
}
