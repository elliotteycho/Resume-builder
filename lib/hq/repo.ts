import { randomUUID } from "crypto";
import { getStore } from "@/lib/hq/db";
import type { HqData } from "@/lib/hq/db/types";
import { daysSince } from "@/lib/hq/dates";
import { contactsForCompany } from "@/lib/hq/queue";
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
  StageEvent,
  StoredEvidence,
} from "@/lib/hq/types";
import { HQ_CONFIG, type Stage } from "@/lib/hq/config";

/**
 * Every read and write the routes perform. Route handlers stay thin: parse,
 * call one of these, return JSON. Business rules that outlive a single request
 * (stage events, cache invalidation, dedupe) live here, not in the routes.
 */

const now = () => new Date().toISOString();

// ---------- profile ----------

export async function getProfile(userId: string): Promise<Profile> {
  const data = await getStore().read();
  const found = data.profiles.find((p) => p.user_id === userId);
  if (found) return found;
  // A user with no row yet still gets a usable profile object.
  const { result } = await getStore().write((d) => {
    const existing = d.profiles.find((p) => p.user_id === userId);
    if (existing) return existing;
    const created: Profile = {
      user_id: userId,
      name: "",
      email: "",
      phone: "",
      location: "",
      school: "",
      grad_year: "",
      class_year: null,
      majors: [],
      gpa: null,
      degree_level: "bachelors",
      work_authorization: "unspecified",
      years_experience: 0,
      target_role: "",
      links: [],
      summary: "",
      resume_file_name: "",
      resume_uploaded_at: null,
      resume_text: "",
      created_at: now(),
      updated_at: now(),
    };
    d.profiles.push(created);
    return created;
  });
  return result;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Profile>
): Promise<Profile> {
  await getProfile(userId);
  const { result } = await getStore().write((d) => {
    const profile = d.profiles.find((p) => p.user_id === userId)!;
    Object.assign(profile, patch, {
      user_id: userId,
      updated_at: now(),
    });
    // Profile edits change what the matcher sees, so every cached match for
    // this user is suspect until recomputed.
    markStale(d, (m) => m.user_id === userId);
    return profile;
  });
  return result;
}

// ---------- experience cards ----------

export async function listCards(
  userId: string
): Promise<ExperienceCardWithEvidence[]> {
  const data = await getStore().read();
  return data.experience_cards
    .filter((c) => c.user_id === userId)
    .sort((a, b) => a.sort - b.sort || a.start_date.localeCompare(b.start_date))
    .map((c) => ({
      ...c,
      evidence: data.evidence.filter((e) => e.card_id === c.id),
    }));
}

export async function saveCard(
  userId: string,
  input: Partial<ExperienceCard> & { evidence?: Omit<StoredEvidence, "id" | "card_id">[] }
): Promise<ExperienceCardWithEvidence> {
  const { result } = await getStore().write((d) => {
    let card = input.id
      ? d.experience_cards.find((c) => c.id === input.id && c.user_id === userId)
      : undefined;

    if (!card) {
      card = {
        id: input.id ?? randomUUID(),
        user_id: userId,
        lane: input.lane ?? "professional",
        title: input.title ?? "",
        organization: input.organization ?? "",
        location: input.location ?? "",
        start_date: input.start_date ?? "",
        end_date: input.end_date ?? "",
        bullets: input.bullets ?? [],
        skills: input.skills ?? [],
        capabilities: input.capabilities ?? [],
        link: input.link ?? "",
        sort: input.sort ?? d.experience_cards.length,
        created_at: now(),
        updated_at: now(),
      };
      d.experience_cards.push(card);
    } else {
      const { evidence: _drop, ...fields } = input;
      void _drop;
      Object.assign(card, fields, { id: card.id, user_id: userId, updated_at: now() });
    }

    if (input.evidence) {
      d.evidence = d.evidence.filter((e) => e.card_id !== card!.id);
      for (const e of input.evidence) {
        d.evidence.push({ ...e, id: randomUUID(), card_id: card!.id });
      }
    }

    markStale(d, (m) => m.user_id === userId);
    return {
      ...card,
      evidence: d.evidence.filter((e) => e.card_id === card!.id),
    };
  });
  return result;
}

