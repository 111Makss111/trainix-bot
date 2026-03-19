import {
  createWebPostDrafts,
  listRecentPublishedPostSourceKeys,
  type WebProject,
} from "./web-projects";
import {
  fetchPostSource,
  generatePostDrafts,
  isPostContentType,
  type PostContentType,
} from "./post-studio";

function resolveScheduledContentType(mode: string): PostContentType {
  if (isPostContentType(mode)) {
    return mode;
  }

  return Math.random() > 0.5 ? "workout" : "recipe";
}

export async function createPostDraftBatchForProject(input: {
  project: WebProject;
  contentType: PostContentType;
  topicHint?: string | null;
}) {
  const topicHint =
    typeof input.topicHint === "string" && input.topicHint.trim()
      ? input.topicHint.trim()
      : null;
  const recentSourceKeys = await listRecentPublishedPostSourceKeys({
    projectId: input.project.id,
    contentType: input.contentType,
    limit: 36,
  });
  const source = await fetchPostSource({
    contentType: input.contentType,
    topicHint,
    recentSourceKeys,
  });

  if (!source) {
    throw new Error("No suitable source was found for post generation");
  }

  const drafts = await generatePostDrafts({
    project: input.project,
    contentType: input.contentType,
    topicHint,
    source,
  });

  await createWebPostDrafts({
    projectId: input.project.id,
    contentType: input.contentType,
    topicHint,
    sourceKind: source.sourceKind,
    sourceKey: source.sourceKey,
    sourceTitle: source.sourceTitle,
    sourceUrl: source.sourceUrl,
    sourcePayload: source.sourcePayload,
    drafts: drafts.map((draft) => ({
      title: draft.title,
      caption: draft.caption,
      imageUrl: draft.imageUrl ?? source.imageUrl,
      imageAlt: draft.imageAlt || source.imageAlt,
      imageCreditName: draft.imageCreditName ?? source.imageCreditName,
      imageCreditUrl: draft.imageCreditUrl ?? source.imageCreditUrl,
      imageSource: draft.imageSource ?? source.imageSource,
    })),
  });

  return {
    contentType: input.contentType,
    count: drafts.length,
    sourceKind: source.sourceKind,
    sourceKey: source.sourceKey,
  };
}

export async function createScheduledPostDraftBatch(input: {
  project: WebProject;
}) {
  return createPostDraftBatchForProject({
    project: input.project,
    contentType: resolveScheduledContentType(
      input.project.postGenerationContentType,
    ),
    topicHint: null,
  });
}
