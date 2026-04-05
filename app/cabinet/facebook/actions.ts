"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwnerEmail } from "@/lib/auth-guards";
import {
  archiveFacebookDrafts,
  attachFacebookDraftImage,
  clearFacebookPageConnection,
  clearFacebookDraftImage,
  createFacebookDrafts,
  deleteFacebookDraft,
  getFacebookDraftById,
  generateFacebookDrafts,
  generateFacebookSettingsContext,
  getFacebookContentSettings,
  getFacebookPageConnectionCredentials,
  markFacebookDraftPublished,
  normalizeFacebookWorkspaceTab,
  publishFacebookDraft,
  saveFacebookPageConnection,
  saveFacebookContentSettings,
  verifyFacebookPageConnection,
  type FacebookWorkspaceTab,
} from "@/lib/social/facebook";

function getFacebookWorkspaceTab(
  formData: FormData,
  fallback: FacebookWorkspaceTab,
) {
  const value = formData.get("tab");

  return normalizeFacebookWorkspaceTab(
    typeof value === "string" ? value : fallback,
  );
}

function redirectToFacebookState(
  state: string,
  tab: FacebookWorkspaceTab,
): never {
  redirect(`/cabinet/facebook?tab=${tab}&state=${state}`);
}

function normalizeImageUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (
    /^https?:\/\//i.test(normalized) ||
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(normalized)
  ) {
    return normalized;
  }

  return null;
}

function normalizeTextInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

async function fileToDataUrl(file: File) {
  if (!file || file.size <= 0) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  if (file.size > 4 * 1024 * 1024) {
    throw new Error("Image file is too large");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

function readFacebookContentSettingsFromFormData(formData: FormData) {
  const toneProfile = formData.get("toneProfile");
  const postStyle = formData.get("postStyle");
  const primaryGoal = formData.get("primaryGoal");
  const productPresence = formData.get("productPresence");
  const ctaStyle = formData.get("ctaStyle");
  const emotionalLevel = formData.get("emotionalLevel");
  const visualStyle = formData.get("visualStyle");
  const postingCadence = formData.get("postingCadence");
  const audienceFocus = formData.get("audienceFocus");
  const brandNotes = formData.get("brandNotes");
  const founderStoryAngle = formData.get("founderStoryAngle");

  if (
    typeof toneProfile !== "string" ||
    typeof postStyle !== "string" ||
    typeof primaryGoal !== "string" ||
    typeof productPresence !== "string" ||
    typeof ctaStyle !== "string" ||
    typeof emotionalLevel !== "string" ||
    typeof visualStyle !== "string" ||
    typeof postingCadence !== "string"
  ) {
    return null;
  }

  return {
    toneProfile,
    postStyle,
    primaryGoal,
    productPresence,
    ctaStyle,
    emotionalLevel,
    visualStyle,
    postingCadence,
    audienceFocus: typeof audienceFocus === "string" ? audienceFocus : null,
    brandNotes: typeof brandNotes === "string" ? brandNotes : null,
    founderStoryAngle:
      typeof founderStoryAngle === "string" ? founderStoryAngle : null,
  };
}

export async function saveFacebookContentSettingsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "settings");
  const parsed = readFacebookContentSettingsFromFormData(formData);

  if (!parsed) {
    return;
  }

  await saveFacebookContentSettings({
    ownerEmail,
    ...parsed,
  });

  revalidatePath("/cabinet/facebook");
  redirectToFacebookState("saved", tab);
}

export async function autofillFacebookContextAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "settings");
  const parsed = readFacebookContentSettingsFromFormData(formData);

  if (!parsed) {
    return;
  }

  const generatedContext = await generateFacebookSettingsContext(parsed);

  await saveFacebookContentSettings({
    ownerEmail,
    ...parsed,
    audienceFocus: generatedContext.audienceFocus,
    brandNotes: generatedContext.brandNotes,
    founderStoryAngle: generatedContext.founderStoryAngle,
  });

  revalidatePath("/cabinet/facebook");
  redirectToFacebookState("ai-context-filled", tab);
}

export async function generateFacebookDraftsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "drafts");
  const topicHint = formData.get("topicHint");
  const settings = await getFacebookContentSettings(ownerEmail);

  try {
    const result = await generateFacebookDrafts({
      settings,
      topicHint: typeof topicHint === "string" ? topicHint : null,
    });

    await archiveFacebookDrafts(ownerEmail);
    await createFacebookDrafts({
      ownerEmail,
      topicHint: typeof topicHint === "string" ? topicHint.trim() || null : null,
      settings,
      drafts: result.drafts,
    });

    revalidatePath("/cabinet/facebook");
    redirectToFacebookState("drafts-generated", tab);
  } catch (error) {
    console.error("Failed to generate Facebook drafts", error);
    redirectToFacebookState("drafts-failed", tab);
  }
}

