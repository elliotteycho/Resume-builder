import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { HttpError, json, route } from "@/lib/hq/http";
import { createContact, listContacts } from "@/lib/hq/repo";

export const runtime = "nodejs";

export const GET = route(async () => {
  const userId = await currentUserId();
  return json({ contacts: await listContacts(userId) });
});

export const POST = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const body = await req.json();
  if (!body?.name?.trim()) throw new HttpError("missing_name", "A contact needs a name.");
  return json({ contact: await createContact(userId, body) }, 201);
});
