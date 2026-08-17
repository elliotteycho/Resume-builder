import { getServiceClient } from "@/lib/hq/supabase";
import { HQ_CONFIG } from "@/lib/hq/config";
import { daysSince } from "@/lib/hq/dates";
import { HttpError } from "@/lib/hq/http";
import { contactsForCompany } from "@/lib/hq/queue";
import type {
  Application,
  Company,
  Contact,
  ExperienceCardWithEvidence,
  Match,
  Note,
  Posting,
  PostingView,
  Profile,
  ResearchBrief,
  ResumeVersion,
  StageEvent,
  StoredEvidence,
  UsageEntry,
} from "@/lib/hq/types";
import type { CardInput, HqRepo, Timeline, UpsertPostingInput } from "@/lib/hq/repo/types";

/**
 * The multi-user implementation of `HqRepo`, over Supabase Postgres.
 *
 * Column names in `supabase/migrations/0001_init.sql` mirror the TS types
 * one-for-one, so rows pass through without mapping. All queries run under the
 * service role — ownership is enforced here by filtering on user_id (the id
 * always comes from the session via `currentUserId()`), with RLS behind it as
 * defense in depth and as the guarantee for any future client-side access.
 */

const db = () => getServiceClient();
const now = () => new Date().toISOString();

/** Unwrap a PostgREST response, throwing on error. */
function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`[supabase] ${res.error.message}`);
  if (res.data === null) throw new Error("[supabase] expected a row and got none");
  return res.data;
}

/** Unwrap a response where "no row" is a valid outcome. */
function maybe<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(`[supabase] ${res.error.message}`);
  return res.data;
}

/** PostgREST `ilike` treats % and _ as wildcards; we mean them literally. */
const literal = (s: string) => s.replace(/[%_]/g, (c) => `\\${c}`);

async function markStaleForUser(userId: string): Promise<void> {
  ok(await db().from("matches").update({ stale: true }).eq("user_id", userId).select("id"));
}

async function markStaleForPosting(postingId: string): Promise<void> {
  ok(await db().from("matches").update({ stale: true }).eq("posting_id", postingId).select("id"));
}

// ---------- profile ----------

async function getProfile(userId: string): Promise<Profile> {
  const row = maybe<Profile>(
    await db().from("profiles").select("*").eq("user_id", userId).maybeSingle()
  );
  if (!row) {
    // Profiles are only created by invite redemption; a missing row means the
    // account was never activated.
    throw new HttpError(
      "invite_required",
      "This pilot is invite-only. Enter your invite code to activate your account.",
      403
    );
  }
  return row;
}

async function updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile> {
  const { user_id: _drop, created_at: _drop2, ...fields } = patch;
  void _drop;
  void _drop2;
  const row = ok<Profile>(
    await db()
      .from("profiles")
      .update({ ...fields, updated_at: now() })
      .eq("user_id", userId)
      .select("*")
      .single()
  );
  await markStaleForUser(userId);
  return row;
}

// ---------- experience cards ----------

async function listCards(userId: string): Promise<ExperienceCardWithEvidence[]> {
  const rows = ok<(ExperienceCardWithEvidence & { evidence: StoredEvidence[] })[]>(
    await db()
      .from("experience_cards")
      .select("*, evidence(*)")
      .eq("user_id", userId)
      .order("sort")
      .order("start_date")
  );
  return rows;
}