export async function deleteFacebookDraftAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "drafts");
  const draftId = formData.get("draftId");

  if (typeof draftId !== "string") {
    return;
  }

  await deleteFacebookDraft({
    ownerEmail,
    draftId,
  });

  revalidatePath("/cabinet/facebook");
  redirectToFacebookState("draft-deleted", tab);
}

export async function attachFacebookDraftImageAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "drafts");
  const draftId = formData.get("draftId");
  const imageAlt = formData.get("imageAlt");
  const imageFile = formData.get("imageFile");

  if (typeof draftId !== "string") {
    return;
  }

  try {
    const uploadedImageUrl =
      imageFile instanceof File ? await fileToDataUrl(imageFile) : null;
    const manualImageUrl = normalizeImageUrl(formData.get("imageUrl"));
    const finalImageUrl = uploadedImageUrl || manualImageUrl;

    if (!finalImageUrl) {
      redirectToFacebookState("image-invalid", tab);
    }

    await attachFacebookDraftImage({
      ownerEmail,
      draftId,
      imageUrl: finalImageUrl,
      imageAlt: typeof imageAlt === "string" ? imageAlt.trim() || null : null,
      imageSource: uploadedImageUrl ? "Manual upload" : "Manual URL",
    });

    revalidatePath("/cabinet/facebook");
    redirectToFacebookState("image-attached", tab);
  } catch (error) {
    console.error("Failed to attach Facebook draft image", error);
    redirectToFacebookState("image-invalid", tab);
  }
}

export async function clearFacebookDraftImageAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "drafts");
  const draftId = formData.get("draftId");

  if (typeof draftId !== "string") {
    return;
  }

  await clearFacebookDraftImage({
    ownerEmail,
    draftId,
  });

  revalidatePath("/cabinet/facebook");
  redirectToFacebookState("image-cleared", tab);
}

export async function saveFacebookPageConnectionAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "facebook");
  const existingConnection =
    await getFacebookPageConnectionCredentials(ownerEmail);
  const pageId =
    normalizeTextInput(formData.get("pageId")) ?? existingConnection?.pageId;
  const pageAccessToken =
    normalizeTextInput(formData.get("pageAccessToken")) ??
    existingConnection?.pageAccessToken;

  if (!pageId || !pageAccessToken) {
    redirectToFacebookState("connection-invalid", tab);
  }

  await saveFacebookPageConnection({
    ownerEmail,
    pageId,
    pageAccessToken,
  });

  revalidatePath("/cabinet/facebook");
  redirectToFacebookState("connection-saved", tab);
}

export async function verifyFacebookPageConnectionAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "facebook");
  const existingConnection =
    await getFacebookPageConnectionCredentials(ownerEmail);
  const pageId =
    normalizeTextInput(formData.get("pageId")) ?? existingConnection?.pageId;
  const pageAccessToken =
    normalizeTextInput(formData.get("pageAccessToken")) ??
    existingConnection?.pageAccessToken;

  if (!pageId || !pageAccessToken) {
    redirectToFacebookState("connection-invalid", tab);
  }

  try {
    await verifyFacebookPageConnection({
      ownerEmail,
      pageId,
      pageAccessToken,
    });

    revalidatePath("/cabinet/facebook");
    redirectToFacebookState("connection-verified", tab);
  } catch (error) {
    console.error("Failed to verify Facebook Page connection", error);
    redirectToFacebookState("connection-verify-failed", tab);
  }
}

export async function clearFacebookPageConnectionAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "facebook");

  await clearFacebookPageConnection(ownerEmail);

  revalidatePath("/cabinet/facebook");
  redirectToFacebookState("connection-cleared", tab);
}

export async function publishFacebookDraftAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const tab = getFacebookWorkspaceTab(formData, "drafts");
  const draftId = normalizeTextInput(formData.get("draftId"));
  const connection = await getFacebookPageConnectionCredentials(ownerEmail);

  if (!draftId) {
    redirectToFacebookState("publish-failed", tab);
  }

  if (!connection?.pageId || !connection.pageAccessToken) {
    redirectToFacebookState("publish-connection-missing", tab);
  }

  const draft = await getFacebookDraftById({
    ownerEmail,
    draftId,
  });

  if (!draft || draft.status !== "draft") {
    redirectToFacebookState("publish-missing", tab);
  }

  try {
    const result = await publishFacebookDraft({
      draft,
      connection: {
        pageId: connection.pageId,
        pageAccessToken: connection.pageAccessToken,
      },
    });

    await markFacebookDraftPublished({
      ownerEmail,
      draftId,
      publishedPostId: result.publishedPostId,
    });

    revalidatePath("/cabinet/facebook");
    redirectToFacebookState("draft-published", tab);
  } catch (error) {
    console.error("Failed to publish Facebook draft", error);
    redirectToFacebookState("publish-failed", tab);
  }
}
