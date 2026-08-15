"use client";

import { LIVE_STAGES, RADAR_LABELS, type Radar } from "@/lib/hq/config";
import type { Board } from "@/lib/hq/client";
import type { PostingView } from "@/lib/hq/types";
import type { TabId } from "@/components/hq/HqApp";

const RADAR_RANK: Record<Radar, number> = {
  now: 0,
  aug: 1,
  sep: 2,
  oct: 3,
  nov: 4,
  dec: 5,
};

const MONTHS: { key: Radar; label: string }[] = [
  { key: "aug", label: "August" },
  { key: "sep", label: "September" },
  { key: "oct", label: "October" },
  { key: "nov", label: "November" },
  { key: "dec", label: "December+" },
];

/**
 * The season at a glance: which month each window is expected in, which are
 * short, and what has to be ready before each door opens.
 */
export default function TimelineTab({
  board,
  goTo,
}: {
  board: Board;
  goTo: (tab: TabId, id?: string) => void;
}) {
  const nowKey = MONTHS[Math.min(MONTHS.length - 1, Math.max(0, new Date().getMonth() - 7))].key;

  const buckets = new Map<Radar, PostingView[]>(MONTHS.map((m) => [m.key, []]));
  const rolling: PostingView[] = [];

  for (const v of board.items) {
    const stage = v.application?.stage;
    if (stage && LIVE_STAGES.includes(stage)) {
      const applied = v.application?.applied_date;
      const month = applied ? new Date(`${applied}T12:00:00Z`).getUTCMonth() : 7;
      const key: Radar = month <= 7 ? "aug" : month === 8 ? "sep" : month === 9 ? "oct" : month === 10 ? "nov" : "dec";
      buckets.get(key)!.push(v);
    } else if (v.status === "open") {
      buckets.get("aug")!.push(v);
    } else if (v.radar === "now") {
      rolling.push(v);
    } else {
      buckets.get(buckets.has(v.radar as Radar) ? (v.radar as Radar) : "dec")!.push(v);
    }
  }

  const chipClass = (v: PostingView) => {
    const stage = v.application?.stage;
    if (stage && LIVE_STAGES.includes(stage)) return "season-chip applied";
    if (v.status === "open") return "season-chip open";
    return "season-chip";
  };

  const nextSteps = [
    ...board.items
      .filter((v) => v.status === "open" && !LIVE_STAGES.includes(v.application?.stage ?? "watching"))
      .map((v) => ({
        when: "Now",
        company: v.company.name,
        action: v.application?.next_action || v.window_note || "Open now — apply.",
        soon: true,
      })),
    ...board.items
      .filter((v) => v.status === "watching" && v.short_window)
      // Chronological, so the prep list reads in the order the doors open.
      .sort((a, b) => RADAR_RANK[a.radar ?? "dec"] - RADAR_RANK[b.radar ?? "dec"])
      .map((v) => ({
        when: v.radar ? RADAR_LABELS[v.radar].slice(0, 3) : "Fall",
        company: v.company.name,
        action: [v.window_note, v.application?.next_action].filter(Boolean).join(" "),
        soon: false,
      })),
  ];

  return (
    <>
      <h2 style={{ fontSize: 22, margin: "0 0 var(--space-1)" }}>Season timeline</h2>
      <p className="muted" style={{ margin: "0 0 var(--space-3)" }}>
        Your track, August through winter. ⚡ marks a short window. Tap a company to open it.
      </p>

      <div className="season">
        <div className="season-months">
          {MONTHS.map((m) => (
            <div key={m.key} className={`season-month${m.key === nowKey ? " now" : ""}`}>
              <div className="row" style={{ gap: 6, marginBottom: "var(--space-1)" }}>
                <span className="eyebrow">{m.label}</span>
                {m.key === nowKey && <span className="tag tag-accent">now</span>}
              </div>
              {buckets.get(m.key)!.map((v) => (
                <button
                  key={v.id}
                  className={chipClass(v)}
                  onClick={() => goTo("companies", v.id)}
                >
                  {v.company.name}
                  {v.short_window ? " ⚡" : ""}
                </button>
              ))}
            </div>
          ))}
        </div>

        {rolling.length > 0 && (
          <div
            className="row"
            style={{
              marginTop: "var(--space-2)",
              borderTop: "1px solid var(--line)",
              paddingTop: "var(--space-2)",
            }}
          >
            <span className="eyebrow" style={{ marginRight: "var(--space-1)" }}>
              Rolling, year round
            </span>
            {rolling.map((v) => (
              <button key={v.id} className={chipClass(v)} onClick={() => goTo("companies", v.id)}>
                {v.company.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 22, margin: "var(--space-6) 0 var(--space-2)" }}>Next steps</h2>
      <div className="stack">
        {nextSteps.length === 0 && (
          <div className="card dashed">
            <span className="muted">Nothing scheduled. Add postings to fill out the season.</span>
          </div>
        )}
        {nextSteps.map((n, i) => (
          <div
            key={`${n.company}-${i}`}
            className="card"
            style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}
          >
            <span
              className="queue-dot"
              style={{ marginTop: 0, background: n.soon ? "var(--color-accent)" : "var(--color-accent-2-400)" }}
            />
            <span className="eyebrow" style={{ width: 84, flex: "none" }}>
              {n.when}
            </span>
            <span style={{ fontWeight: 700 }}>{n.company}</span>
            <span className="muted grow" style={{ minWidth: 200 }}>
              {n.action}
            </span>
          </div>
        ))}
      </div>

      <p className="muted" style={{ marginTop: "var(--space-2)" }}>
        Watching months are last-cycle patterns. They are unverified until a posting actually goes
        live — treat them as a prep schedule, not a promise.
      </p>
    </>
  );
}
