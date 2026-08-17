import { z } from "zod";
import { EvidenceSchema, JobAnalysisSchema } from "@/lib/types";
import {
  CONTACT_STATUSES,
  LANES,
  RADAR_BUCKETS,
  STAGES,
} from "@/lib/hq/config";

/**
 * Wire + storage shapes for Internship HQ.
 *
 * These mirror `supabase/migrations/0001_init.sql` one-for-one so the JSON
 * store and a future Postgres store hold identical rows. Timestamps are ISO
 * strings everywhere; dates are `YYYY-MM-DD`.
 */

// ---------- shared layer ----------

export const CompanySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  careers_url: z.string().default(""),
  tier_default: z.number().int().min(1).max(3).default(2),
  created_at: z.string(),
});
export type Company = z.infer<typeof CompanySchema>;

/**
 * Deterministic screening criteria for a posting. Derived by the enrichment
 * agent from the JD's qualifications, then checked in code — never by model
 * judgment at match time.
 */
export const EligibilitySchema = z.object({
  grad_years: z.array(z.string()).default([]),
  class_years: z.array(z.number().int()).default([]),
  degree_levels: z
    .array(z.enum(["bachelors", "masters", "mba", "phd"]))
    .default([]),
  fields: z.array(z.string()).default([]),
  min_gpa: z.number().nullable().default(null),
  requires_citizenship: z.boolean().default(false),
  requires_clearance: z.boolean().default(false),
  requires_sponsorship_free: z.boolean().default(false),
  min_years_experience: z.number().nullable().default(null),
  notes: z.string().default(""),
});
export type Eligibility = z.infer<typeof EligibilitySchema>;

export const PostingSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  program: z.string(),
  url: z.string().default(""),
  portal: z.string().default(""),
  season: z.string(),
  status: z.enum(["watching", "open", "closed"]).default("watching"),
  window_expected: z.string().default(""),
  window_note: z.string().default(""),
  short_window: z.boolean().default(false),
  radar: z.enum(RADAR_BUCKETS).nullable().default(null),
  opened_at: z.string().nullable().default(null),
  closed_at: z.string().nullable().default(null),
  jd_text: z.string().default(""),
  jd_analysis: JobAnalysisSchema.nullable().default(null),
  eligibility: EligibilitySchema.nullable().default(null),
  source: z.enum(["seed", "user", "scan"]).default("seed"),
  submitted_by: z.string().nullable().default(null),
  verified: z.boolean().default(false),
  last_verified_at: z.string().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Posting = z.infer<typeof PostingSchema>;

// ---------- personal layer ----------

export const ProfileSchema = z.object({
  user_id: z.string(),
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  school: z.string().default(""),
  grad_year: z.string().default(""),
  /** 1 = freshman … 4 = senior. Drives class-standing eligibility checks. */
  class_year: z.number().int().nullable().default(null),
  majors: z.array(z.string()).default([]),
  gpa: z.number().nullable().default(null),
  degree_level: z
    .enum(["bachelors", "masters", "mba", "phd"])
    .default("bachelors"),
  work_authorization: z
    .enum(["citizen", "permanent-resident", "needs-sponsorship", "unspecified"])
    .default("unspecified"),
  years_experience: z.number().default(0),
  target_role: z.string().default(""),
  links: z.array(z.string()).default([]),
  summary: z.string().default(""),
  resume_file_name: z.string().default(""),
  resume_uploaded_at: z.string().nullable().default(null),
  resume_text: z.string().default(""),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const StoredEvidenceSchema = EvidenceSchema.extend({
  id: z.string(),
  card_id: z.string(),
});
export type StoredEvidence = z.infer<typeof StoredEvidenceSchema>;

export const ExperienceCardSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  lane: z.enum(LANES),
  title: z.string(),
  organization: z.string().default(""),
  location: z.string().default(""),
  /** `YYYY-MM`, per the timeline's month resolution. */
  start_date: z.string().default(""),
  /** `YYYY-MM`, or empty for "present". */
  end_date: z.string().default(""),
  bullets: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  /** Concept-level signals for matching: "prioritization under ambiguity". */
  capabilities: z.array(z.string()).default([]),
  link: z.string().default(""),
  sort: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ExperienceCard = z.infer<typeof ExperienceCardSchema>;

/** A card with its evidence rows joined on — the shape the UI and agents see. */
export type ExperienceCardWithEvidence = ExperienceCard & {
  evidence: StoredEvidence[];
};

export const ApplicationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  posting_id: z.string(),
  stage: z.enum(STAGES).default("watching"),
  tier: z.number().int().min(1).max(3).default(2),
  applied_date: z.string().nullable().default(null),
  next_action: z.string().default(""),
  resume_version_id: z.string().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const StageEventSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  user_id: z.string(),
  from_stage: z.string().nullable().default(null),
  to_stage: z.string(),
  note: z.string().default(""),
  at: z.string(),
});
export type StageEvent = z.infer<typeof StageEventSchema>;

export const NoteSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  company_id: z.string().nullable().default(null),
  application_id: z.string().nullable().default(null),
  body: z.string(),
  pinned: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

