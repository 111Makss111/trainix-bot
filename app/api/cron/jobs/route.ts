import { NextResponse } from "next/server";
import { refreshDueJobScans } from "@/lib/jobs";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization")?.trim() || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const results = await refreshDueJobScans();
    const created = results.reduce((sum, item) => sum + item.created, 0);
    const alerted = results.reduce((sum, item) => sum + item.alerted, 0);

    return new NextResponse(
      `OK owners=${results.length} created=${created} alerted=${alerted}`,
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Jobs cron failed",
      { status: 500 },
    );
  }
}
