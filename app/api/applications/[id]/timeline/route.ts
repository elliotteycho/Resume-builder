import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, notFound, route } from "@/lib/hq/http";
import { getTimeline } from "@/lib/hq/repo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { id } = await params;
  const timeline = await getTimeline(userId, id);
  if (!timeline) throw notFound("Application");
  return json(timeline);
});
