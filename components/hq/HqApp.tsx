"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type Board } from "@/lib/hq/client";
import { HQ_CONFIG } from "@/lib/hq/config";
import TodayTab from "@/components/hq/TodayTab";
import TimelineTab from "@/components/hq/TimelineTab";
import CompaniesTab from "@/components/hq/CompaniesTab";
import PeopleTab from "@/components/hq/PeopleTab";

export type TabId = "today" | "timeline" | "companies" | "people";

/**
 * The tracker shell. One fetch of `/api/applications` feeds every tab, and
 * every mutation refreshes it — the server stays the source of truth for the
 * queue, which is derived and cannot be patched locally without drifting.
 */
export default function HqApp() {
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<TabId>("today");
  const [focus, setFocus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBoard(await api.board());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the board");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goTo = useCallback((next: TabId, id?: string) => {
    setTab(next);
    setFocus(id ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (error && !board) {
    return (
      <main>
        <div className="error">{error}</div>
      </main>
    );
  }

  if (!board) {
    return (
      <main>
        <p className="muted">Loading your season…</p>
      </main>
    );
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "today", label: "Today" },
    { id: "timeline", label: "Timeline" },
    { id: "companies", label: "Companies", count: board.items.length },
    { id: "people", label: "People", count: board.contacts.length },
  ];

  return (
    <>
      <div className="hq-hero no-print">
        <div className="hq-hero-inner">
          <div className="eyebrow">
            {HQ_CONFIG.defaultSeason.replace("-", " ")} · the fall season
          </div>
          <div className="spread">
            <h1>Internship HQ</h1>
            <div className="muted">
              {board.summary.applied} applied · {board.summary.openNotApplied} open now
            </div>
          </div>
        </div>
      </div>

      <main>
        <nav className="hq-tabs no-print">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`pill${tab === t.id ? " on" : ""}`}
              onClick={() => goTo(t.id)}
            >
              {t.label}
              {t.count !== undefined && <span className="count">{t.count}</span>}
            </button>
          ))}
          <Link
            href="/profile"
            className="pill"
            style={{ marginLeft: "auto", textDecoration: "none" }}
          >
            Profile →
          </Link>
        </nav>

        {error && <div className="error">{error}</div>}

        {tab === "today" && <TodayTab board={board} goTo={goTo} />}
        {tab === "timeline" && <TimelineTab board={board} goTo={goTo} />}
        {tab === "companies" && (
          <CompaniesTab board={board} focus={focus} refresh={refresh} onError={setError} />
        )}
        {tab === "people" && (
          <PeopleTab board={board} refresh={refresh} onError={setError} />
        )}
      </main>
    </>
  );
}
