"use client";

import type { FacebookWorkspaceTab } from "@/lib/social/facebook";

type FacebookWorkspaceTabsProps = {
  activeTab: FacebookWorkspaceTab;
  draftsCount: number;
  onChange: (tab: FacebookWorkspaceTab) => void;
};

const tabs: Array<{
  key: FacebookWorkspaceTab;
  label: string;
  description: string;
}> = [
  {
    key: "settings",
    label: "Налаштування",
    description: "Tone, goal, CTA і контент-профіль.",
  },
  {
    key: "drafts",
    label: "Драфти",
    description: "Генерація, прев'ю, картинки й відбір постів.",
  },
  {
    key: "facebook",
    label: "Facebook",
    description: "Connection layer і live profile summary.",
  },
];

export function FacebookWorkspaceTabs({
  activeTab,
  draftsCount,
  onChange,
}: FacebookWorkspaceTabsProps) {
  return (
    <nav className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md md:grid-cols-3">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              onChange(tab.key);
            }}
            className={[
              "rounded-[1.5rem] border px-4 py-4 text-left transition",
              isActive
                ? "border-sky-300/20 bg-sky-300/[0.12] shadow-[0_0_0_1px_rgba(125,211,252,0.08)]"
                : "border-white/8 bg-[#091122]/58 hover:border-white/14 hover:bg-[#0d1730]/72",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">{tab.label}</span>
              {tab.key === "drafts" ? (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/58">
                  {draftsCount} ready
                </span>
              ) : (
                <span
                  className={[
                    "h-2.5 w-2.5 rounded-full",
                    isActive ? "bg-sky-300" : "bg-white/18",
                  ].join(" ")}
                />
              )}
            </div>

            <p className="mt-3 text-sm leading-6 text-white/48">
              {tab.description}
            </p>
          </button>
        );
      })}
    </nav>
  );
}
