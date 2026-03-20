export const FACEBOOK_SOCIAL_MODULE = {
  key: "facebook",
  label: "Facebook",
} as const;

export {
  getFacebookContentSettings,
  saveFacebookContentSettings,
  type FacebookContentSettings,
} from "./settings";

export {
  archiveFacebookDrafts,
  createFacebookDrafts,
  deleteFacebookDraft,
  listFacebookDrafts,
  type FacebookPostDraft,
} from "./drafts";

export { generateFacebookDrafts } from "./generator";
export { generateFacebookSettingsContext } from "./context";
export {
  FACEBOOK_WORKSPACE_TABS,
  normalizeFacebookWorkspaceTab,
  type FacebookWorkspaceTab,
} from "./tabs";
