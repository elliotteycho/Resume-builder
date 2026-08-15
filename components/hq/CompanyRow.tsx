"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/hq/client";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/hq/config";
import type { Contact, PostingView, ResearchBrief } from "@/lib/hq/types";

const STAGE_TAG: Record<Stage, string> = {
  open: "tag-accent-2",
  watching: "tag-outline",
  applied: "tag-accent",
  interviewing: "tag-accent",
  offer: "tag-accent-2",
  closed: "tag-neutral",
};

export default function CompanyRow({
  view,
  open,
  onToggle,
  refresh,
  onError,
}: {
  view: PostingView;
  open: boolean;
  onToggle: () => void;
  refresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [note, setNote] = useState(view.notes[0]?.body ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stage: Stage = view.application?.stage ?? (view.status === "open" ? "open" : "watching");

  // Load a cached brief only when the row is actually opened — the list would
  // otherwise fire one request per company on every render of the board.
  useEffect(() => {
    if (!open || brief) return;
    let live = true;
    void api
      .cachedResearch(view.company.id)
      .then((r) => {
        if (live && r.brief) setBrief(r.brief);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, brief, view.company.id]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    onError(null);
    try {
      await fn();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const onNoteChange = (value: string) => {
    setNote(value);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      void api.saveNote(view.company.id, value).catch(() => undefined);
    }, 600);
  };

  const match = view.match;

  return (
    <div className={`card${open ? " raised" : ""}`}>
      <div
        className="row"
        style={{ alignItems: "baseline", cursor: "pointer" }}
        onClick={onToggle}
      >
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
          {view.company.name}
        </span>
        <span className={`tag ${STAGE_TAG[stage]}`}>{STAGE_LABELS[stage]}</span>
        {view.short_window && <span className="tag tag-soft">⚡ short window</span>}
        <span className="muted grow">{view.program}</span>
        {match && (
          <span className={`score ${match.verdict}`} title={match.headline}>
            {match.eligibility_pass ? match.score : "—"}
          </span>
        )}
        {view.days_since_applied !== null && (
          <span className="muted nums">{view.days_since_applied}d</span>
        )}
      </div>

      {open && (
        <>
          <div style={{ fontSize: 14, color: "var(--color-neutral-800)" }}>
            {view.window_expected}
            {view.window_note && (
              <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>
                {" "}
                — {view.window_note}
              </span>
            )}
          </div>

          <div className="muted">
            {view.application?.next_action && <>Next: {view.application.next_action} · </>}
            {view.url && (
              <a href={view.url} target="_blank" rel="noopener noreferrer">
                posting ↗
              </a>
            )}
          </div>

          <div className="row">
            <span className="eyebrow" style={{ marginRight: "var(--space-1)" }}>
              Stage
            </span>
            {STAGES.map((s) => (
              <button
                key={s}
                className={`pill small${stage === s ? " on" : ""}`}
                disabled={busy !== null}
                onClick={() =>
                  run("stage", async () => {
                    await api.setStage(view, s);
                    await refresh();
                  })
                }
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>

          {/* ---- match ---- */}
          <div className="stack" style={{ gap: "var(--space-1)" }}>
            <div className="row">
              <span className="eyebrow">Fit</span>
              <button
                className="btn btn-secondary small"
                disabled={busy !== null}
                onClick={() =>
                  run("match", async () => {
                    await api.match(view.id, !!match);
                    await refresh();
                  })
                }
              >
                {busy === "match" ? "Scoring…" : match ? "Re-score" : "Score this posting"}
              </button>
              {match?.stale && <span className="tag tag-neutral">out of date</span>}
              {!view.jd_text && !view.jd_analysis && (
                <span className="muted">Paste this posting&rsquo;s description below to score it.</span>
              )}
            </div>

            {match && (
              <div className="card flat" style={{ background: "var(--color-neutral-100)" }}>
                <div className="row">
                  <span className={`score ${match.verdict}`}>
                    {match.eligibility_pass ? match.score : "—"}
                  </span>
                  <span className="tag tag-soft">{match.verdict}</span>
                  <span className="grow" style={{ fontWeight: 600 }}>
                    {match.headline}
                  </span>
                </div>

                {match.blockers.length > 0 && (
                  <div className="callout">
                    <strong>Not eligible.</strong>{" "}
                    {match.blockers.join(" ")}
                  </div>
                )}
                {match.warnings.map((w) => (
                  <div key={w} className="muted">
                    ⚠ {w}
                  </div>
                ))}

                {match.reasons.length > 0 && (
                  <div>
                    <div className="eyebrow">What carries you here</div>
                    {match.reasons.map((r, i) => (
                      <div key={i} className="muted" style={{ marginTop: 4 }}>
                        <strong style={{ color: "var(--color-text)" }}>{r.theme}</strong> —{" "}
                        {r.reasoning}
                      </div>
                    ))}
                  </div>
                )}

                {match.gaps.length > 0 && (
                  <div>
                    <div className="eyebrow">Gaps</div>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {match.gaps.map((g) => (
                        <li key={g} className="muted">
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ---- research + network ---- */}
          <div className="stack" style={{ gap: "var(--space-1)" }}>
            <div className="row">
              <span className="eyebrow">Research &amp; network</span>
              <button
                className="btn btn-secondary small"
                disabled={busy !== null}
                onClick={() =>
                  run("research", async () => {
                    const r = await api.research(view.company.id);
                    setBrief(r.brief);
                  })
                }
              >
                {busy === "research"
                  ? "Researching…"
                  : brief
                    ? "Refresh brief"
                    : "Research this company"}
              </button>
            </div>

            {brief && <BriefPanel brief={brief} view={view} refresh={refresh} onError={onError} />}
          </div>

          <textarea
            rows={3}
            placeholder="Notes — research, people, angles, interview intel…"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />

          {view.contacts.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--color-accent-2-800)" }}>
              People here: {view.contacts.map((c) => c.name).join(", ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BriefPanel({
  brief,
  view,
  refresh,
  onError,
}: {
  brief: ResearchBrief;
  view: PostingView;
  refresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const b = brief.brief;
  const known = new Set(view.contacts.map((c) => c.name.toLowerCase()));

  const addTarget = async (target: (typeof b.targets)[number]) => {
    onError(null);
    try {
      await api.addContact({
        name: target.name,
        role: target.role,
        kind: target.kind,
        company_id: view.company.id,
        company_name: view.company.name,
        linkedin_url: target.linkedin_search_url,
        angle: target.why,
        notes: `Ask: ${target.ask}\n\n${target.opener}`,
      } as Partial<Contact>);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not add that contact");
    }
  };

  return (
    <div className="card flat" style={{ background: "var(--color-accent-100)" }}>
      <div style={{ fontWeight: 700 }}>{b.one_liner}</div>

      {b.recent.length > 0 && (
        <div>
          <div className="eyebrow">Recent</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {b.recent.map((r) => (
              <li key={r} className="muted">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {b.product_org && (
        <div>
          <div className="eyebrow">How product works here</div>
          <div className="muted">{b.product_org}</div>
        </div>
      )}

      {b.interview_process.length > 0 && (
        <div>
          <div className="eyebrow">Process</div>
          <div className="muted">{b.interview_process.join(" → ")}</div>
        </div>
      )}

      {b.school_angle && (
        <div>
          <div className="eyebrow">Your school</div>
          <div className="muted">{b.school_angle}</div>
        </div>
      )}

      {b.talking_points.length > 0 && (
        <div>
          <div className="eyebrow">Worth referencing</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {b.talking_points.map((t) => (
              <li key={t} className="muted">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {b.targets.length > 0 && (
        <div className="stack" style={{ gap: "var(--space-1)" }}>
          <div className="eyebrow">Who to reach, warmest first</div>
          {b.targets.map((t, i) => (
            <div key={i} className="card flat" style={{ gap: 6 }}>
              <div className="row">
                <span style={{ fontWeight: 700 }}>{t.name}</span>
                <span className="tag tag-neutral">{t.kind}</span>
                <span className="muted grow">{t.role}</span>
                <button
                  className="btn btn-ghost small"
                  disabled={known.has(t.name.toLowerCase())}
                  onClick={() => void addTarget(t)}
                >
                  {known.has(t.name.toLowerCase()) ? "in People" : "track"}
                </button>
              </div>
              <div className="muted">{t.why}</div>
              <div className="muted">
                <strong>Find them:</strong> {t.how_to_find}{" "}
                {t.linkedin_search_url && (
                  <a href={t.linkedin_search_url} target="_blank" rel="noopener noreferrer">
                    search ↗
                  </a>
                )}
              </div>
              <div className="muted">
                <strong>Ask:</strong> {t.ask}
              </div>
              <div className="callout" style={{ whiteSpace: "pre-wrap" }}>
                {t.opener}
              </div>
            </div>
          ))}
        </div>
      )}

      {b.sources.length > 0 && (
        <details>
          <summary className="muted">Sources</summary>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {b.sources.map((s) => (
              <li key={s} className="muted" style={{ wordBreak: "break-all" }}>
                <a href={s} target="_blank" rel="noopener noreferrer">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
