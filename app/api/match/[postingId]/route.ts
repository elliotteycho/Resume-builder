import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, notFound, route } from "@/lib/hq/http";
import { ensureMatch } from "@/lib/hq/matching";
import { getPostingView, getProfile, listCards } from "@/lib/hq/repo";
import { chargeUsage } from "@/lib/hq/usage";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ postingId: string }> };

export const POST = route(async (req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { postingId } = await params;
  const force = req.nextUrl.searchParams.get("force") === "1";

  const [view, profile, cards] = await Promise.all([
    getPostingView(userId, postingId),
    getProfile(userId),
    listCards(userId),
  ]);
  if (!view) throw notFound("Posting");

  return json({
    match: await ensureMatch(userId, view, profile, cards, {
      force,
      beforeModelCall: () => chargeUsage(userId, "match"),
    }),
  });
});