async function saveCard(userId: string, input: CardInput): Promise<ExperienceCardWithEvidence> {
  const { evidence, id, ...fields } = input;

  let cardId = id ?? null;
  if (cardId) {
    const updated = maybe<{ id: string }>(
      await db()
        .from("experience_cards")
        .update({ ...fields, updated_at: now() })
        .eq("id", cardId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle()
    );
    if (!updated) cardId = null; // unknown id → create instead, like local mode
  }
  if (!cardId) {
    const created = ok<{ id: string }>(
      await db()
        .from("experience_cards")
        .insert({
          user_id: userId,
          lane: fields.lane ?? "professional",
          title: fields.title ?? "",
          organization: fields.organization ?? "",
          location: fields.location ?? "",
          start_date: fields.start_date ?? "",
          end_date: fields.end_date ?? "",
          bullets: fields.bullets ?? [],
          skills: fields.skills ?? [],
          capabilities: fields.capabilities ?? [],
          link: fields.link ?? "",
          sort: fields.sort ?? 0,
        })
        .select("id")
        .single()
    );
    cardId = created.id;
  }

  if (evidence) {
    ok(await db().from("evidence").delete().eq("card_id", cardId).select("id"));
    if (evidence.length) {
      ok(
        await db()
          .from("evidence")
          .insert(evidence.map((e) => ({ ...e, user_id: userId, card_id: cardId })))
          .select("id")
      );
    }
  }

  await markStaleForUser(userId);
  return ok<ExperienceCardWithEvidence>(
    await db().from("experience_cards").select("*, evidence(*)").eq("id", cardId).single()
  );
}

async function deleteCard(userId: string, cardId: string): Promise<boolean> {
  const deleted = ok<{ id: string }[]>(
    await db()
      .from("experience_cards")
      .delete()
      .eq("id", cardId)
      .eq("user_id", userId)
      .select("id")
  );
  if (deleted.length) await markStaleForUser(userId);
  return deleted.length > 0;
}

async function replaceCards(
  userId: string,
  cards: CardInput[]
): Promise<ExperienceCardWithEvidence[]> {
  // Wholesale replace, matching local-mode semantics: a resume import is the
  // canonical statement of the user's experience. Evidence cascades on delete.
  ok(await db().from("experience_cards").delete().eq("user_id", userId).select("id"));

  const results: ExperienceCardWithEvidence[] = [];
  for (const [i, input] of cards.entries()) {
    const { evidence, ...fields } = input;
    const card = ok<ExperienceCardWithEvidence>(
      await db()
        .from("experience_cards")
        .insert({
          user_id: userId,
          lane: fields.lane ?? "professional",
          title: fields.title ?? "",
          organization: fields.organization ?? "",
          location: fields.location ?? "",
          start_date: fields.start_date ?? "",
          end_date: fields.end_date ?? "",
          bullets: fields.bullets ?? [],
          skills: fields.skills ?? [],
          capabilities: fields.capabilities ?? [],
          link: fields.link ?? "",
          sort: i,
        })
        .select("*")
        .single()
    );
    let rows: StoredEvidence[] = [];
    if (evidence?.length) {
      rows = ok<StoredEvidence[]>(
        await db()
          .from("evidence")
          .insert(evidence.map((e) => ({ ...e, user_id: userId, card_id: card.id })))
          .select("*")
      );
    }
    results.push({ ...card, evidence: rows });
  }

  await markStaleForUser(userId);
  return results;
}

// ---------- postings (shared layer) ----------

type PostingRow = Posting & { company: Company };

async function fetchPersonalLayers(userId: string) {
  const [applications, matches, contacts, notes] = await Promise.all([
    db().from("applications").select("*").eq("user_id", userId),
    db().from("matches").select("*").eq("user_id", userId),
    db().from("contacts").select("*").eq("user_id", userId),
    db().from("notes").select("*").eq("user_id", userId).is("application_id", null),
  ]);
  return {
    applications: ok<Application[]>(applications),
    matches: ok<Match[]>(matches),
    contacts: ok<Contact[]>(contacts),
    notes: ok<Note[]>(notes),
  };
}

function toView(
  row: PostingRow,
  personal: Awaited<ReturnType<typeof fetchPersonalLayers>>
): PostingView {
  const { company, ...posting } = row;
  const application =
    personal.applications.find((a) => a.posting_id === posting.id) ?? null;
  return {
    ...posting,
    company,
    application,
    match: personal.matches.find((m) => m.posting_id === posting.id) ?? null,
    contacts: contactsForCompany(personal.contacts, company.id, company.name),
    notes: personal.notes.filter((n) => n.company_id === company.id),
    days_since_applied: daysSince(application?.applied_date ?? null),
  };
}

async function listPostingViews(
  userId: string,
  opts: { season?: string; status?: string; q?: string } = {}
): Promise<PostingView[]> {
  let query = db().from("postings").select("*, company:companies(*)").order("created_at");
  if (opts.season) query = query.eq("season", opts.season);
  if (opts.status) query = query.eq("status", opts.status);

  const [rows, personal] = await Promise.all([query, fetchPersonalLayers(userId)]);
  return ok<PostingRow[]>(rows)
    .map((r) => toView(r, personal))
    .filter((v) => {
      if (!opts.q) return true;
      return `${v.company.name} ${v.program}`.toLowerCase().includes(opts.q.toLowerCase());
    });
}

async function getPostingView(userId: string, postingId: string): Promise<PostingView | null> {
  const [row, personal] = await Promise.all([
    db().from("postings").select("*, company:companies(*)").eq("id", postingId).maybeSingle(),
    fetchPersonalLayers(userId),
  ]);
  const posting = maybe<PostingRow>(row);
  return posting ? toView(posting, personal) : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function upsertPosting(
  input: UpsertPostingInput
): Promise<{ posting: Posting; company: Company; created: boolean }> {
  const slug = slugify(input.companyName);
  const season = input.season ?? HQ_CONFIG.defaultSeason;
  const program = input.program.trim();

  let company = maybe<Company>(
    await db().from("companies").select("*").eq("slug", slug).maybeSingle()
  );
  if (!company) {
    const inserted = await db()
      .from("companies")
      .insert({ slug, name: input.companyName.trim(), careers_url: input.careersUrl ?? "" })
      .select("*")
      .maybeSingle();
    // A concurrent contributor may have won the race on the unique slug.
    company =
      maybeIgnoringConflict<Company>(inserted) ??
      ok<Company>(await db().from("companies").select("*").eq("slug", slug).single());
  }

  let posting = maybe<Posting>(
    await db()
      .from("postings")
      .select("*")
      .eq("company_id", company.id)
      .eq("season", season)
      .ilike("program", literal(program))
      .maybeSingle()
  );
  const created = !posting;

  if (!posting) {
    const inserted = await db()
      .from("postings")
      .insert({
        company_id: company.id,
        program,
        url: input.url ?? "",
        portal: input.portal ?? "",
        season,
        status: input.status ?? "open",
        opened_at: input.status === "open" || !input.status ? now().slice(0, 10) : null,
        jd_text: input.jdText ?? "",
        source: input.source ?? "user",
        submitted_by: input.submittedBy ?? null,
      })
      .select("*")
      .maybeSingle();
    posting =
      maybeIgnoringConflict<Posting>(inserted) ??
      ok<Posting>(
        await db()
          .from("postings")
          .select("*")
          .eq("company_id", company.id)
          .eq("season", season)
          .ilike("program", literal(program))
          .single()
      );
  } else {
    const patch: Record<string, unknown> = { updated_at: now() };
    if (input.url) patch.url = input.url;
    if (input.portal) patch.portal = input.portal;
    if (input.status) patch.status = input.status;
    if (input.jdText && input.jdText !== posting.jd_text) {
      // Content changed: the cached analysis and everyone's match are suspect.
      patch.jd_text = input.jdText;
      patch.jd_analysis = null;
      patch.eligibility = null;
      patch.verified = false;
      await markStaleForPosting(posting.id);
    }
    posting = ok<Posting>(
      await db().from("postings").update(patch).eq("id", posting.id).select("*").single()
    );
  }

  return { posting, company, created };
}

/** Treat a unique-violation insert as "someone else created it first". */
function maybeIgnoringConflict<T>(res: {
  data: T | null;
  error: { message: string; code?: string } | null;
}): T | null {
  if (res.error) {
    if (res.error.code === "23505") return null;
    throw new Error(`[supabase] ${res.error.message}`);
  }
  return res.data;
}

async function saveJdAnalysis(
  postingId: string,
  analysis: Posting["jd_analysis"],
  eligibility: Posting["eligibility"]
): Promise<void> {
  ok(
    await db()
      .from("postings")
      .update({ jd_analysis: analysis, eligibility, updated_at: now() })
      .eq("id", postingId)
      .select("id")
  );
  await markStaleForPosting(postingId);
}

async function setPostingStatus(postingId: string, status: Posting["status"]): Promise<void> {
  const posting = maybe<Posting>(
    await db().from("postings").select("*").eq("id", postingId).maybeSingle()
  );
  if (!posting) return;
  const patch: Record<string, unknown> = { status, updated_at: now() };
  if (status === "open" && !posting.opened_at) patch.opened_at = now().slice(0, 10);
  if (status === "closed" && !posting.closed_at) patch.closed_at = now().slice(0, 10);
  ok(await db().from("postings").update(patch).eq("id", postingId).select("id"));
}

async function getCompany(companyId: string): Promise<Company | null> {
  return maybe<Company>(
    await db().from("companies").select("*").eq("id", companyId).maybeSingle()
  );
}

// ---------- applications ----------

async function listApplications(userId: string): Promise<Application[]> {
  return ok<Application[]>(await db().from("applications").select("*").eq("user_id", userId));
}

async function ensureApplication(
  userId: string,
  postingId: string,
  tier?: number
): Promise<Application> {
  const existing = maybe<Application>(
    await db()
      .from("applications")
      .select("*")
      .eq("user_id", userId)
      .eq("posting_id", postingId)
      .maybeSingle()
  );
  if (existing) return existing;

  const posting = maybe<Posting & { company: Company }>(
    await db().from("postings").select("*, company:companies(*)").eq("id", postingId).maybeSingle()
  );

  const inserted = await db()
    .from("applications")
    .insert({
      user_id: userId,
      posting_id: postingId,
      tier: tier ?? posting?.company.tier_default ?? 2,
    })
    .select("*")
    .maybeSingle();

  return (
    maybeIgnoringConflict<Application>(inserted) ??
    ok<Application>(
      await db()
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .eq("posting_id", postingId)
        .single()
    )
  );
}

async function patchApplication(
  userId: string,
  applicationId: string,
  patch: Partial<
    Pick<Application, "stage" | "tier" | "applied_date" | "next_action" | "resume_version_id">
  >
): Promise<Application | null> {
  const app = maybe<Application>(
    await db()
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .eq("user_id", userId)
      .maybeSingle()
  );
  if (!app) return null;

  const fields: Record<string, unknown> = { ...patch, updated_at: now() };
  // Advancing to "applied" without a date is the single most common way a
  // tracker loses the thread, so stamp it.
  if (patch.stage === "applied" && !app.applied_date && !patch.applied_date) {
    fields.applied_date = now().slice(0, 10);
  }

  const updated = ok<Application>(
    await db()
      .from("applications")
      .update(fields)
      .eq("id", applicationId)
      .select("*")
      .single()
  );

  if (patch.stage && patch.stage !== app.stage) {
    ok(
      await db()
        .from("stage_events")
        .insert({
          application_id: applicationId,
          user_id: userId,
          from_stage: app.stage,
          to_stage: patch.stage,
        })
        .select("id")
    );
  }
  return updated;
}

async function getTimeline(userId: string, applicationId: string): Promise<Timeline | null> {
  const app = maybe<Application>(
    await db()
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .eq("user_id", userId)
      .maybeSingle()
  );
  if (!app) return null;

  const posting = maybe<Posting & { company: Company }>(
    await db()
      .from("postings")
      .select("*, company:companies(*)")
      .eq("id", app.posting_id)
      .maybeSingle()
  );
  const company = posting?.company;

  const [events, notes, contacts] = await Promise.all([
    db().from("stage_events").select("*").eq("application_id", applicationId),
    company
      ? db()
          .from("notes")
          .select("*")
          .eq("user_id", userId)
          .or(`application_id.eq.${applicationId},company_id.eq.${company.id}`)
      : Promise.resolve({ data: [] as Note[], error: null }),
    db().from("contacts").select("*").eq("user_id", userId),
  ]);

  const entries = [
    ...ok<StageEvent[]>(events).map((e) => ({
      at: e.at,
      kind: "stage" as const,
      text: e.from_stage ? `${e.from_stage} → ${e.to_stage}` : `Added as ${e.to_stage}`,
      note: e.note,
    })),
    ...ok<Note[]>(notes).map((n) => ({
      at: n.created_at,
      kind: "note" as const,
      text: n.body,
      note: "",
    })),
    ...(company
      ? contactsForCompany(ok<Contact[]>(contacts), company.id, company.name)
          .filter((c) => c.last_touch)
          .map((c) => ({
            at: `${c.last_touch}T12:00:00.000Z`,
            kind: "contact" as const,
            text: `${c.name} — ${c.status}`,
            note: c.notes,
          }))
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return posting
    ? { application: app, posting: stripCompany(posting), company, entries }
    : { application: app, posting: undefined, company: undefined, entries };
}

function stripCompany(row: Posting & { company: Company }): Posting {
  const { company: _drop, ...posting } = row;
  void _drop;
  return posting;
}

// ---------- contacts & notes ----------

async function listContacts(userId: string): Promise<Contact[]> {
  return ok<Contact[]>(
    await db()
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("company_name")
      .order("name")
  );
}

async function createContact(userId: string, input: Partial<Contact>): Promise<Contact> {
  let companyId = input.company_id ?? null;
  if (!companyId && input.company_name?.trim()) {
    const company = maybe<{ id: string }>(
      await db()
        .from("companies")
        .select("id")
        .ilike("name", literal(input.company_name.trim()))
        .maybeSingle()
    );
    companyId = company?.id ?? null;
  }
  return ok<Contact>(
    await db()
      .from("contacts")
      .insert({
        user_id: userId,
        company_id: companyId,
        company_name: input.company_name?.trim() ?? "",
        name: input.name?.trim() ?? "",
        role: input.role ?? "",
        channel: input.channel ?? "LinkedIn",
        linkedin_url: input.linkedin_url ?? "",
        angle: input.angle ?? "",
        kind: input.kind ?? "other",
        status: input.status ?? "to-reach",
        touches: input.touches ?? 0,
        last_touch: input.last_touch ?? null,
        notes: input.notes ?? "",
      })
      .select("*")
      .single()
  );
}

async function patchContact(
  userId: string,
  contactId: string,
  patch: Partial<Contact>
): Promise<Contact | null> {
  const contact = maybe<Contact>(
    await db()
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .eq("user_id", userId)
      .maybeSingle()
  );
  if (!contact) return null;

  const { id: _drop, user_id: _drop2, created_at: _drop3, ...fields } = patch;
  void _drop;
  void _drop2;
  void _drop3;
  const updates: Record<string, unknown> = { ...fields, updated_at: now() };
  // Moving to "sent" is a touch; stamp the date so follow-ups can be computed.
  if (patch.status && patch.status !== contact.status) {
    updates.last_touch = now().slice(0, 10);
    if (patch.status === "sent") updates.touches = contact.touches + 1;
  }
  return ok<Contact>(
    await db().from("contacts").update(updates).eq("id", contactId).select("*").single()
  );
}

async function deleteContact(userId: string, contactId: string): Promise<boolean> {
  const deleted = ok<{ id: string }[]>(
    await db().from("contacts").delete().eq("id", contactId).eq("user_id", userId).select("id")
  );
  return deleted.length > 0;
}

async function saveCompanyNote(userId: string, companyId: string, body: string): Promise<Note> {
  const existing = maybe<Note>(
    await db()
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .is("application_id", null)
      .maybeSingle()
  );
  if (existing) {
    return ok<Note>(
      await db()
        .from("notes")
        .update({ body, updated_at: now() })
        .eq("id", existing.id)
        .select("*")
        .single()
    );
  }
  return ok<Note>(
    await db()
      .from("notes")
      .insert({ user_id: userId, company_id: companyId, body })
      .select("*")
      .single()
  );
}

// ---------- matches ----------

async function getMatch(userId: string, postingId: string): Promise<Match | null> {
  return maybe<Match>(
    await db()
      .from("matches")
      .select("*")
      .eq("user_id", userId)
      .eq("posting_id", postingId)
      .maybeSingle()
  );
}

async function saveMatch(match: Omit<Match, "id">): Promise<Match> {
  return ok<Match>(
    await db()
      .from("matches")
      .upsert(match, { onConflict: "user_id,posting_id" })
      .select("*")
      .single()
  );
}

// ---------- research ----------

async function getResearchBrief(
  userId: string,
  companyId: string
): Promise<ResearchBrief | null> {
  return maybe<ResearchBrief>(
    await db()
      .from("research_briefs")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle()
  );
}

async function saveResearchBrief(brief: Omit<ResearchBrief, "id">): Promise<ResearchBrief> {
  return ok<ResearchBrief>(
    await db()
      .from("research_briefs")
      .upsert(brief, { onConflict: "user_id,company_id" })
      .select("*")
      .single()
  );
}

// ---------- generated resumes ----------

async function saveResumeVersion(version: Omit<ResumeVersion, "id">): Promise<ResumeVersion> {
  return ok<ResumeVersion>(
    await db().from("resume_versions").insert(version).select("*").single()
  );
}

async function listResumeVersions(userId: string): Promise<ResumeVersion[]> {
  return ok<ResumeVersion[]>(
    await db()
      .from("resume_versions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
  );
}

// ---------- usage ledger ----------

async function recordUsage(entry: Omit<UsageEntry, "id" | "created_at">): Promise<void> {
  ok(await db().from("usage_log").insert(entry).select("id"));
}

async function monthlyUsage(month: string): Promise<UsageEntry[]> {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return ok<UsageEntry[]>(
    await db()
      .from("usage_log")
      .select("*")
      .gte("created_at", `${month}-01`)
      .lt("created_at", `${next}-01`)
  );
}

export const supabaseRepo: HqRepo = {
  getProfile,
  updateProfile,
  listCards,
  saveCard,
  deleteCard,
  replaceCards,
  listPostingViews,
  getPostingView,
  upsertPosting,
  saveJdAnalysis,
  setPostingStatus,
  getCompany,
  listApplications,
  ensureApplication,
  patchApplication,
  getTimeline,
  listContacts,
  createContact,
  patchContact,
  deleteContact,
  saveCompanyNote,
  getMatch,
  saveMatch,
  getResearchBrief,
  saveResearchBrief,
  saveResumeVersion,
  listResumeVersions,
  recordUsage,
  monthlyUsage,
};
