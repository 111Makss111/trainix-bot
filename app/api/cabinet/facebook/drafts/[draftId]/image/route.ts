import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { draftId } = await context.params;
  const ownerEmail = session.user.email.trim().toLowerCase();
  const asset = await getFacebookDraftStoredImage({
    ownerEmail,
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