export const ContactSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  company_id: z.string().nullable().default(null),
  company_name: z.string().default(""),
  name: z.string(),
  role: z.string().default(""),
  channel: z.string().default("LinkedIn"),
  linkedin_url: z.string().default(""),
  /** Why this person: "Vanderbilt alum, 2 years out, same org". */
  angle: z.string().default(""),
  /** 'alum' | 'recruiter' | 'team' | 'referral' | 'other' — drives grouping. */
  kind: z
    .enum(["alum", "recruiter", "team", "referral", "other"])
    .default("other"),
  status: z.enum(CONTACT_STATUSES).default("to-reach"),
  touches: z.number().int().default(0),
  last_touch: z.string().nullable().default(null),
  notes: z.string().default(""),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Contact = z.infer<typeof ContactSchema>;

// ---------- match ----------

export const MatchReasonSchema = z.object({
  card_id: z.string().describe("Exact id of the experience card this cites"),
  theme: z.string().describe("The JD theme this card answers"),
  reasoning: z
    .string()
    .describe("One sentence: how this specific card demonstrates that theme"),
});

/** The cheap-path match agent's structured output. */
export const MatchResultSchema = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0-100 fit score. Be strict: 70+ means genuinely competitive"),
  headline: z
    .string()
    .describe("One sentence a student could act on, no hedging"),
  reasons: z
    .array(MatchReasonSchema)
    .describe(
      "Which experience cards answer which JD themes. Cite real card ids only."
    ),
  gaps: z
    .array(z.string())
    .describe(
      "Requirements the bank genuinely cannot support. Honest, never padded."
    ),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

export const MatchSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  posting_id: z.string(),
  score: z.number().int().min(0).max(100),
  verdict: z.enum(["apply", "review", "skip"]),
  eligibility_pass: z.boolean(),
  blockers: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  headline: z.string().default(""),
  reasons: z.array(MatchReasonSchema).default([]),
  gaps: z.array(z.string()).default([]),
  model: z.string().default(""),
  computed_at: z.string(),
  stale: z.boolean().default(false),
});
export type Match = z.infer<typeof MatchSchema>;

// ---------- research / network ----------

export const NetworkTargetSchema = z.object({
  name: z
    .string()
    .describe(
      "Named person if research surfaced one, otherwise an archetype like 'Vanderbilt alum, PM, 1-3 years out'"
    ),
  role: z.string().describe("Their role or the role to look for"),
  kind: z
    .enum(["alum", "recruiter", "team", "referral", "other"])
    .describe("alum = school connection, recruiter = university recruiting"),
  why: z
    .string()
    .describe("Why this person specifically — the warm angle that exists"),
  how_to_find: z
    .string()
    .describe(
      "Concrete search: the LinkedIn filter combination or directory to use"
    ),
  linkedin_search_url: z
    .string()
    .describe("A linkedin.com/search/results/people/?keywords=… URL"),
  ask: z
    .string()
    .describe("The single clear ask to make of this person — not 'pick your brain'"),
  opener: z
    .string()
    .describe(
      "A 2-3 sentence outreach message, specific to this company and the student's real background. No flattery, no buzzwords."
    ),
});

export const CompanyBriefSchema = z.object({
  company: z.string(),
  one_liner: z.string().describe("What the company actually does, plainly"),
  recent: z
    .array(z.string())
    .describe("3-5 current developments: launches, funding, reorgs, earnings"),
  product_org: z
    .string()
    .describe("How product is organized here and what PMs actually own"),
  interview_process: z
    .array(z.string())
    .describe("Known stages of this program's process, in order"),
  school_angle: z
    .string()
    .describe(
      "This company's relationship to the student's school: campus recruiting, alumni density, target-school status. Say plainly if there is none."
    ),
  talking_points: z
    .array(z.string())
    .describe("Specific things to reference in outreach or interviews"),
  targets: z
    .array(NetworkTargetSchema)
    .describe("3-5 people or archetypes to reach, warmest first"),
  sources: z.array(z.string()).describe("URLs the research drew on"),
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export const ResearchBriefSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  company_id: z.string(),
  brief: CompanyBriefSchema,
  model: z.string().default(""),
  created_at: z.string(),
});
export type ResearchBrief = z.infer<typeof ResearchBriefSchema>;

// ---------- generated resumes ----------

export const ResumeVersionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  posting_id: z.string().nullable().default(null),
  label: z.string().default(""),
  resume: z.unknown(),
  reframe: z.unknown().nullable().default(null),
  verification: z.unknown().nullable().default(null),
  metric_audit: z.unknown().nullable().default(null),
  created_at: z.string(),
});
export type ResumeVersion = z.infer<typeof ResumeVersionSchema>;

// ---------- usage ledger ----------

/** The metered actions — the ones that bill the API key. */
export const USAGE_KINDS = ["import", "match", "brief", "generate"] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

export const UsageEntrySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  kind: z.enum(USAGE_KINDS),
  /** Estimated cost in cents — action-level estimates, not token-metered. */
  est_cost_cents: z.number().int(),
  created_at: z.string(),
});
export type UsageEntry = z.infer<typeof UsageEntrySchema>;

// ---------- derived (never stored) ----------

export type QueueItem = {
  id: string;
  priority: "P0" | "P1" | "P2";
  due: string; // ISO date
  overdue: boolean;
  title: string;
  detail: string;
  /** Where the UI should send the user: a route + optional focus id. */
  link: { tab: "today" | "companies" | "people" | "profile"; id?: string } | null;
};

/** A posting joined with everything the caller needs to render one row. */
export type PostingView = Posting & {
  company: Company;
  application: Application | null;
  match: Match | null;
  contacts: Contact[];
  notes: Note[];
  days_since_applied: number | null;
};
