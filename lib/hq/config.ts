/**
 * Every threshold, label, and tunable in Internship HQ lives here.
 *
 * Nothing downstream inlines a number. Changing a rule means editing this file
 * (or, later, reading these values from a `settings` table) — never hunting
 * through route handlers.
 */

export const HQ_CONFIG = {
  /** Days after applying with no movement before a status check is due. */
  statusCheckDays: 10,
  /** Days after an outreach touch with no reply before a follow-up is due. */
  followUpDays: 5,
  /** Days after applying to still count an application as "fresh". */
  freshDays: 7,
  /** Contacts worth having inside a company you have applied to. */
  contactsPerCompany: 2,
  /** Max outreach touches to one person without a reply. */
  maxTouchesWithoutReply: 2,
  /** A cached match older than this is recomputed even if not flagged stale. */
  matchMaxAgeDays: 30,
  /** Verdict thresholds for the cheap match score. */
  matchThresholds: { apply: 70, review: 45 },
  /** Default season new postings land in. */
  defaultSeason: "summer-2027",

  /**
   * Spend controls, enforced only in multi-user mode (a local install is the
   * owner's own key). Quotas are per user per calendar month, counted in
   * actions; costs are action-level estimates in cents, not token metering —
   * good enough to bound the bill, cheap enough to check on every call.
   */
  quotas: {
    import: { perMonth: 3, estCostCents: 15 },
    match: { perMonth: 40, estCostCents: 8 },
    brief: { perMonth: 6, estCostCents: 50 },
    generate: { perMonth: 4, estCostCents: 250 },
  },
  /** Global monthly ceiling across all users, in cents. Env-overridable. */
  spendCapCents: Number(process.env.HQ_SPEND_CAP_USD ?? 50) * 100,
} as const;

export const STAGES = [
  "watching",
  "open",
  "applied",
  "interviewing",
  "offer",
  "closed",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  watching: "Watching",
  open: "Open now",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  closed: "Closed",
};

/** Stages that mean "this application is live in the funnel". */
export const LIVE_STAGES: Stage[] = ["applied", "interviewing", "offer"];

/** Display order on the Companies board: urgency first. */
export const STAGE_ORDER: Record<Stage, number> = {
  open: 0,
  interviewing: 1,
  applied: 2,
  watching: 3,
  offer: 4,
  closed: 5,
};

export const CONTACT_STATUSES = [
  "to-reach",
  "sent",
  "replied",
  "call-set",
  "met",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  "to-reach": "To reach",
  sent: "Sent",
  replied: "Replied",
  "call-set": "Call set",
  met: "Met",
};

/** Clicking a contact's status chip advances it along this cycle. */
export const NEXT_CONTACT_STATUS: Record<ContactStatus, ContactStatus> = {
  "to-reach": "sent",
  sent: "replied",
  replied: "call-set",
  "call-set": "met",
  met: "to-reach",
};

export const LANES = [
  "professional",
  "projects",
  "leadership",
  "education",
] as const;
export type Lane = (typeof LANES)[number];

export const LANE_LABELS: Record<Lane, string> = {
  professional: "Professional",
  projects: "Projects & Research",
  leadership: "Leadership",
  education: "Education",
};

/** Radar buckets: when a watched posting is expected to open. */
export const RADAR_BUCKETS = ["now", "aug", "sep", "oct", "nov", "dec"] as const;
export type Radar = (typeof RADAR_BUCKETS)[number];

export const RADAR_LABELS: Record<Radar, string> = {
  now: "Rolling",
  aug: "August",
  sep: "September",
  oct: "October",
  nov: "November",
  dec: "December+",
};

export const PRIORITIES = ["P0", "P1", "P2"] as const;
export type Priority = (typeof PRIORITIES)[number];