export async function deleteCard(userId: string, cardId: string): Promise<boolean> {
  const { result } = await getStore().write((d) => {
    const before = d.experience_cards.length;
    d.experience_cards = d.experience_cards.filter(
      (c) => !(c.id === cardId && c.user_id === userId)
    );
    d.evidence = d.evidence.filter((e) => e.card_id !== cardId);
    markStale(d, (m) => m.user_id === userId);
    return d.experience_cards.length < before;
  });
  return result;
}

/** Bulk import — used by the resume parser, which produces a whole bank at once. */
export async function replaceCards(
  userId: string,
  cards: (Partial<ExperienceCard> & {
    evidence?: Omit<StoredEvidence, "id" | "card_id">[];
  })[]
): Promise<ExperienceCardWithEvidence[]> {
  const { result } = await getStore().write((d) => {
    const mine = d.experience_cards.filter((c) => c.user_id === userId);
    const mineIds = new Set(mine.map((c) => c.id));
    d.experience_cards = d.experience_cards.filter((c) => c.user_id !== userId);
    d.evidence = d.evidence.filter((e) => !mineIds.has(e.card_id));

    const created: ExperienceCardWithEvidence[] = [];
    cards.forEach((input, i) => {
      const card: ExperienceCard = {
        id: randomUUID(),
        user_id: userId,
        lane: input.lane ?? "professional",
        title: input.title ?? "",
        organization: input.organization ?? "",
        location: input.location ?? "",
        start_date: input.start_date ?? "",
        end_date: input.end_date ?? "",
        bullets: input.bullets ?? [],
        skills: input.skills ?? [],
        capabilities: input.capabilities ?? [],
        link: input.link ?? "",
        sort: i,
        created_at: now(),
        updated_at: now(),
      };
      d.experience_cards.push(card);
      const evidence = (input.evidence ?? []).map((e) => ({
        ...e,
        id: randomUUID(),
        card_id: card.id,
      }));
      d.evidence.push(...evidence);
      created.push({ ...card, evidence });
    });

    markStale(d, (m) => m.user_id === userId);
    return created;
  });
  return result;
}

// ---------- postings ----------

export async function listPostingViews(
  userId: string,
  opts: { season?: string; status?: string; q?: string } = {}
): Promise<PostingView[]> {
  const data = await getStore().read();
  const contacts = data.contacts.filter((c) => c.user_id === userId);

  return data.postings
    .filter((p) => (opts.season ? p.season === opts.season : true))
    .filter((p) => (opts.status ? p.status === opts.status : true))
    .map((p) => toView(data, userId, p, contacts))
    .filter((v) => {
      if (!opts.q) return true;
      const hay = `${v.company.name} ${v.program}`.toLowerCase();
      return hay.includes(opts.q.toLowerCase());
    });
}

export async function getPostingView(
  userId: string,
  postingId: string
): Promise<PostingView | null> {
  const data = await getStore().read();
  const posting = data.postings.find((p) => p.id === postingId);
  if (!posting) return null;
  const contacts = data.contacts.filter((c) => c.user_id === userId);
  return toView(data, userId, posting, contacts);
}

function toView(
  data: HqData,
  userId: string,
  posting: Posting,
  contacts: Contact[]
): PostingView {
  const company = data.companies.find((c) => c.id === posting.company_id)!;
  const application =
    data.applications.find(
      (a) => a.user_id === userId && a.posting_id === posting.id
    ) ?? null;
  return {
    ...posting,
    company,
    application,
    match:
      data.matches.find(
        (m) => m.user_id === userId && m.posting_id === posting.id
      ) ?? null,
    contacts: contactsForCompany(contacts, company.id, company.name),
    notes: data.notes.filter(
      (n) => n.user_id === userId && n.company_id === company.id
    ),
    days_since_applied: daysSince(application?.applied_date ?? null),
  };
}

