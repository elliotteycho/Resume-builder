import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { HttpError, json, route } from "@/lib/hq/http";
import { getPostingView, listPostingViews, saveJdAnalysis, upsertPosting } from "@/lib/hq/repo";
import { analyzeJobDescription } from "@/lib/pipeline/analyze";
import { extractEligibility } from "@/lib/pipeline/eligibility";
import { HQ_CONFIG } from "@/lib/hq/config";

export const runtime = "nodejs";
export const maxDuration = 300;

export const GET = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const params = req.nextUrl.searchParams;
  const items = await listPostingViews(userId, {
    season: params.get("season") ?? undefined,
    status: params.get("status") ?? undefined,
    q: params.get("q") ?? undefined,
  });
  return json({ items });
});

/**
 * Contribute a posting by pasting its job description.
 *
 * Enrichment runs once here and lands on the shared row: the analysis and the
 * eligibility criteria are read by every user who ever looks at this posting,
 * so a JD is never analyzed twice.
 */
export const POST = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const body = (await req.json()) as {
    jd_text?: string;
    company?: string;
    program?: string;
    url?: string;
    portal?: string;
    season?: string;
  };

  const jdText = body.jd_text?.trim();
  if (!jdText || jdText.length < 40) {
    throw new HttpError("missing_jd", "Paste the full job description.");
  }

  const analysis = await analyzeJobDescription(jdText);

  const { posting } = await upsertPosting({
    companyName: body.company?.trim() || analysis.company.name,
    program: body.program?.trim() || analysis.role.title,
    season: body.season ?? HQ_CONFIG.defaultSeason,
    url: body.url,
    portal: body.portal,
    jdText,
    status: "open",
    submittedBy: userId,
    source: "user",
  });

  const eligibility = await extractEligibility(jdText);
  await saveJdAnalysis(posting.id, analysis, eligibility);

  return json({ posting: await getPostingView(userId, posting.id) }, 201);
});
