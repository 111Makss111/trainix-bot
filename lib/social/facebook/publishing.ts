import { createFacebookFeedPost, createFacebookPhotoPost } from "./api";
import type { FacebookPageConnection } from "./connection";
import type { FacebookPublishableDraft } from "./drafts";

function compactMessageParts(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function buildFacebookPostMessage(draft: FacebookPublishableDraft) {
  return compactMessageParts([draft.title, draft.hook, draft.body, draft.cta]);
}

export async function publishFacebookDraft(input: {
  draft: FacebookPublishableDraft;
  connection: Pick<FacebookPageConnection, "pageId"> & {
    pageAccessToken: string;
  };
}) {
  const message = buildFacebookPostMessage(input.draft);

  if (!input.connection.pageId) {
    throw new Error("Facebook Page is not configured");
  }

  if (input.draft.storedImageUrl) {
    const photoResult = await createFacebookPhotoPost({
      pageId: input.connection.pageId,
      pageAccessToken: input.connection.pageAccessToken,
      caption: message,
      imageUrl: input.draft.storedImageUrl,
    });

    return {
      publishedPostId: photoResult.post_id || photoResult.id || null,
      publishedType: "photo" as const,
    };
  }

  const feedResult = await createFacebookFeedPost({
    pageId: input.connection.pageId,
    pageAccessToken: input.connection.pageAccessToken,
    message,
  });

  return {
    publishedPostId: feedResult.id || null,
    publishedType: "feed" as const,
  };
}