/**
 * Add a posting the user found themselves, or update the matching one.
 * Dedupe key is (company slug, program, season) per the handoff — the same
 * program contributed twice must not fork the shared row.
 */
export async function upsertPosting(input: {
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
}): Promise<{ posting: Posting; company: Company; created: boolean }> {
  const slug = slugify(input.companyName);
  const season = input.season ?? HQ_CONFIG.defaultSeason;

  const { result } = await getStore().write((d) => {
    let company = d.companies.find((c) => c.slug === slug);
    if (!company) {
      company = {
        id: randomUUID(),
        slug,
        name: input.companyName.trim(),
        careers_url: input.careersUrl ?? "",
        tier_default: 2,
        created_at: now(),
      };
      d.companies.push(company);
    }

    const program = input.program.trim();
    let posting = d.postings.find(
      (p) =>
        p.company_id === company!.id &&
        p.season === season &&
        p.program.toLowerCase() === program.toLowerCase()
    );
    const created = !posting;

    if (!posting) {
      posting = {
        id: randomUUID(),
        company_id: company.id,
        program,
        url: input.url ?? "",
        portal: input.portal ?? "",
        season,
        status: input.status ?? "open",
        window_expected: "",
        window_note: "",
        short_window: false,
        radar: null,
        opened_at: input.status === "open" ? now().slice(0, 10) : null,
        closed_at: null,
        jd_text: input.jdText ?? "",
        jd_analysis: null,
        eligibility: null,
        source: input.source ?? "user",
        submitted_by: input.submittedBy ?? null,
        verified: false,
        last_verified_at: null,
        created_at: now(),
        updated_at: now(),
      };
      d.postings.push(posting);
    } else {
      // Keep the earliest created_at; refresh what the contributor supplied.
      if (input.url) posting.url = input.url;
      if (input.portal) posting.portal = input.portal;
      if (input.status) posting.status = input.status;
      if (input.jdText && input.jdText !== posting.jd_text) {
        posting.jd_text = input.jdText;
        // Content changed: the cached analysis and everyone's match are suspect.
        posting.jd_analysis = null;
        posting.eligibility = null;
        posting.verified = false;
        markStale(d, (m) => m.posting_id === posting!.id);
      }
      posting.updated_at = now();
    }

    return { posting, company, created };
  });
  return result;
}

export async function saveJdAnalysis(
  postingId: string,
  analysis: Posting["jd_analysis"],
  eligibility: Posting["eligibility"]
): Promise<void> {
  await getStore().write((d) => {
    const posting = d.postings.find((p) => p.id === postingId);
    if (!posting) return;
    posting.jd_analysis = analysis;
    posting.eligibility = eligibility;
    posting.updated_at = now();
    // A changed analysis invalidates every user's match on this posting.
    markStale(d, (m) => m.posting_id === postingId);
  });
}

export async function setPostingStatus(
  postingId: string,
  status: Posting["status"]
): Promise<void> {
  await getStore().write((d) => {
    const posting = d.postings.find((p) => p.id === postingId);
    if (!posting) return;
    posting.status = status;
    if (status === "open" && !posting.opened_at) posting.opened_at = now().slice(0, 10);
    if (status === "closed" && !posting.closed_at) posting.closed_at = now().slice(0, 10);
    posting.updated_at = now();
  });
}

// ---------- applications ----------

export async function listApplications(userId: string): Promise<Application[]> {
  const data = await getStore().read();
  return data.applications.filter((a) => a.user_id === userId);
}

