import { NextRequest } from "next/server";
import { analyzeJobDescription } from "@/lib/pipeline/analyze";
import { runResearch } from "@/lib/pipeline/research";
import { synthesizeResume } from "@/lib/pipeline/synthesize";
import { loadBank } from "@/lib/experienceStore";
import type { ProgressEvent } from "@/lib/types";

export const runtime = "nodejs";
// The full pipeline (analysis → parallel web research → synthesis) can take several minutes.
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const { jobDescription } = await req.json();

  if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 40) {
    return new Response(JSON.stringify({ error: "Please paste a full job description." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        send({ type: "stage", stage: "analyzing", detail: "Parsing the job description" });
        const [analysis, bank] = await Promise.all([
          analyzeJobDescription(jobDescription),
          loadBank(),
        ]);
        send({ type: "analysis", analysis });

        send({
          type: "stage",
          stage: "researching",
          detail: `Researching ${analysis.company.name} and the ${analysis.role.title} market`,
        });
        const research = await runResearch(analysis, (agent, status) => {
          send({ type: "agent", agent, status });
        });

        send({ type: "stage", stage: "synthesizing", detail: "Writing your tailored resume" });
        const resume = await synthesizeResume(analysis, research, bank);

        send({ type: "result", resume, research });
        send({ type: "stage", stage: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        send({ type: "error", message });
      } finally {
        controller.close();
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
