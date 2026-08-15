import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, notFound, pick, route } from "@/lib/hq/http";
import { getPostingView, patchApplication } from "@/lib/hq/repo";
import type { Application } from "@/lib/hq/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = ["stage", "tier", "applied_date", "next_action", "resume_version_id"] as const;

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const application = await patchApplication(
    userId,
    id,
    pick<Application, (typeof EDITABLE)[number]>(body, EDITABLE)
  );
  if (!application) throw notFound("Application");

  return json({
    application,
    posting: await getPostingView(userId, application.posting_id),
  });
});
