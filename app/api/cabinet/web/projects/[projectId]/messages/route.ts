import { NextResponse } from "next/server";
import { getOwnerAccessState } from "@/lib/auth-guards";
import { listRecentTelegramMessagesForProject } from "@/lib/web-projects";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const access = await getOwnerAccessState();

  if (!access.isOwner || !access.email || !access.twoFactorVerified) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { projectId } = await context.params;
  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 50)
    : 20;

  const messages = await listRecentTelegramMessagesForProject({
    ownerEmail: access.email,
    projectId,
    limit,
  });

  return NextResponse.json(
    {
      ok: true,
      messages,
      refreshedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
