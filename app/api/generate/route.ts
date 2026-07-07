import { NextRequest } from "next/server";
import { analyzeJobDescription } from "@/lib/pipeline/analyze";
import { runResearch } from "@/lib/pipeline/research";
import { reframeSynthesis } from "@/lib/pipeline/reframe";
import { synthesizeResume } from "@/lib/pipeline/synthesize";
import { verifyAndFix } from "@/lib/pipeline/verify";
import { buildGeneratorView, buildMetricAudit } from "@/lib/evidence";
import { loadBank } from "@/lib/experienceStore";
import type { ProgressEvent } from "@/lib/types";

export const runtime = "nodejs";
// The full pipeline (analysis → parallel web research → reframe → synthesis
// → verification) can take several minutes.
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const { jobDescription, guidance } = await req.json();

  if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 40) {
    return new Response(JSON.stringify({ error: "Please paste a full job description." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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
        send({ type: "stage", stage: "analyzing", detail: "Reading the posting twice — for what they wrote, and what they need" });
        const [analysis, bank] = await Promise.all([
          analyzeJobDescription(jobDescription),
          loadBank(),
        ]);
        send({ type: "analysis", analysis });

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
        const { resume, report } = await verifyAndFix(draft, jobDescription, {
          allowedTokens: view.allowedTokens,
          evidenceLines: view.evidenceLines,
        });

        send({
          type: "result",
          resume,
          research,
          reframe,
          verification: report,
          metric_audit: buildMetricAudit(resume, view.evidenceIndex),
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
