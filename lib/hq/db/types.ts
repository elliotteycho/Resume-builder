import type {
  Application,
  Company,
  Contact,
  ExperienceCard,
  Match,
  Note,
  Posting,
  Profile,
  ResearchBrief,
  ResumeVersion,
  StageEvent,
  StoredEvidence,
  UsageEntry,
} from "@/lib/hq/types";

/**
 * The entire database as one document.
 *
 * Table names match `supabase/migrations/0001_init.sql`. Any adapter — the
 * bundled JSON one, or a Postgres one later — reads and writes these
 * collections, so swapping the backing store never changes calling code.
 */
export type HqData = {
  companies: Company[];
  postings: Posting[];
  profiles: Profile[];
  experience_cards: ExperienceCard[];
  evidence: StoredEvidence[];
  applications: Application[];
  stage_events: StageEvent[];
  notes: Note[];
  contacts: Contact[];
  matches: Match[];
  research_briefs: ResearchBrief[];
  resume_versions: ResumeVersion[];
  usage_log: UsageEntry[];
};

export const EMPTY_DATA: HqData = {
  companies: [],
  postings: [],
  profiles: [],
  experience_cards: [],
  evidence: [],
  applications: [],
  stage_events: [],
  notes: [],
  contacts: [],
  matches: [],
  research_briefs: [],
  resume_versions: [],
  usage_log: [],
};

export interface HqStore {
  read(): Promise<HqData>;
  /**
   * Apply `mutate` to the current data and persist the result atomically.
   * Writes are serialized, so read-modify-write inside `mutate` is safe.
   */
  write<T>(mutate: (data: HqData) => T): Promise<{ data: HqData; result: T }>;
}
