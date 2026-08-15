import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, route } from "@/lib/hq/http";
import { listCards, saveCard } from "@/lib/hq/repo";

export const runtime = "nodejs";

export const GET = route(async () => {
  const userId = await currentUserId();
  return json({ cards: await listCards(userId) });
});

export const POST = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const body = await req.json();
  return json({ card: await saveCard(userId, body) }, 201);
});
