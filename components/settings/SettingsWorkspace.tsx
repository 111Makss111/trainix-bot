"use client";

import { useState } from "react";
import { CabinetCard } from "@/components/cabinet";
import type { TwoFactorSettingsState } from "@/lib/security/two-factor";
import { TwoFactorSettingsCard } from "./TwoFactorSettingsCard";

type SettingsWorkspaceTab = "security" | "general";

type SettingsWorkspaceProps = {
  twoFactorState: TwoFactorSettingsState;
};

const tabs: Array<{
  id: SettingsWorkspaceTab;
  label: string;
  description: string;
}> = [
  {
    id: "security",
    label: "Безпека",
    description: "2FA і захист входу",
  },
  {
    id: "general",
    label: "Загальні",
    description: "Базові системні нотатки",
  },
];

export function SettingsWorkspace({ twoFactorState }: SettingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SettingsWorkspaceTab>("security");

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md">
        <div className="grid gap-2 md:grid-cols-2">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "rounded-[1.5rem] border px-4 py-4 text-left transition",
                  active
                    ? "border-white/16 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] text-white shadow-[0_0_28px_rgba(91,119,230,0.14)]"
                    : "border-white/8 bg-[#07101e]/78 text-white/68 hover:border-white/12 hover:bg-white/[0.05] hover:text-white/84",
                ].join(" ")}
              >
                <p className="text-sm font-medium">{tab.label}</p>
                <p className="mt-2 text-xs leading-6 text-white/44">
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "security" ? (
        <TwoFactorSettingsCard initialState={twoFactorState} />
      ) : (
        <CabinetCard
          eyebrow="General"
          title="Google login залишається першим бар'єром"
          description="2FA у кабінеті не замінює захист твого Google-акаунта. Найкраща схема тут подвійна: Google owner-only login + код із authenticator app уже всередині самого кабінету."
        />
      )}
    </div>
  );
}
