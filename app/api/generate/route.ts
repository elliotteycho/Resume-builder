import { NextRequest } from "next/server";
import { analyzeJobDescription } from "@/lib/pipeline/analyze";
import { runResearch } from "@/lib/pipeline/research";
import { reframeSynthesis } from "@/lib/pipeline/reframe";
import { synthesizeResume } from "@/lib/pipeline/synthesize";
import { verifyAndFix } from "@/lib/pipeline/verify";
import { buildGeneratorView, buildMetricAudit } from "@/lib/evidence";
import { loadBank } from "@/lib/experienceStore";
import { currentUserId } from "@/lib/hq/auth";
import { cardsToBank } from "@/lib/hq/bank";
import {
  getPostingView,
  getProfile,
  listCards,
  saveJdAnalysis,
  saveResumeVersion,
} from "@/lib/hq/repo";
import { extractEligibility } from "@/lib/pipeline/eligibility";
import { HttpError } from "@/lib/hq/http";
import { chargeUsage } from "@/lib/hq/usage";
import type { ExperienceBank, JobAnalysis, ProgressEvent } from "@/lib/types";

export const runtime = "nodejs";
// The full pipeline (analysis → parallel web research → reframe → synthesis
// → verification) can take several minutes.
export const maxDuration = 600;

/**
 * The user's experience cards are the bank. The legacy JSON file is only a
 * fallback for someone who has not imported a resume yet, so the standalone
 * generator keeps working out of the box.
 */
async function loadBankFor(userId: string): Promise<ExperienceBank> {
  const [profile, cards] = await Promise.all([getProfile(userId), listCards(userId)]);
  if (!cards.length) return loadBank();
  return cardsToBank(profile, cards);
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await currentUserId();
    // The full pipeline is the most expensive call in the app; the quota is
    // checked before the stream opens so a refusal is a clean 429, not a
    // half-open stream.
    await chargeUsage(userId, "generate");
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }
  const { jobDescription, postingId, guidance } = await req.json();

  // A posting id supplies the JD (and its cached analysis) from the shared
  // database; a pasted description still works for one-off generations.
  const posting =
    typeof postingId === "string" ? await getPostingView(userId, postingId) : null;
  const jd: string = posting?.jd_text || jobDescription;

  if (!jd || typeof jd !== "string" || jd.trim().length < 40) {
    return new Response(
      JSON.stringify({
        error: posting
          ? `No job description captured for ${posting.company.name} yet — paste it in first.`
          : "Please paste a full job description.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const userGuidance = typeof guidance === "string" ? guidance : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: ProgressEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected mid-stream; keep the pipeline from crashing
          closed = true;
        }
      };

      try {
        // The analyze stage is skipped when the shared posting already carries
        // an analysis. Research is never skipped — it is time-sensitive.
        send({
          type: "stage",
          stage: "analyzing",
          detail: posting?.jd_analysis
            ? "Reusing this posting's cached analysis"
            : "Reading the posting twice — for what they wrote, and what they need",
        });
        const [analysis, bank] = await Promise.all([
          posting?.jd_analysis
            ? Promise.resolve(posting.jd_analysis as JobAnalysis)
            : analyzeJobDescription(jd),
          loadBankFor(userId),
        ]);
        send({ type: "analysis", analysis });

        if (posting && !posting.jd_analysis) {
          // Cache it for everyone, including the eligibility criteria.
          void extractEligibility(jd)
            .then((eligibility) => saveJdAnalysis(posting.id, analysis, eligibility))
            .catch(() => undefined);
        }

        // Retrieval decides the facts: low-confidence evidence and untagged
        // numbers never reach any prompt.
        const view = buildGeneratorView(bank);

        send({
          type: "stage",
          stage: "researching",
          detail: `Researching ${analysis.company.name} and the ${analysis.role.title} market`,
        });
        const research = await runResearch(analysis, (agent, status) => {
          send({ type: "agent", agent, status });
        });

        send({ type: "stage", stage: "reframing", detail: "Fusing the posting and research into a reframing map" });
        const reframe = await reframeSynthesis(analysis, research, view.visibleBank, userGuidance);
        send({ type: "reframe", reframe });

        send({ type: "stage", stage: "synthesizing", detail: "Writing bullets that embody the themes" });
        const draft = await synthesizeResume(analysis, research, reframe, view.visibleBank, userGuidance);

        send({ type: "stage", stage: "verifying", detail: "Checking hard rules: verbatim metrics, unique verbs, no lifted phrases" });
        const { resume, report } = await verifyAndFix(draft, jd, {
          allowedTokens: view.allowedTokens,
          evidenceLines: view.evidenceLines,
        });

        const metricAudit = buildMetricAudit(resume, view.evidenceIndex);

        // Persist so the tracker can show which resume version was submitted.
        await saveResumeVersion({
          user_id: userId,
          posting_id: posting?.id ?? null,
          label: posting
            ? `${posting.company.name} — ${posting.program}`
            : analysis.company.name,
          resume,
          reframe,
          verification: report,
          metric_audit: metricAudit,
          created_at: new Date().toISOString(),
        });

        send({
          type: "result",
          resume,
          research,
          reframe,
          verification: report,
          metric_audit: metricAudit,
        });
        send({ type: "stage", stage: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        send({ type: "error", message });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed by the runtime on disconnect
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
