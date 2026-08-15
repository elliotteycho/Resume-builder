import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { HttpError, json, route } from "@/lib/hq/http";
import { saveCompanyNote } from "@/lib/hq/repo";

export const runtime = "nodejs";

/** One note per company per user — saving replaces it rather than appending. */
export const POST = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const body = (await req.json()) as { company_id?: string; body?: string };
  if (!body.company_id) throw new HttpError("missing_company", "company_id is required.");
  return json({ note: await saveCompanyNote(userId, body.company_id, body.body ?? "") });
});
