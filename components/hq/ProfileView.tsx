"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/hq/client";
import { LANES, LANE_LABELS, type Lane } from "@/lib/hq/config";
import { formatMonth, monthIndex } from "@/lib/hq/dates";
import type { ExperienceCardWithEvidence, Match, Profile } from "@/lib/hq/types";

const BLANK_CARD = {
  lane: "professional" as Lane,
  organization: "",
  title: "",
  start_date: "",
  end_date: "",
  capabilities: "",
  bullets: "",
};

/**
 * The living portfolio: experiences as cards on a timeline rather than bullets
 * on a page. Matching a job description lights up the cards that answer it, so
 * the question "what do I have for this role" has a visual answer.
 */
export default function ProfileView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cards, setCards] = useState<ExperienceCardWithEvidence[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(BLANK_CARD);
  const [jd, setJd] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.profile();
      setProfile(data.profile);
      setCards(data.cards);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your profile");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  // The timeline spans the cards themselves, so it never shows dead months at
  // either end and never clips an entry that falls outside a fixed window.
  const span = useMemo(() => {
    const points = cards
      .flatMap((c) => [c.start_date, c.end_date])
      .filter(Boolean)
      .map(monthIndex);
    const nowIdx = monthIndex(new Date().toISOString().slice(0, 7));
    if (!points.length) return { from: nowIdx - 24, months: 25 };
    const from = Math.min(...points);
    const to = Math.max(...points, nowIdx);
    return { from, months: Math.max(6, to - from + 1) };
  }, [cards]);

  const axis = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 5; i++) {
      const idx = span.from + Math.round((span.months - 1) * (i / 4));
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      out.push(formatMonth(`${y}-${String(m).padStart(2, "0")}`));
    }
    return out;
  }, [span]);

  const lit = useMemo(
    () => (match ? new Set(match.reasons.map((r) => r.card_id)) : null),
    [match]
  );

  const detail = cards.find((c) => c.id === selected) ?? null;

  const importFile = (file: File | null | undefined) => {
    setDragging(false);
    if (!file) return;
    void run("import", async () => {
      const data = await api.importResumeFile(file);
      setProfile(data.profile);
      setCards(data.cards);
    });
  };

  const runMatch = () =>
    run("match", async () => {
      // A pasted JD becomes a real posting so the analysis is cached and the
      // result shows up on the tracker too — not a throwaway one-off score.
      const { posting } = await api.addPosting({ jd_text: jd });
      const { match: result } = await api.match(posting.id, true);
      setMatch(result);
      setSelected(null);
    });

  if (!profile) {
    return (
      <main>
        {error ? <div className="error">{error}</div> : <p className="muted">Loading…</p>}
      </main>
    );
  }

  return (
    <>
      <div style={{ background: "var(--color-neutral-900)", color: "var(--color-bg)" }}>
        <div className="hq-hero-inner">
          <div
            className="eyebrow"
            style={{ color: "var(--color-accent-300)", letterSpacing: "0.12em" }}
          >
            Profile · living portfolio
          </div>
          <h1 style={{ fontSize: 40, margin: "var(--space-1) 0", color: "var(--color-bg)" }}>
            {profile.name || "Your profile"}
          </h1>
          <div style={{ fontSize: 14, color: "var(--color-neutral-300)" }}>
            {[
              profile.school,
              profile.majors.join(", "),
              profile.grad_year && `Class of ${profile.grad_year}`,
              profile.location,
            ]
              .filter(Boolean)
              .join(" · ") || "Add your details below so eligibility checks can run."}
          </div>
        </div>
      </div>

      <main>
        {error && <div className="error">{error}</div>}

        {/* ---------- experience timeline ---------- */}
        <h2 style={{ fontSize: 22, margin: "var(--space-4) 0 var(--space-1)" }}>
          Experience timeline
        </h2>
        <p className="muted" style={{ margin: "0 0 var(--space-3)" }}>
          Tap a bar to open its card. Match a job description below to see which experiences light
          up and why.
        </p>

        <div className="exp-timeline">
          <div className="exp-inner">
            <div className="exp-axis">
              {axis.map((a, i) => (
                <span key={i}>{a}</span>
              ))}
            </div>
            {LANES.map((lane) => {
              const inLane = cards.filter((c) => c.lane === lane);
              return (
                <div key={lane} className="exp-lane">
                  <div className="exp-lane-name">{LANE_LABELS[lane]}</div>
                  <div className="exp-track">
                    {inLane.length === 0 && (
                      <div className="exp-empty">Nothing here yet — add a card below</div>
                    )}
                    {inLane.map((c) => {
                      const start = c.start_date ? monthIndex(c.start_date) : span.from;
                      const end = c.end_date ? monthIndex(c.end_date) + 1 : span.from + span.months;
                      const s = Math.max(0, Math.min(span.months, start - span.from));
                      const e = Math.max(s + 1, Math.min(span.months, end - span.from));
                      const isLit = lit?.has(c.id) ?? false;
                      return (
                        <button
                          key={c.id}
                          className={[
                            "exp-bar",
                            c.lane,
                            lit && !isLit ? "dim" : "",
                            isLit ? "lit" : "",
                            selected === c.id ? "selected" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{
                            left: `${(s / span.months) * 100}%`,
                            width: `${((e - s) / span.months) * 100}%`,
                          }}
                          onClick={() => setSelected(selected === c.id ? null : c.id)}
                        >
                          {c.organization || c.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {detail && (
          <div
            className="card"
            style={{ marginTop: "var(--space-3)", borderColor: "var(--color-accent-300)" }}
          >
            <div className="row" style={{ alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 20 }}>
                {detail.organization || detail.title}
              </span>
              <span className="tag tag-neutral">{LANE_LABELS[detail.lane]}</span>
              <span className="muted nums">
                {formatMonth(detail.start_date)} –{" "}
                {detail.end_date ? formatMonth(detail.end_date) : "Present"}
              </span>
              <span className="grow" />
              <button
                className="btn btn-ghost small"
                disabled={busy !== null}
                onClick={() =>
                  run("delete", async () => {
                    await api.deleteCard(detail.id);
                    setSelected(null);
                    await load();
                  })
                }
              >
                remove card
              </button>
            </div>
            <div style={{ fontWeight: 700 }}>{detail.title}</div>
            {detail.bullets.map((b, i) => (
              <div key={i} className="row" style={{ gap: "var(--space-1)", flexWrap: "nowrap" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>·</span>
                <span style={{ fontSize: 14, color: "var(--color-neutral-800)" }}>{b}</span>
              </div>
            ))}
            {detail.capabilities.length > 0 && (
              <div className="row" style={{ gap: 6 }}>
                {detail.capabilities.map((c) => (
                  <span key={c} className="tag tag-outline">
                    {c}
                  </span>
                ))}
              </div>
            )}
            {detail.evidence.length > 0 && (
              <div>
                <div className="eyebrow">Evidence</div>
                {detail.evidence.map((e) => (
                  <div key={e.id} className="muted">
                    <strong style={{ color: "var(--color-text)" }}>{e.metric}</strong> — {e.claim}{" "}
                    <span className="tag tag-neutral">{e.confidence}</span>
                  </div>
                ))}
                <div className="muted" style={{ marginTop: 4 }}>
                  Add provenance and correct confidence in the{" "}
                  <Link href="/experience">evidence editor</Link>. Low-confidence numbers are
                  invisible to the resume generator by design.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------- resume import ---------- */}
        <h2 style={{ fontSize: 22, margin: "var(--space-6) 0 var(--space-2)" }}>Resume on file</h2>
        <div className="card">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            style={{ display: "none" }}
            onChange={(e) => {
              importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            className={`dropzone${dragging ? " over" : ""}`}
            disabled={busy === "import"}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              importFile(e.dataTransfer.files?.[0]);
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {busy === "import" ? "Reading your resume…" : "Drop your resume here"}
            </span>
            <span className="muted">or click to browse — PDF, Word, or plain text</span>
          </button>

          {profile.resume_file_name && (
            <div className="row" style={{ alignItems: "baseline" }}>
              <span className="tag tag-accent-2">On file</span>
              <span style={{ fontWeight: 700 }}>{profile.resume_file_name}</span>
              <span className="muted">
                {profile.resume_uploaded_at &&
                  `imported ${new Date(profile.resume_uploaded_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`}
              </span>
            </div>
          )}
          <div className="muted">
            Importing replaces your cards with what the resume says — bullets are copied verbatim,
            and every number becomes an evidence record for you to confirm.
          </div>
        </div>

        {/* ---------- eligibility details ---------- */}
        <h2 style={{ fontSize: 22, margin: "var(--space-6) 0 var(--space-2)" }}>
          Screening details
        </h2>
        <div className="card">
          <div className="muted">
            These drive the eligibility gate. A posting you are categorically barred from is skipped
            before it costs you an afternoon — but only if these are filled in.
          </div>
          <ProfileFields
            profile={profile}
            disabled={busy !== null}
            onSave={(patch) =>
              run("profile", async () => {
                const { profile: saved } = await api.saveProfile(patch);
                setProfile(saved);
              })
            }
          />
        </div>

        {/* ---------- add a card ---------- */}
        <h2 style={{ fontSize: 22, margin: "var(--space-6) 0 var(--space-2)" }}>
          Add an experience card
        </h2>
        <div className="card">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "var(--space-2)",
            }}
          >
            <input
              placeholder="Organization"
              value={draft.organization}
              onChange={(e) => setDraft({ ...draft, organization: e.target.value })}
            />
            <input
              placeholder="Role / title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <input
              type="month"
              title="Start"
              value={draft.start_date}
              onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
            />
            <input
              type="month"
              title="End — blank means present"
              value={draft.end_date}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            />
          </div>
          <div className="row">
            <span className="eyebrow">Lane</span>
            {LANES.map((lane) => (
              <button
                key={lane}
                className={`pill small${draft.lane === lane ? " on-dark" : ""}`}
                onClick={() => setDraft({ ...draft, lane })}
              >
                {LANE_LABELS[lane]}
              </button>
            ))}
          </div>
          <input
            placeholder="Capabilities, comma separated (e.g. user research, prioritization, SQL)"
            value={draft.capabilities}
            onChange={(e) => setDraft({ ...draft, capabilities: e.target.value })}
          />
          <textarea
            rows={3}
            placeholder="What you did and what came of it — one bullet per line, with real numbers"
            value={draft.bullets}
            onChange={(e) => setDraft({ ...draft, bullets: e.target.value })}
          />
          <div>
            <button
              className="btn btn-primary"
              disabled={busy !== null || !draft.organization.trim() || !draft.start_date}
              onClick={() =>
                run("card", async () => {
                  await api.saveCard({
                    lane: draft.lane,
                    organization: draft.organization.trim(),
                    title: draft.title.trim() || "Role",
                    start_date: draft.start_date,
                    end_date: draft.end_date,
                    capabilities: draft.capabilities
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    bullets: draft.bullets
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  });
                  setDraft(BLANK_CARD);
                  await load();
                })
              }
            >
              Add to timeline
            </button>
          </div>
        </div>

        {/* ---------- match a JD ---------- */}
        <h2 style={{ fontSize: 22, margin: "var(--space-6) 0 var(--space-2)" }}>
          Match a job description
        </h2>
        <div className="card">
          <textarea
            rows={6}
            placeholder="Paste a posting. Your matching experience cards light up on the timeline, with the reason each one earned its place — and the posting joins your tracker."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
          <div className="row">
            <button
              className="btn btn-primary"
              disabled={busy !== null || jd.trim().length < 40}
              onClick={() => void runMatch()}
            >
              {busy === "match" ? "Reading and scoring…" : "Match"}
            </button>
            {match && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setMatch(null);
                  setJd("");
                }}
              >
                Clear
              </button>
            )}
          </div>

          {match && (
            <>
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
                  <strong>Eligibility gate:</strong> {match.blockers.join(" ")}
                </div>
              )}
              {match.warnings.map((w) => (
                <div key={w} className="muted">
                  ⚠ {w}
                </div>
              ))}

              {match.reasons.map((r, i) => {
                const card = cards.find((c) => c.id === r.card_id);
                return (
                  <div key={i} className="row" style={{ alignItems: "baseline" }}>
                    <span className="tag tag-accent nums">#{i + 1}</span>
                    <span style={{ fontWeight: 700 }}>
                      {card?.organization || card?.title || "Card"}
                    </span>
                    <span className="muted grow">{r.reasoning}</span>
                  </div>
                );
              })}

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

              {match.reasons.length === 0 && match.eligibility_pass && (
                <div className="muted">
                  No card answered this posting&rsquo;s themes. That is itself signal: add the
                  experience that would, or skip the role.
                </div>
              )}
            </>
          )}
        </div>

        <p className="muted" style={{ marginTop: "var(--space-3)" }}>
          <Link href="/">← Back to the tracker</Link> ·{" "}
          <Link href="/generate">Generate a tailored resume</Link>
        </p>
      </main>
    </>
  );
}

function ProfileFields({
  profile,
  disabled,
  onSave,
}: {
  profile: Profile;
  disabled: boolean;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email,
    school: profile.school,
    majors: profile.majors.join(", "),
    grad_year: profile.grad_year,
    class_year: profile.class_year?.toString() ?? "",
    gpa: profile.gpa?.toString() ?? "",
    degree_level: profile.degree_level,
    work_authorization: profile.work_authorization,
    target_role: profile.target_role,
    summary: profile.summary,
  });

  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "var(--space-2)",
        }}
      >
        <Field label="Name">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Email">
          <input value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="School">
          <input value={form.school} onChange={(e) => set("school", e.target.value)} />
        </Field>
        <Field label="Majors (comma separated)">
          <input value={form.majors} onChange={(e) => set("majors", e.target.value)} />
        </Field>
        <Field label="Graduation year">
          <input
            value={form.grad_year}
            placeholder="2028"
            onChange={(e) => set("grad_year", e.target.value)}
          />
        </Field>
        <Field label="Class year (1–4)">
          <input
            type="number"
            min={1}
            max={4}
            value={form.class_year}
            onChange={(e) => set("class_year", e.target.value)}
          />
        </Field>
        <Field label="GPA">
          <input
            type="number"
            step="0.01"
            value={form.gpa}
            onChange={(e) => set("gpa", e.target.value)}
          />
        </Field>
        <Field label="Degree level">
          <select
            value={form.degree_level}
            onChange={(e) => set("degree_level", e.target.value)}
          >
            <option value="bachelors">Bachelor&rsquo;s</option>
            <option value="masters">Master&rsquo;s</option>
            <option value="mba">MBA</option>
            <option value="phd">PhD</option>
          </select>
        </Field>
        <Field label="Work authorization">
          <select
            value={form.work_authorization}
            onChange={(e) => set("work_authorization", e.target.value)}
          >
            <option value="unspecified">Prefer not to say</option>
            <option value="citizen">U.S. citizen</option>
            <option value="permanent-resident">Permanent resident</option>
            <option value="needs-sponsorship">Needs sponsorship</option>
          </select>
        </Field>
        <Field label="Target role">
          <input
            value={form.target_role}
            placeholder="Product Manager Intern"
            onChange={(e) => set("target_role", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Anything a resume writer should know">
        <textarea
          rows={3}
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
        />
      </Field>

      <div>
        <button
          className="btn btn-primary"
          disabled={disabled}
          onClick={() =>
            onSave({
              name: form.name,
              email: form.email,
              school: form.school,
              majors: form.majors
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              grad_year: form.grad_year,
              class_year: form.class_year ? Number(form.class_year) : null,
              gpa: form.gpa ? Number(form.gpa) : null,
              degree_level: form.degree_level as Profile["degree_level"],
              work_authorization: form.work_authorization as Profile["work_authorization"],
              target_role: form.target_role,
              summary: form.summary,
            })
          }
        >
          Save
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
