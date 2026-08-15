import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, notFound, route } from "@/lib/hq/http";
import { getPostingView, setPostingStatus } from "@/lib/hq/repo";
import type { Posting } from "@/lib/hq/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { id } = await params;
  const posting = await getPostingView(userId, id);
  if (!posting) throw notFound("Posting");
  return json({ posting });
});

/**
 * Flip a posting's window state. This is shared-layer data — one user marking
 * a posting open is telling everyone the door is open.
 */
export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { id } = await params;
  const body = (await req.json()) as { status?: Posting["status"] };
  if (body.status) await setPostingStatus(id, body.status);
  const posting = await getPostingView(userId, id);
  if (!posting) throw notFound("Posting");
  return json({ posting });
});
