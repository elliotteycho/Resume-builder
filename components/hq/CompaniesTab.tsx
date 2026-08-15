"use client";

import { useEffect, useState } from "react";
import { api, type Board } from "@/lib/hq/client";
import { LIVE_STAGES, STAGE_ORDER, type Stage } from "@/lib/hq/config";
import CompanyRow from "@/components/hq/CompanyRow";

const FILTERS = [
  ["all", "All"],
  ["open", "Open"],
  ["watching", "Watching"],
  ["applied", "Applied"],
  ["interviewing", "Interviewing"],
  ["closed", "Closed"],
] as const;

type Filter = (typeof FILTERS)[number][0];

export default function CompaniesTab({
  board,
  focus,
  refresh,
  onError,
}: {
  board: Board;
  focus: string | null;
  refresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(focus);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ company: "", program: "", url: "", jd_text: "" });

  useEffect(() => {
    if (focus) setOpen(focus);
  }, [focus]);

  const effectiveStage = (stage: Stage | undefined, status: string): Stage =>
    stage ?? (status === "open" ? "open" : "watching");

  const rows = board.items
    .filter((v) => {
      const stage = effectiveStage(v.application?.stage, v.status);
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "closed"
            ? stage === "closed" || stage === "offer" || v.status === "closed"
            : stage === filter;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || `${v.company.name} ${v.program}`.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    })
    .sort((a, b) => {
      const sa = effectiveStage(a.application?.stage, a.status);
      const sb = effectiveStage(b.application?.stage, b.status);
      return (
        STAGE_ORDER[sa] - STAGE_ORDER[sb] ||
        (a.application?.tier ?? a.company.tier_default) -
          (b.application?.tier ?? b.company.tier_default) ||
        a.company.name.localeCompare(b.company.name)
      );
    });

  const addPosting = async () => {
    setBusy(true);
    onError(null);
    try {
      const { posting } = await api.addPosting(draft);
      setDraft({ company: "", program: "", url: "", jd_text: "" });
      setAdding(false);
      await refresh();
      setOpen(posting.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not add that posting");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="row" style={{ marginBottom: "var(--space-3)" }}>
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            className={`pill${filter === id ? " on-dark" : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginLeft: "auto", width: 170 }}
        />
      </div>

      <div className="card" style={{ marginBottom: "var(--space-3)" }}>
        <div className="spread">
          <span className="eyebrow">Found a posting the board doesn&rsquo;t have?</span>
          <button className="btn btn-ghost small" onClick={() => setAdding((v) => !v)}>
            {adding ? "cancel" : "add a posting"}
          </button>
        </div>
        {adding && (
          <>
            <div className="row">
              <input
                placeholder="Company (optional — read from the posting)"
                value={draft.company}
                onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                className="grow"
              />
              <input
                placeholder="Program (optional)"
                value={draft.program}
                onChange={(e) => setDraft({ ...draft, program: e.target.value })}
                className="grow"
              />
            </div>
            <input
              placeholder="Posting URL"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
            <textarea
              rows={6}
              placeholder="Paste the full job description. It gets analyzed once and shared with everyone tracking this posting."
              value={draft.jd_text}
              onChange={(e) => setDraft({ ...draft, jd_text: e.target.value })}
            />
            <div>
              <button
                className="btn btn-primary"
                disabled={busy || draft.jd_text.trim().length < 40}
                onClick={() => void addPosting()}
              >
                {busy ? "Reading the posting…" : "Add and analyze"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="stack">
        {rows.length === 0 && (
          <div className="card dashed">
            <span className="muted">Nothing matches that filter.</span>
          </div>
        )}
        {rows.map((v) => (
          <CompanyRow
            key={v.id}
            view={v}
            open={open === v.id}
            onToggle={() => setOpen(open === v.id ? null : v.id)}
            refresh={refresh}
            onError={onError}
          />
        ))}
      </div>

      <p className="muted" style={{ marginTop: "var(--space-3)" }}>
        {board.items.filter((v) => LIVE_STAGES.includes(v.application?.stage ?? "watching")).length}{" "}
        live applications across {board.items.length} tracked postings.
      </p>
    </>
  );
}
