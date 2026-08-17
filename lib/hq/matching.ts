import { HQ_CONFIG } from "@/lib/hq/config";
import { buildMatchView } from "@/lib/hq/bank";
import { daysSince } from "@/lib/hq/dates";
import { checkEligibility } from "@/lib/hq/eligibility";
import { analyzeJobDescription } from "@/lib/pipeline/analyze";
import { extractEligibility } from "@/lib/pipeline/eligibility";
import { scoreMatch } from "@/lib/pipeline/match";
import { MODEL } from "@/lib/anthropic";
import { HttpError } from "@/lib/hq/http";
import { getMatch, saveJdAnalysis, saveMatch } from "@/lib/hq/repo";
import type {
  ExperienceCardWithEvidence,
  Match,
  PostingView,
  Profile,
} from "@/lib/hq/types";

/**
 * Score one posting against one profile, with every shortcut taken that can be
 * taken safely:
 *
 *   1. A fresh cached match is returned as-is — no model call.
 *   2. The JD is analyzed at most once ever, on the shared posting row.
 *   3. A deterministic eligibility failure short-circuits before any model call.
 *
 * Only a posting the user is actually eligible for, with no usable cache,
 * costs a request.
 */
export async function ensureMatch(
  userId: string,
  view: PostingView,
  profile: Profile,
  cards: ExperienceCardWithEvidence[],
  opts: {
    force?: boolean;
    /**
     * Runs only when a scoring call is actually about to be made — after the
     * cache and the eligibility gate have had their chance to short-circuit.
     * This is where the quota charge lives, so a cached or gated match never
     * costs a quota slot.
     */
    beforeModelCall?: () => Promise<void>;
  } = {}
): Promise<Match> {
  if (!opts.force) {
    const cached = await getMatch(userId, view.id);
    const age = cached ? daysSince(cached.computed_at.slice(0, 10)) : null;
    if (
      cached &&
      !cached.stale &&
      cached.model === MODEL &&
      (age === null || age < HQ_CONFIG.matchMaxAgeDays)
    ) {
      return cached;
    }
  }

  // Analyze once, share forever. A posting contributed with a JD but never
  // scored reaches this branch on the first user who asks for a match.
  let analysis = view.jd_analysis;
  let eligibility = view.eligibility;
  if (view.jd_text && (!analysis || !eligibility)) {
    [analysis, eligibility] = await Promise.all([
      analysis ?? analyzeJobDescription(view.jd_text),
      eligibility ?? extractEligibility(view.jd_text),
    ]);
    await saveJdAnalysis(view.id, analysis, eligibility);
  }

  const gate = checkEligibility(profile, eligibility);

  if (!gate.pass) {
    return saveMatch({
      user_id: userId,
      posting_id: view.id,
      score: 0,
      verdict: "skip",
      eligibility_pass: false,
      blockers: gate.blockers,
      warnings: gate.warnings,
      headline: gate.blockers[0] ?? "Not eligible for this posting.",
      reasons: [],
      gaps: [],
      model: MODEL,
      computed_at: new Date().toISOString(),
      stale: false,
    });
  }

  if (!analysis) {
    throw new HttpError(
      "no_jd",
      `No job description captured for ${view.company.name} yet — paste it in to score this posting.`
    );
  }

  const { cards: matchCards } = buildMatchView(profile, cards);
  if (!matchCards.length) {
    throw new HttpError(
      "no_cards",
      "Import your resume or add an experience card before matching."
    );
  }

  if (opts.beforeModelCall) await opts.beforeModelCall();

  const summary = [
    profile.name,
    profile.school ? `${profile.school}${profile.majors.length ? `, ${profile.majors.join(" / ")}` : ""}` : "",
    profile.grad_year ? `Graduating ${profile.grad_year}` : "",
    profile.target_role ? `Targeting ${profile.target_role}` : "",
    profile.summary,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await scoreMatch(analysis, matchCards, summary);

  return saveMatch({
    user_id: userId,
    posting_id: view.id,
    score: result.score,
    verdict: verdictFor(result.score),
    eligibility_pass: true,
    blockers: [],
    warnings: gate.warnings,
    headline: result.headline,
    reasons: result.reasons,
    gaps: result.gaps,
    model: MODEL,
    computed_at: new Date().toISOString(),
    stale: false,
  });
}

/**
 * The verdict is derived from the score in code, not asked of the model — so
 * moving the bar is a config change, not a prompt rewrite.
 */
export function verdictFor(score: number): Match["verdict"] {
  if (score >= HQ_CONFIG.matchThresholds.apply) return "apply";
  if (score >= HQ_CONFIG.matchThresholds.review) return "review";
  return "skip";
}
