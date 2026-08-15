import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, notFound, pick, route } from "@/lib/hq/http";
import { deleteContact, patchContact } from "@/lib/hq/repo";
import type { Contact } from "@/lib/hq/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = [
  "name",
  "role",
  "company_name",
  "company_id",
  "channel",
  "linkedin_url",
  "angle",
  "kind",
  "status",
  "notes",
] as const;

export const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const contact = await patchContact(
    userId,
    id,
    pick<Contact, (typeof EDITABLE)[number]>(body, EDITABLE)
  );
  if (!contact) throw notFound("Contact");
  return json({ contact });
});

export const DELETE = route(async (_req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { id } = await params;
  if (!(await deleteContact(userId, id))) throw notFound("Contact");
  return json({ deleted: id });
});
