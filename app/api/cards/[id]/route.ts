import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, notFound, route } from "@/lib/hq/http";
import { deleteCard, saveCard } from "@/lib/hq/repo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route(async (req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { id } = await params;
  const body = await req.json();
  return json({ card: await saveCard(userId, { ...body, id }) });
});

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { id } = await params;
  if (!(await deleteCard(userId, id))) throw notFound("Card");
  return json({ deleted: id });
});
