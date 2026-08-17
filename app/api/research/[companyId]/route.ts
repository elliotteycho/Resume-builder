import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, notFound, route } from "@/lib/hq/http";
import { MODEL } from "@/lib/anthropic";
import { buildCompanyBrief } from "@/lib/pipeline/companyBrief";
import {
  getCompany,
  getProfile,
  getResearchBrief,
  listPostingViews,
  saveResearchBrief,
} from "@/lib/hq/repo";
import { chargeUsage } from "@/lib/hq/usage";

export const runtime = "nodejs";
export const maxDuration = 600;

type Ctx = { params: Promise<{ companyId: string }> };

/** The cached brief, if this user has already researched this company. */
export const GET = route(async (_req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { companyId } = await params;
  return json({ brief: await getResearchBrief(userId, companyId) });
});

/**
 * Research a company for this specific student: what they do, how they hire,
 * where the school connection is, and who to reach out to.
 *
 * Never cached across users — the school angle and the networking plan are
 * personal, and the "recent developments" section is time-sensitive by nature.
 */
export const POST = route(async (_req: NextRequest, { params }: Ctx) => {
  const userId = await currentUserId();
  const { companyId } = await params;

  const [company, profile] = await Promise.all([getCompany(companyId), getProfile(userId)]);
  if (!company) throw notFound("Company");

  await chargeUsage(userId, "brief");

  const views = await listPostingViews(userId);
  const program =
    views.find((v) => v.company_id === companyId)?.program ??
    profile.target_role ??
    "internship";

  const brief = await buildCompanyBrief(company.name, program, profile);

  return json({
    brief: await saveResearchBrief({
      user_id: userId,
      company_id: companyId,
      brief,
      model: MODEL,
      created_at: new Date().toISOString(),
    }),
  });
});
