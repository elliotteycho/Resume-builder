import { HQ_CONFIG, LIVE_STAGES } from "@/lib/hq/config";
import { addDays, daysSince, todayISO } from "@/lib/hq/dates";
import type {
  Application,
  Contact,
  Posting,
  PostingView,
  QueueItem,
} from "@/lib/hq/types";

/**
 * The "do next" queue is derived state — computed on every read from postings,
 * applications, and contact touches. It is never stored, so changing a
 * threshold in `HQ_CONFIG` changes every user's queue instantly and there is no
 * stale copy to reconcile.
 *
 * Priorities:
 *   P0 — a door is open right now and closing
 *   P1 — a thread has gone cold and needs a touch
 *   P2 — preparation for a window that has not opened yet
 */

const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2 } as const;

export function buildQueue(
  views: PostingView[],
  contacts: Contact[],
  now: Date = new Date()
): QueueItem[] {
  const today = todayISO(now);
  const items: QueueItem[] = [];

  const applied = views.filter(
    (v) => v.application && LIVE_STAGES.includes(v.application.stage)
  );

  // P0: open, not yet applied. Every day of delay on a rolling review costs
  // odds, so these are always due today.
  for (const v of views) {
    const stage = v.application?.stage;
    if (v.status !== "open") continue;
    if (stage && LIVE_STAGES.includes(stage)) continue;
    if (stage === "closed") continue;
    items.push({
      id: `apply:${v.id}`,
      priority: "P0",
      due: today,
      overdue: false,
      title: `Apply to ${v.company.name}`,
      detail: [`${v.program} is live.`, v.window_note].filter(Boolean).join(" "),
      link: { tab: "companies", id: v.id },
    });
  }

  // P1: applied somewhere with nobody inside. The week after applying is when
  // a referral still moves the needle.
  const uncovered = applied.filter(
    (v) =>
      contactsForCompany(contacts, v.company.id, v.company.name).length <
      HQ_CONFIG.contactsPerCompany
  );
  if (uncovered.length) {
    items.push({
      id: "referrals",
      priority: "P1",
      due: addDays(today, 3),
      overdue: false,
      title: `Referral hunt: ${uncovered.map((v) => v.company.name).join(", ")}`,
      detail: `Applied with fewer than ${HQ_CONFIG.contactsPerCompany} contacts inside. Warm intros still land in the first week.`,
      link: { tab: "people" },
    });
  }

  // P1: applications that have gone quiet past the status-check threshold.
  for (const v of applied) {
    const appliedDate = v.application?.applied_date;
    if (!appliedDate) continue;
    const elapsed = daysSince(appliedDate, now);
    if (elapsed === null || elapsed < HQ_CONFIG.statusCheckDays) continue;
    const due = addDays(appliedDate, HQ_CONFIG.statusCheckDays);
    items.push({
      id: `status:${v.id}`,
      priority: "P1",
      due,
      overdue: due < today,
      title: `Status check: ${v.company.name}`,
      detail: `${elapsed} days since applying with no recorded movement.`,
      link: { tab: "companies", id: v.id },
    });
  }

  // P1: outreach sent, no reply, past the follow-up threshold.
  for (const c of contacts) {
    if (c.status !== "sent" || !c.last_touch) continue;
    if (c.touches >= HQ_CONFIG.maxTouchesWithoutReply) continue;
    const elapsed = daysSince(c.last_touch, now);
    if (elapsed === null || elapsed < HQ_CONFIG.followUpDays) continue;
    const due = addDays(c.last_touch, HQ_CONFIG.followUpDays);
    items.push({
      id: `followup:${c.id}`,
      priority: "P1",
      due,
      overdue: due < today,
      title: `Follow up: ${c.name}${c.company_name ? ` (${c.company_name})` : ""}`,
      detail: `${elapsed} days since your last touch with no reply.`,
      link: { tab: "people", id: c.id },
    });
  }

  // P2: the short-window wave. These open for days, not weeks — materials have
  // to exist before the door opens, not after.
  const short = views.filter((v) => v.status === "watching" && v.short_window);
  if (short.length) {
    const soonest = short
      .map((v) => v.window_expected)
      .filter(Boolean)
      .slice(0, 1)[0];
    items.push({
      id: "short-windows",
      priority: "P2",
      due: addDays(today, 14),
      overdue: false,
      title: "Prep the short-window wave",
      detail: `${short
        .map((v) => v.company.name)
        .join(", ")} open for days, not weeks.${soonest ? ` First up: ${soonest.toLowerCase()}.` : ""} Base materials must be ready before the doors open.`,
      link: { tab: "companies" },
    });
  }

  return items.sort(
    (a, b) =>
      a.due.localeCompare(b.due) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.title.localeCompare(b.title)
  );
}

/** Contacts are linked by company id when known, by name otherwise. */
export function contactsForCompany(
  contacts: Contact[],
  companyId: string | null,
  companyName: string
): Contact[] {
  const target = companyName.trim().toLowerCase();
  return contacts.filter(
    (c) =>
      (companyId && c.company_id === companyId) ||
      (!!target && c.company_name.trim().toLowerCase() === target)
  );
}

/** Headline counters for the Today tiles. */
export function summarize(views: PostingView[], contacts: Contact[]) {
  const stageOf = (a: Application | null) => a?.stage ?? null;
  return {
    applied: views.filter((v) => {
      const s = stageOf(v.application);
      return s !== null && LIVE_STAGES.includes(s);
    }).length,
    openNotApplied: views.filter((v) => {
      const s = stageOf(v.application);
      return v.status === "open" && !(s && LIVE_STAGES.includes(s));
    }).length,
    interviewing: views.filter((v) => stageOf(v.application) === "interviewing")
      .length,
    contacts: contacts.length,
  };
}

/** Postings whose window is closing soonest, for the timeline's "next steps". */
export function upcoming(postings: Posting[]): Posting[] {
  const order = { now: 0, aug: 1, sep: 2, oct: 3, nov: 4, dec: 5 } as const;
  return postings
    .filter((p) => p.status === "watching")
    .sort(
      (a, b) =>
        (order[a.radar ?? "dec"] ?? 9) - (order[b.radar ?? "dec"] ?? 9) ||
        Number(b.short_window) - Number(a.short_window)
    );
}
