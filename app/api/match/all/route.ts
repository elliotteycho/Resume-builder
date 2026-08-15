import { currentUserId } from "@/lib/hq/auth";
import { ensureMatch } from "@/lib/hq/matching";
import { getProfile, listCards, listPostingViews } from "@/lib/hq/repo";

export const runtime = "nodejs";
export const maxDuration = 600;

type BatchEvent =
  | { type: "start"; total: number }
  | { type: "progress"; done: number; total: number; company: string; score: number | null; verdict: string }
  | { type: "skipped"; company: string; reason: string }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Score every posting that has a job description captured, streaming progress.
 *
 * Postings without a JD are reported as skipped rather than silently dropped —
 * "nothing came back for Meta" should tell you Meta has no posting text yet,
 * not leave you wondering.
 */
export async function POST() {
  const userId = await currentUserId();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: BatchEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const [views, profile, cards] = await Promise.all([
          listPostingViews(userId),
          getProfile(userId),
          listCards(userId),
        ]);

        const scorable = views.filter((v) => v.jd_text || v.jd_analysis);
        send({ type: "start", total: scorable.length });

        for (const v of views) {
          if (!v.jd_text && !v.jd_analysis) {
            send({
              type: "skipped",
              company: v.company.name,
              reason: "No job description captured yet",
            });
          }
        }

        let done = 0;
        for (const view of scorable) {
          try {
            const match = await ensureMatch(userId, view, profile, cards);
            done++;
            send({
              type: "progress",
              done,
              total: scorable.length,
              company: view.company.name,
              score: match.score,
              verdict: match.verdict,
            });
          } catch (err) {
            done++;
            send({
              type: "skipped",
              company: view.company.name,
              reason: err instanceof Error ? err.message : "Match failed",
            });
          }
        }

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Batch failed" });
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
