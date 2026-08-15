"use client";

import { formatDay, todayISO } from "@/lib/hq/dates";
import type { Board } from "@/lib/hq/client";
import type { TabId } from "@/components/hq/HqApp";

/**
 * The "do next" queue, on a date rail. Everything here is derived server-side
 * from posting status, application dates, and contact touches — there is no
 * task list to keep in sync, so a task disappears the moment its cause does.
 */
export default function TodayTab({
  board,
  goTo,
}: {
  board: Board;
  goTo: (tab: TabId, id?: string) => void;
}) {
  const today = todayISO();
  const tiles = [
    { num: board.summary.applied, label: "Applied", cls: "accent-2" },
    {
      num: board.summary.openNotApplied,
      label: "Open, not applied",
      cls: board.summary.openNotApplied ? "accent" : "",
    },
    { num: board.summary.interviewing, label: "Interviewing", cls: "" },
    { num: board.summary.contacts, label: "Contacts in play", cls: "" },
  ];

  return (
    <>
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className="card" style={{ gap: 0 }}>
            <div className={`tile-num ${t.cls}`}>{t.num}</div>
            <div className="eyebrow" style={{ marginTop: "var(--space-1)" }}>
              {t.label}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 22, margin: "0 0 var(--space-2)" }}>Do next</h2>

      {board.queue.length === 0 ? (
        <div className="card dashed">
          <div className="muted">
            Nothing is due. Nothing is open that you have not applied to, no application has gone
            quiet, and no outreach is waiting on a follow-up. Check the Timeline for what is coming.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {board.queue.map((q, i) => {
            const showDate = i === 0 || board.queue[i - 1].due !== q.due;
            const isToday = q.due === today;
            const isPast = q.due < today;
            const d = new Date(`${q.due}T12:00:00Z`);
            return (
              <div key={q.id} className="queue-row">
                <div className="queue-date">
                  {showDate && (
                    <>
                      <div className={`queue-day${isToday || isPast ? " today" : ""}`}>
                        {d.getUTCDate()}
                      </div>
                      <div className="eyebrow">
                        {d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {isToday
                          ? "today"
                          : d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
                      </div>
                    </>
                  )}
                </div>

                <div className="queue-rail">
                  <span
                    className={`queue-dot ${q.priority === "P0" ? "p0" : q.priority === "P1" ? "p1" : ""}`}
                  />
                  {i < board.queue.length - 1 && <span className="queue-line" />}
                </div>

                <div className={`card queue-card${q.priority === "P0" ? " p0" : ""}`}>
                  <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                    <span
                      className={`tag ${
                        q.priority === "P0"
                          ? "tag-accent"
                          : q.priority === "P1"
                            ? "tag-outline"
                            : "tag-neutral"
                      }`}
                      style={{ marginTop: 2 }}
                    >
                      {q.priority}
                    </span>
                    <div className="grow">
                      <div className="eyebrow nums" style={{ color: "var(--color-accent-700)" }}>
                        {isPast
                          ? `Overdue · was due ${formatDay(q.due)}`
                          : isToday
                            ? `Today · ${formatDay(q.due)}`
                            : `Due ${formatDay(q.due)}`}
                      </div>
                      <div style={{ fontWeight: 700 }}>{q.title}</div>
                      <div className="muted" style={{ marginTop: 2 }}>
                        {q.detail}
                      </div>
                    </div>
                    {q.link && (
                      <button
                        className="btn btn-ghost small"
                        onClick={() => goTo(q.link!.tab as TabId, q.link!.id)}
                      >
                        open
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="muted" style={{ marginTop: "var(--space-3)" }}>
        Status checks fire at {board.config.statusCheckDays} days of silence, follow-ups at{" "}
        {board.config.followUpDays} days after a touch, and a company you have applied to wants{" "}
        {board.config.contactsPerCompany} people inside it.
      </p>
    </>
  );
}
