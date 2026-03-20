const FACEBOOK_GRAPH_API_VERSION =
  process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v23.0";

const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;

type FacebookGraphErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export class FacebookGraphApiError extends Error {
  code?: number;
  type?: string;
  subcode?: number;
  traceId?: string;

  constructor(message: string, payload?: FacebookGraphErrorPayload) {
    super(message);
    this.name = "FacebookGraphApiError";
    this.code = payload?.error?.code;
    this.type = payload?.error?.type;
    this.subcode = payload?.error?.error_subcode;
    this.traceId = payload?.error?.fbtrace_id;
  }
}

function buildGraphApiUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return `${FACEBOOK_GRAPH_API_BASE}${normalizedPath}`;
}

async function parseFacebookGraphResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & FacebookGraphErrorPayload) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error?.message || "Facebook Graph API request failed"
        : "Facebook Graph API request failed";

    throw new FacebookGraphApiError(message, payload ?? undefined);
  }

  return (payload ?? {}) as T;
}

function decodeDataImageUrl(dataUrl: string) {
  const match = dataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i,
  );

  if (!match) {
    throw new Error("Invalid image data URL");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function fileNameFromMimeType(mimeType: string) {
  const extension = mimeType.split("/")[1]?.toLowerCase() || "png";

  return `facebook-post.${extension === "jpeg" ? "jpg" : extension}`;
}

export async function fetchFacebookPageProfile(input: {
  pageId: string;
  pageAccessToken: string;
}) {
  const url = new URL(buildGraphApiUrl(`/${input.pageId}`));
  url.searchParams.set("fields", "id,name,category,link,picture{url}");
  url.searchParams.set("access_token", input.pageAccessToken);

  return parseFacebookGraphResponse<{
    id: string;
    name?: string;
    category?: string;
    link?: string;
    picture?: {
      data?: {
        url?: string;
      };
    };
  }>(await fetch(url, { method: "GET", cache: "no-store" }));
}

export async function createFacebookFeedPost(input: {
  pageId: string;
  pageAccessToken: string;
  message: string;
}) {
  const body = new URLSearchParams();
  body.set("message", input.message);
  body.set("access_token", input.pageAccessToken);

  const response = await fetch(buildGraphApiUrl(`/${input.pageId}/feed`), {
    method: "POST",
    body,
    cache: "no-store",
  });

  return parseFacebookGraphResponse<{
    id?: string;
  }>(response);
}

export async function createFacebookPhotoPost(input: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  imageUrl: string;
}) {
  if (input.imageUrl.startsWith("data:image/")) {
    const image = decodeDataImageUrl(input.imageUrl);
    const formData = new FormData();

    formData.set("caption", input.caption);
    formData.set("access_token", input.pageAccessToken);
    formData.set("published", "true");
    formData.set(
      "source",
      new Blob([image.buffer], {
        type: image.mimeType,
      }),
      fileNameFromMimeType(image.mimeType),
    );

    const response = await fetch(buildGraphApiUrl(`/${input.pageId}/photos`), {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    return parseFacebookGraphResponse<{
      id?: string;
      post_id?: string;
    }>(response);
  }

  const body = new URLSearchParams();
  body.set("url", input.imageUrl);
  body.set("caption", input.caption);
  body.set("published", "true");
  body.set("access_token", input.pageAccessToken);

  const response = await fetch(buildGraphApiUrl(`/${input.pageId}/photos`), {
    method: "POST",
    body,
    cache: "no-store",
  });

  return parseFacebookGraphResponse<{
    id?: string;
    post_id?: string;
  }>(response);
}