export async function ensureApplication(
  userId: string,
  postingId: string,
  tier?: number
): Promise<Application> {
  const { result } = await getStore().write((d) => {
    const existing = d.applications.find(
      (a) => a.user_id === userId && a.posting_id === postingId
    );
    if (existing) return existing;
    const posting = d.postings.find((p) => p.id === postingId);
    const company = d.companies.find((c) => c.id === posting?.company_id);
    const created: Application = {
      id: randomUUID(),
      user_id: userId,
      posting_id: postingId,
      stage: "watching",
      tier: tier ?? company?.tier_default ?? 2,
      applied_date: null,
      next_action: "",
      resume_version_id: null,
      created_at: now(),
      updated_at: now(),
    };
    d.applications.push(created);
    return created;
  });
  return result;
}

export async function patchApplication(
  userId: string,
  applicationId: string,
  patch: Partial<Pick<Application, "stage" | "tier" | "applied_date" | "next_action" | "resume_version_id">>
): Promise<Application | null> {
  const { result } = await getStore().write((d) => {
    const app = d.applications.find(
      (a) => a.id === applicationId && a.user_id === userId
    );
    if (!app) return null;

    const from = app.stage;
    Object.assign(app, patch, { updated_at: now() });

    // Advancing to "applied" without a date is the single most common way a
    // tracker loses the thread, so stamp it.
    if (patch.stage === "applied" && !app.applied_date) {
      app.applied_date = now().slice(0, 10);
    }
    if (patch.stage && patch.stage !== from) {
      const event: StageEvent = {
        id: randomUUID(),
        application_id: app.id,
        user_id: userId,
        from_stage: from,
        to_stage: patch.stage,
        note: "",
        at: now(),
      };
      d.stage_events.push(event);
    }
    return app;
  });
  return result;
}

