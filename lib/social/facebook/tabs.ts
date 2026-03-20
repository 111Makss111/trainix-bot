export const FACEBOOK_WORKSPACE_TABS = [
  "settings",
  "drafts",
  "facebook",
] as const;

export type FacebookWorkspaceTab = (typeof FACEBOOK_WORKSPACE_TABS)[number];

export function normalizeFacebookWorkspaceTab(
  value: string | null | undefined,
): FacebookWorkspaceTab {
  if (value === "drafts" || value === "facebook") {
    return value;
  }

  return "settings";
}
