import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { HttpError, json, route } from "@/lib/hq/http";
import { buildQueue, summarize } from "@/lib/hq/queue";
import { ensureApplication, getPostingView, listContacts, listPostingViews } from "@/lib/hq/repo";
import { HQ_CONFIG } from "@/lib/hq/config";

export const runtime = "nodejs";

/**
 * The whole board in one response: every posting joined with this user's
 * application, match, contacts and notes, plus the derived "do next" queue.
 *
 * The queue is computed here on every read rather than stored, so a threshold
 * change in `HQ_CONFIG` takes effect immediately with nothing to migrate.
 */
export const GET = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const season = req.nextUrl.searchParams.get("season") ?? undefined;

  const [items, contacts] = await Promise.all([
    listPostingViews(userId, { season }),
    listContacts(userId),
  ]);

  return json({
    items,
    contacts,
    queue: buildQueue(items, contacts),
    summary: summarize(items, contacts),
    config: {
      statusCheckDays: HQ_CONFIG.statusCheckDays,
      followUpDays: HQ_CONFIG.followUpDays,
      contactsPerCompany: HQ_CONFIG.contactsPerCompany,
    },
  });
});

export const POST = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const body = (await req.json()) as { posting_id?: string; tier?: number };
  if (!body.posting_id) throw new HttpError("missing_posting", "posting_id is required.");

  const application = await ensureApplication(userId, body.posting_id, body.tier);
  return json({ application, posting: await getPostingView(userId, body.posting_id) }, 201);
});
