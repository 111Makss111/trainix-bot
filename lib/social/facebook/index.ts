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
  attachFacebookDraftImage,
  clearFacebookDraftImage,
  createFacebookDrafts,
  deleteFacebookDraft,
  getFacebookDraftById,
  getFacebookDraftStoredImage,
  listFacebookDrafts,
  markFacebookDraftPublished,
  type FacebookPostDraft,
  type FacebookPublishableDraft,
} from "./drafts";

export { generateFacebookDrafts } from "./generator";
export { generateFacebookSettingsContext } from "./context";
export {
  clearFacebookPageConnection,
  getFacebookPageConnection,
  getFacebookPageConnectionCredentials,
  saveFacebookPageConnection,
  verifyFacebookPageConnection,
  type FacebookPageConnection,
} from "./connection";
export { buildFacebookPostMessage, publishFacebookDraft } from "./publishing";
export {
  FACEBOOK_WORKSPACE_TABS,
  normalizeFacebookWorkspaceTab,
  type FacebookWorkspaceTab,
} from "./tabs";
