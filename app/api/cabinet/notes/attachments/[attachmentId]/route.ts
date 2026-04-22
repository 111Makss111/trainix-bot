import { NextResponse } from "next/server";
import { requireOwnerEmail } from "@/lib/auth-guards";
import { getPlanAttachmentById } from "@/lib/plans";

export const runtime = "nodejs";

function encodeContentDispositionFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const ownerEmail = await requireOwnerEmail();
  const { attachmentId } = await context.params;
  const attachment = await getPlanAttachmentById({
    ownerEmail,
    attachmentId,
  });

  if (!attachment) {
    return new NextResponse("Not found", {
      status: 404,
    });
  }

  const buffer = Buffer.from(attachment.content_base64, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeContentDispositionFileName(
        attachment.file_name,
      )}`,
      "Content-Length": String(buffer.length),
      "Content-Type": attachment.mime_type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
