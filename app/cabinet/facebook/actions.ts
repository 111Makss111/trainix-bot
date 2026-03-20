"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  archiveFacebookDrafts,
  createFacebookDrafts,
  deleteFacebookDraft,
  generateFacebookDrafts,
  getFacebookContentSettings,
  saveFacebookContentSettings,
} from "@/lib/social/facebook";

async function requireOwnerEmail() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    throw new Error("Unauthorized");
  }

  return session.user.email.trim().toLowerCase();
}

function redirectToFacebookState(state: string): never {
  redirect(`/cabinet/facebook?state=${state}`);
}

export async function saveFacebookContentSettingsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
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
    return;
  }

  await saveFacebookContentSettings({
    ownerEmail,
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
  });

  revalidatePath("/cabinet/facebook");
  redirectToFacebookState("saved");
}

export async function generateFacebookDraftsAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const topicHint = formData.get("topicHint");
  const settings = await getFacebookContentSettings(ownerEmail);

  try {
    const drafts = await generateFacebookDrafts({
      settings,
      topicHint: typeof topicHint === "string" ? topicHint : null,
    });

    await archiveFacebookDrafts(ownerEmail);
    await createFacebookDrafts({
      ownerEmail,
      topicHint: typeof topicHint === "string" ? topicHint.trim() || null : null,
      settings,
      drafts,
    });

    revalidatePath("/cabinet/facebook");
    redirectToFacebookState("drafts-generated");
  } catch (error) {
    console.error("Failed to generate Facebook drafts", error);
    redirectToFacebookState("drafts-failed");
  }
}

export async function deleteFacebookDraftAction(formData: FormData) {
  const ownerEmail = await requireOwnerEmail();
  const draftId = formData.get("draftId");

  if (typeof draftId !== "string") {
    return;
  }

  await deleteFacebookDraft({
    ownerEmail,
    draftId,
  });

  revalidatePath("/cabinet/facebook");
  redirectToFacebookState("draft-deleted");
}
