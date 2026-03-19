import { NextResponse } from "next/server";
import { createScheduledPostDraftBatch } from "@/lib/post-queue";
import {
  listWebProjectsDueForPostGeneration,
  markWebProjectPostGenerationRun,
} from "@/lib/web-projects";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization") || "";

  return authorization === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  try {
    const projects = await listWebProjectsDueForPostGeneration();
    let generated = 0;
    let failed = 0;

    for (const project of projects) {
      try {
        await createScheduledPostDraftBatch({
          project,
        });

        await markWebProjectPostGenerationRun(project.id);
        generated += 1;
      } catch (error) {
        failed += 1;
        console.error("Scheduled post generation failed", {
          projectId: project.id,
          error,
        });
      }
    }

    return new NextResponse(
      `OK processed=${projects.length} generated=${generated} failed=${failed}`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  } catch (error) {
    console.error("Scheduled post generation route failed", error);

    return new NextResponse("Error", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
