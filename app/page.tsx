"use client";

import { useRef, useState } from "react";
import ResumeView, { resumeToMarkdown } from "@/components/ResumeView";
import type { JobAnalysis, ProgressEvent, ResearchFindings, Resume } from "@/lib/types";

type AgentName = "company" | "market" | "conventions";
type AgentStates = Record<AgentName, "idle" | "running" | "done">;

const AGENT_LABELS: Record<AgentName, string> = {
  company: "Company intel agent — news, products, culture",
  market: "Role & market agent — current demand and trends",
  conventions: "Conventions agent — how resumes work in this industry",
};

const STAGES = ["analyzing", "researching", "synthesizing", "done"] as const;
const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  analyzing: "Analyzing the job description",
  researching: "Researching in parallel",
  synthesizing: "Writing the tailored resume",
  done: "Done",
};

export default function GeneratePage() {
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStates>({ company: "idle", market: "idle", conventions: "idle" });
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [research, setResearch] = useState<ResearchFindings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setResume(null);
    setResearch(null);
    setAnalysis(null);
    setStage("analyzing");
    setAgents({ company: "idle", market: "idle", conventions: "idle" });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jd }),
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
      case "result":
        setResume(event.resume);
        setResearch(event.research);
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const stageIndex = stage ? STAGES.indexOf(stage as (typeof STAGES)[number]) : -1;

  return (
    <div>
      <div className="no-print">
        <h1>Build a resume from a job description</h1>
        <p className="subtitle">
          Paste a posting. The app identifies the company, role, and market; runs three research
          agents simultaneously for current data; then writes a resume from your{" "}
          <a href="/experience">experience bank</a>, tailored to this industry&apos;s conventions.
        </p>

        <div className="card">
          <textarea
            className="jd-input"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            disabled={busy}
          />
          <div className="row" style={{ marginTop: 12 }}>
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
                    <span className="chip">{analysis.company.market_segment}</span>
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
            <button className="primary" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
            <button className="ghost" onClick={downloadMarkdown}>
              Download Markdown
            </button>
          </div>

          <ResumeView resume={resume} />

          <div className="card notes no-print" style={{ marginTop: 18 }}>
            <h3>How this resume was tailored</h3>
            <p>{resume.tailoring_notes.strategy}</p>
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
