import { NextResponse } from "next/server";
import { createScheduledPostDraftBatch } from "@/lib/post-queue";
import {
  listWebProjectsDueForPostGeneration,
  markWebProjectPostGenerationRun,
} from "@/lib/web-projects";

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
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const projects = await listWebProjectsDueForPostGeneration();
  const results: Array<{
    projectId: string;
    projectName: string;
    status: "generated" | "failed";
    detail: string;
  }> = [];

  for (const project of projects) {
    try {
      const batch = await createScheduledPostDraftBatch({
        project,
      });

      await markWebProjectPostGenerationRun(project.id);

      results.push({
        projectId: project.id,
        projectName: project.name,
        status: "generated",
        detail: `${batch.count} drafts (${batch.contentType})`,
      });
    } catch (error) {
      console.error("Scheduled post generation failed", {
        projectId: project.id,
        error,
      });
      results.push({
        projectId: project.id,
        projectName: project.name,
        status: "failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