/** Stage events, notes, and contact touches merged into one chronology. */
export async function getTimeline(userId: string, applicationId: string) {
  const data = await getStore().read();
  const app = data.applications.find(
    (a) => a.id === applicationId && a.user_id === userId
  );
  if (!app) return null;
  const posting = data.postings.find((p) => p.id === app.posting_id);
  const company = data.companies.find((c) => c.id === posting?.company_id);

  const entries = [
    ...data.stage_events
      .filter((e) => e.application_id === applicationId)
      .map((e) => ({
        at: e.at,
        kind: "stage" as const,
        text: e.from_stage ? `${e.from_stage} → ${e.to_stage}` : `Added as ${e.to_stage}`,
        note: e.note,
      })),
    ...data.notes
      .filter((n) => n.application_id === applicationId || (company && n.company_id === company.id))
      .map((n) => ({ at: n.created_at, kind: "note" as const, text: n.body, note: "" })),
    ...(company
      ? contactsForCompany(
          data.contacts.filter((c) => c.user_id === userId),
          company.id,
          company.name
        )
          .filter((c) => c.last_touch)
          .map((c) => ({
            at: `${c.last_touch}T12:00:00.000Z`,
            kind: "contact" as const,
            text: `${c.name} — ${c.status}`,
            note: c.notes,
          }))
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return { application: app, posting, company, entries };
}

// ---------- contacts ----------

export async function listContacts(userId: string): Promise<Contact[]> {
  const data = await getStore().read();
  return data.contacts
    .filter((c) => c.user_id === userId)
    .sort((a, b) => a.company_name.localeCompare(b.company_name) || a.name.localeCompare(b.name));
}

export async function createContact(
  userId: string,
  input: Partial<Contact>
): Promise<Contact> {
  const { result } = await getStore().write((d) => {
    const companyId =
      input.company_id ??
      d.companies.find(
        (c) => c.name.toLowerCase() === (input.company_name ?? "").trim().toLowerCase()
      )?.id ??
      null;
    const contact: Contact = {
      id: randomUUID(),
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
      created_at: now(),
      updated_at: now(),
    };
    d.contacts.push(contact);
    return contact;
  });
  return result;
}

export async function patchContact(
  userId: string,
  contactId: string,
  patch: Partial<Contact>
): Promise<Contact | null> {
  const { result } = await getStore().write((d) => {
    const contact = d.contacts.find((c) => c.id === contactId && c.user_id === userId);
    if (!contact) return null;
    const wasStatus = contact.status;
    Object.assign(contact, patch, { id: contact.id, user_id: userId, updated_at: now() });
    // Moving to "sent" is a touch; stamp the date so follow-ups can be computed.
    if (patch.status && patch.status !== wasStatus) {
      contact.last_touch = now().slice(0, 10);
      if (patch.status === "sent") contact.touches = contact.touches + 1;
    }
    return contact;
  });
  return result;
}

export async function deleteContact(userId: string, contactId: string): Promise<boolean> {
  const { result } = await getStore().write((d) => {
    const before = d.contacts.length;
    d.contacts = d.contacts.filter((c) => !(c.id === contactId && c.user_id === userId));
    return d.contacts.length < before;
  });
  return result;
}

// ---------- notes ----------

export async function saveCompanyNote(
  userId: string,
  companyId: string,
  body: string
): Promise<Note> {
  const { result } = await getStore().write((d) => {
    let note = d.notes.find(
      (n) => n.user_id === userId && n.company_id === companyId && !n.application_id
    );
    if (!note) {
      note = {
        id: randomUUID(),
        user_id: userId,
        company_id: companyId,
        application_id: null,
        body,
        pinned: false,
        created_at: now(),
        updated_at: now(),
      };
      d.notes.push(note);
    } else {
      note.body = body;
      note.updated_at = now();
    }
    return note;
  });
  return result;
}

// ---------- matches ----------

export async function getMatch(
  userId: string,
  postingId: string
): Promise<Match | null> {
  const data = await getStore().read();
  return (
    data.matches.find((m) => m.user_id === userId && m.posting_id === postingId) ??
    null
  );
}

export async function saveMatch(match: Omit<Match, "id">): Promise<Match> {
  const { result } = await getStore().write((d) => {
    const existing = d.matches.find(
      (m) => m.user_id === match.user_id && m.posting_id === match.posting_id
    );
    if (existing) {
      Object.assign(existing, match, { id: existing.id });
      return existing;
    }
    const created: Match = { ...match, id: randomUUID() };
    d.matches.push(created);
    return created;
  });
  return result;
}

function markStale(data: HqData, pred: (m: Match) => boolean) {
  for (const m of data.matches) {
    if (pred(m)) m.stale = true;
  }
}

// ---------- research ----------

export async function getResearchBrief(
  userId: string,
  companyId: string
): Promise<ResearchBrief | null> {
  const data = await getStore().read();
  return (
    data.research_briefs.find(
      (r) => r.user_id === userId && r.company_id === companyId
    ) ?? null
  );
}

export async function saveResearchBrief(
  brief: Omit<ResearchBrief, "id">
): Promise<ResearchBrief> {
  const { result } = await getStore().write((d) => {
    d.research_briefs = d.research_briefs.filter(
      (r) => !(r.user_id === brief.user_id && r.company_id === brief.company_id)
    );
    const created: ResearchBrief = { ...brief, id: randomUUID() };
    d.research_briefs.push(created);
    return created;
  });
  return result;
}

// ---------- resume versions ----------

export async function saveResumeVersion(
  version: Omit<ResumeVersion, "id">
): Promise<ResumeVersion> {
  const { result } = await getStore().write((d) => {
    const created: ResumeVersion = { ...version, id: randomUUID() };
    d.resume_versions.push(created);
    return created;
  });
  return result;
}

export async function listResumeVersions(userId: string): Promise<ResumeVersion[]> {
  const data = await getStore().read();
  return data.resume_versions
    .filter((r) => r.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getCompany(companyId: string): Promise<Company | null> {
  const data = await getStore().read();
  return data.companies.find((c) => c.id === companyId) ?? null;
}

export function stageLabelOf(stage: Stage): Stage {
  return stage;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
