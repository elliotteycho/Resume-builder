import type {
  Application,
  Company,
  Contact,
  ExperienceCard,
  ExperienceCardWithEvidence,
  Match,
  Note,
  Posting,
  PostingView,
  Profile,
  ResearchBrief,
  ResumeVersion,
  StoredEvidence,
  UsageEntry,
} from "@/lib/hq/types";

/**
 * Every read and write the routes perform, as one interface.
 *
 * Two implementations: `json.ts` (local mode, one user, a JSON file) and
 * `supabase.ts` (multi-user mode, Postgres with RLS behind it). Routes import
 * from `@/lib/hq/repo` and never know which one they got, so the storage
 * decision stays a deployment decision.
 *
 * Contract notes an implementation must honor:
 * - Every personal-row query filters on user_id; callers pass an id they got
 *   from `currentUserId()`, never from request input.
 * - Writes to a user's cards or profile mark that user's matches stale;
 *   changing a posting's jd_text/analysis marks that posting's matches stale
 *   for everyone.
 * - `upsertPosting` dedupes on (company, season, program) case-insensitively —
 *   the same program contributed twice must not fork the shared row.
 */

export type CardInput = Partial<ExperienceCard> & {
  evidence?: Omit<StoredEvidence, "id" | "card_id">[];
};

export type UpsertPostingInput = {
  companyName: string;
  careersUrl?: string;
  program: string;
  season?: string;
  url?: string;
  portal?: string;
  jdText?: string;
  status?: Posting["status"];
  submittedBy?: string;
  source?: Posting["source"];
};

export type TimelineEntry = {
  at: string;
  kind: "stage" | "note" | "contact";
  text: string;
  note: string;
};

export type Timeline = {
  application: Application;
  posting: Posting | undefined;
  company: Company | undefined;
  entries: TimelineEntry[];
};

export interface HqRepo {
  // profile
  getProfile(userId: string): Promise<Profile>;
  updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile>;

  // experience cards
  listCards(userId: string): Promise<ExperienceCardWithEvidence[]>;
  saveCard(userId: string, input: CardInput): Promise<ExperienceCardWithEvidence>;
  deleteCard(userId: string, cardId: string): Promise<boolean>;
  replaceCards(userId: string, cards: CardInput[]): Promise<ExperienceCardWithEvidence[]>;

  // postings (shared layer)
  listPostingViews(
    userId: string,
    opts?: { season?: string; status?: string; q?: string }
  ): Promise<PostingView[]>;
  getPostingView(userId: string, postingId: string): Promise<PostingView | null>;
  upsertPosting(
    input: UpsertPostingInput
  ): Promise<{ posting: Posting; company: Company; created: boolean }>;
  saveJdAnalysis(
    postingId: string,
    analysis: Posting["jd_analysis"],
    eligibility: Posting["eligibility"]
  ): Promise<void>;
  setPostingStatus(postingId: string, status: Posting["status"]): Promise<void>;
  getCompany(companyId: string): Promise<Company | null>;

  // applications
  listApplications(userId: string): Promise<Application[]>;
  ensureApplication(userId: string, postingId: string, tier?: number): Promise<Application>;
  patchApplication(
    userId: string,
    applicationId: string,
    patch: Partial<
      Pick<Application, "stage" | "tier" | "applied_date" | "next_action" | "resume_version_id">
    >
  ): Promise<Application | null>;
  getTimeline(userId: string, applicationId: string): Promise<Timeline | null>;

  // contacts & notes
  listContacts(userId: string): Promise<Contact[]>;
  createContact(userId: string, input: Partial<Contact>): Promise<Contact>;
  patchContact(userId: string, contactId: string, patch: Partial<Contact>): Promise<Contact | null>;
  deleteContact(userId: string, contactId: string): Promise<boolean>;
  saveCompanyNote(userId: string, companyId: string, body: string): Promise<Note>;

  // matches
  getMatch(userId: string, postingId: string): Promise<Match | null>;
  saveMatch(match: Omit<Match, "id">): Promise<Match>;

  // research
  getResearchBrief(userId: string, companyId: string): Promise<ResearchBrief | null>;
  saveResearchBrief(brief: Omit<ResearchBrief, "id">): Promise<ResearchBrief>;

  // generated resumes
  saveResumeVersion(version: Omit<ResumeVersion, "id">): Promise<ResumeVersion>;
  listResumeVersions(userId: string): Promise<ResumeVersion[]>;

  // usage ledger
  recordUsage(entry: Omit<UsageEntry, "id" | "created_at">): Promise<void>;
  /** Every entry in a calendar month ('YYYY-MM'), all users — the cap checks both. */
  monthlyUsage(month: string): Promise<UsageEntry[]>;
}
