"use client";

import { useRef, useState } from "react";
import ResumeView, { resumeToMarkdown } from "@/components/ResumeView";
import type {
  JobAnalysis,
  MetricAuditEntry,
  ProgressEvent,
  Reframe,
  ResearchFindings,
  Resume,
  VerificationReport,
} from "@/lib/types";

type AgentName = "company" | "market" | "conventions";
type AgentStates = Record<AgentName, "idle" | "running" | "done">;

const AGENT_LABELS: Record<AgentName, string> = {
  company: "Company intel agent — news, products, culture, voice",
  market: "Role & market agent — current demand and trends",
  conventions: "Conventions agent — how resumes work in this industry",
};

const STAGES = ["analyzing", "researching", "reframing", "synthesizing", "verifying", "done"] as const;
const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  analyzing: "Analyzing the job description — themes, not just keywords",
  researching: "Researching in parallel",
  reframing: "Reframe synthesis — fusing posting and research into a build brief",
  synthesizing: "Writing bullets that embody the themes",
  verifying: "Verifying hard rules (unique verbs, no lifted phrases, clean punctuation)",
  done: "Done",
};

export default function GeneratePage() {
  const [jd, setJd] = useState("");
  const [guidance, setGuidance] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStates>({ company: "idle", market: "idle", conventions: "idle" });
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [reframe, setReframe] = useState<Reframe | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [research, setResearch] = useState<ResearchFindings | null>(null);
  const [verification, setVerification] = useState<VerificationReport | null>(null);
  const [metricAudit, setMetricAudit] = useState<MetricAuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setResume(null);
    setResearch(null);
    setAnalysis(null);
    setReframe(null);
    setVerification(null);
    setMetricAudit([]);
    setStage("analyzing");
    setAgents({ company: "idle", market: "idle", conventions: "idle" });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jd, guidance }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          const event: ProgressEvent = JSON.parse(line.slice(6));
          handleEvent(event);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function handleEvent(event: ProgressEvent) {
    switch (event.type) {
      case "stage":
        setStage(event.stage);
        break;
      case "agent":
        setAgents((prev) => ({ ...prev, [event.agent]: event.status }));
        break;
      case "analysis":
        setAnalysis(event.analysis);
        break;
      case "reframe":
        setReframe(event.reframe);
        break;
      case "result":
        setResume(event.resume);
        setResearch(event.research);
        setReframe(event.reframe);
        setVerification(event.verification);
        setMetricAudit(event.metric_audit);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        break;
      case "error":
        setError(event.message);
        break;
    }
  }

  function downloadMarkdown() {
    if (!resume) return;
    const blob = new Blob([resumeToMarkdown(resume)], { type: "text/markdown" });
    triggerDownload(blob, "resume.md");
  }

  async function downloadDocx() {
    if (!resume) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, company: analysis?.company.name ?? "" }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      triggerDownload(blob, match?.[1] ?? "resume.docx");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const themeName = (id: string) => analysis?.themes.find((t) => t.id === id)?.name ?? id;
  const stageIndex = stage ? STAGES.indexOf(stage as (typeof STAGES)[number]) : -1;

  return (
    <div>
      <div className="no-print">
        <h1>Build a resume from a job description</h1>
        <p className="subtitle">
          Paste a posting. The app extracts the <em>themes</em> beneath the bullet list; runs three
          research agents simultaneously (company voice included); fuses everything into a
          reframing map; then rewrites your <a href="/experience">experience bank</a> to embody the
          themes — and verifies the output against hard rules.
        </p>

        <div className="card">
          <textarea
            className="jd-input"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            disabled={busy}
          />
          <div className="field" style={{ marginTop: 10 }}>
            <label>Optional guidance — overrides, emphasis, entries to include or avoid</label>
            <input
              type="text"
              placeholder='e.g. "lead with the data projects" or "skip the retail job"'
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" onClick={generate} disabled={busy || jd.trim().length < 40}>
              {busy ? "Working…" : "Generate tailored resume"}
            </button>
            {busy && <span style={{ fontSize: 13, color: "var(--muted)" }}>This can take a few minutes — research is thorough.</span>}
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {stage && (
          <div className="card progress">
            {STAGES.filter((s) => s !== "done").map((s, i) => (
              <div key={s}>
                <div className="stage-line">
                  <span className={`dot ${stageIndex === i && stage !== "done" ? "active" : stageIndex > i || stage === "done" ? "done" : ""}`} />
                  <span>{STAGE_LABELS[s]}</span>
                </div>
                {s === "analyzing" && analysis && (
                  <div className="analysis-chips">
                    <span className="chip">{analysis.company.name}</span>
                    <span className="chip">{analysis.role.title}</span>
                    <span className="chip">{analysis.role.seniority}</span>
                    <span className="chip">{analysis.company.industry}</span>
                    {analysis.themes.map((t) => (
                      <span className="chip theme" key={t.id} title={t.evidence}>
                        {t.id}: {t.name}
                      </span>
                    ))}
                  </div>
                )}
                {s === "researching" && stageIndex >= 1 && (
                  <div className="agents">
                    {(Object.keys(AGENT_LABELS) as AgentName[]).map((a) => (
                      <div key={a} className="stage-line">
                        <span className={`dot ${agents[a] === "running" ? "active" : agents[a] === "done" ? "done" : ""}`} />
                        <span>{AGENT_LABELS[a]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {resume && (
        <div ref={resultRef}>
          <div className="row no-print" style={{ margin: "20px 0 12px" }}>
            <button className="primary" onClick={downloadDocx} disabled={exporting}>
              {exporting ? "Exporting…" : "Download .docx"}
            </button>
            <button className="ghost" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
            <button className="ghost" onClick={downloadMarkdown}>
              Download Markdown
            </button>
          </div>

          <ResumeView resume={resume} />

          {verification && (
            <div className={`card no-print ${verification.passed ? "" : "verify-failed"}`} style={{ marginTop: 18 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>
                Verification {verification.passed ? "passed" : "— unresolved issues"}
                {verification.revised && (
                  <span style={{ fontWeight: 400, color: "var(--muted)" }}> (one automatic revision pass ran)</span>
                )}
              </h3>
              <ul className="verify-list">
                {verification.checks.map((c) => (
                  <li key={c.name} className={c.passed ? "ok" : c.severity === "fail" ? "fail" : "warn"}>
                    <span className="verify-mark">{c.passed ? "✓" : c.severity === "fail" ? "✗" : "!"}</span> {c.name}
                    {!c.passed && c.details.length > 0 && (
                      <ul>
                        {c.details.slice(0, 5).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card notes no-print">
            <h3>How this resume was tailored</h3>
            <p>{resume.tailoring_notes.strategy}</p>

            {reframe && (
              <>
                <details className="research">
                  <summary>Company beliefs &amp; voice</summary>
                  <div className="research-md">
                    {`Beliefs:\n${reframe.company_beliefs.map((b) => `• ${b}`).join("\n")}\n\nVoice — tone: ${reframe.voice.tone}\nAltitude: ${reframe.voice.altitude}\nRecurring vocabulary: ${reframe.voice.vocabulary.join(", ")}\nOne-liner: ${reframe.voice.one_liner}`}
                  </div>
                </details>
                <details className="research">
                  <summary>Demand vector</summary>
                  <div className="research-md">
                    {reframe.demands.map((d) => `[${d.tag.toUpperCase()}] ${d.demand}`).join("\n")}
                  </div>
                </details>
                <details className="research">
                  <summary>Entry selection &amp; directives</summary>
                  <div className="research-md">
                    {reframe.directives
                      .map(
                        (d) =>
                          `${d.experience}\n  carries: ${d.themes.map(themeName).join(" · ")}\n  register: ${d.verb_register} | anchor: ${d.anchor_metric || "(none)"}\n  angle: ${d.framing_angle}\n  why: ${d.rationale}`
                      )
                      .join("\n\n")}
                    {reframe.excluded_notes ? `\n\nLeft off: ${reframe.excluded_notes}` : ""}
                  </div>
                </details>
                {metricAudit.length > 0 && (
                  <details className="research">
                    <summary>Metric audit — every number traced to its source</summary>
                    <div className="research-md">
                      {metricAudit
                        .map(
                          (a) =>
                            `${a.token}  →  ${a.entry}${a.provenance ? ` — ${a.provenance}` : ""}  [${a.confidence}]`
                        )
                        .join("\n")}
                    </div>
                  </details>
                )}
                <details className="research">
                  <summary>Bullet-by-bullet theme map</summary>
                  <div className="research-md">
                    {resume.sections
                      .flatMap((s) =>
                        s.entries.flatMap((e) =>
                          e.bullets.map((b) => `${e.heading || s.title}\n  ${b.text}\n  carries: ${b.themes.map(themeName).join(" · ") || "(untagged)"}`)
                        )
                      )
                      .join("\n\n")}
                  </div>
                </details>
              </>
            )}

            {resume.tailoring_notes.keywords_used.length > 0 && (
              <>
                <h3>ATS keywords woven in</h3>
                <div className="analysis-chips">
                  {resume.tailoring_notes.keywords_used.map((k) => (
                    <span className="chip" key={k}>{k}</span>
                  ))}
                </div>
              </>
            )}
            {resume.tailoring_notes.gaps.length > 0 && (
              <div className="notice" style={{ marginTop: 12 }}>
                <strong>Gaps to be aware of</strong> (the posting asks for these, but your
                experience bank couldn&apos;t support them — nothing was fabricated):
                <ul>
                  {resume.tailoring_notes.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {research && (
            <div className="card no-print">
              <details className="research">
                <summary>Company research</summary>
                <div className="research-md">{research.company}</div>
              </details>
              <details className="research">
                <summary>Role &amp; market research</summary>
                <div className="research-md">{research.market}</div>
              </details>
              <details className="research">
                <summary>Industry resume conventions</summary>
                <div className="research-md">{research.conventions}</div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
