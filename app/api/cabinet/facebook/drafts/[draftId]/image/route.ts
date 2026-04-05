import { getOwnerAccessState } from "@/lib/auth-guards";
import { getFacebookDraftStoredImage } from "@/lib/social/facebook";

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

function parseDataImageUrl(value: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

export async function GET(_: Request, context: RouteContext) {
  const access = await getOwnerAccessState();

  if (!access.isOwner || !access.email || !access.twoFactorVerified) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { draftId } = await context.params;
  const asset = await getFacebookDraftStoredImage({
    ownerEmail: access.email,
    draftId,
  });

  if (!asset?.image_url) {
    return new Response("Not found", { status: 404 });
  }

  if (/^https?:\/\//i.test(asset.image_url)) {
    return Response.redirect(asset.image_url, 302);
  }

  const parsed = parseDataImageUrl(asset.image_url);

  if (!parsed) {
    return new Response("Unsupported image source", { status: 415 });
  }

  return new Response(Buffer.from(parsed.base64, "base64"), {
    status: 200,
    headers: {
      "Content-Type": parsed.mimeType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
