import type {
  Contact,
  ExperienceCardWithEvidence,
  Match,
  PostingView,
  Profile,
  QueueItem,
  ResearchBrief,
} from "@/lib/hq/types";
import type { Stage } from "@/lib/hq/config";

/** Browser-side API wrappers. One place that knows the routes and the error shape. */

export type Board = {
  items: PostingView[];
  contacts: Contact[];
  queue: QueueItem[];
  summary: {
    applied: number;
    openNotApplied: number;
    interviewing: number;
    contacts: number;
  };
  config: {
    statusCheckDays: number;
    followUpDays: number;
    contactsPerCompany: number;
  };
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  board: () => req<Board>("/api/applications"),

  profile: () => req<{ profile: Profile; cards: ExperienceCardWithEvidence[] }>("/api/profile"),

  saveProfile: (patch: Partial<Profile>) =>
    req<{ profile: Profile }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  importResumeFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return req<{ profile: Profile; cards: ExperienceCardWithEvidence[] }>(
      "/api/profile/resume",
      { method: "POST", body: form }
    );
  },

  importResumeText: (text: string) =>
    req<{ profile: Profile; cards: ExperienceCardWithEvidence[] }>("/api/profile/resume", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  saveCard: (card: Partial<ExperienceCardWithEvidence>) =>
    card.id
      ? req<{ card: ExperienceCardWithEvidence }>(`/api/cards/${card.id}`, {
          method: "PUT",
          body: JSON.stringify(card),
        })
      : req<{ card: ExperienceCardWithEvidence }>("/api/cards", {
          method: "POST",
          body: JSON.stringify(card),
        }),

  deleteCard: (id: string) => req<{ deleted: string }>(`/api/cards/${id}`, { method: "DELETE" }),

  addPosting: (body: { jd_text: string; company?: string; program?: string; url?: string }) =>
    req<{ posting: PostingView }>("/api/postings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  setPostingStatus: (postingId: string, status: "watching" | "open" | "closed") =>
    req<{ posting: PostingView }>(`/api/postings/${postingId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  /** Stage changes need an application row; create one on first touch. */
  setStage: async (view: PostingView, stage: Stage) => {
    let applicationId = view.application?.id;
    if (!applicationId) {
      const created = await req<{ application: { id: string } }>("/api/applications", {
        method: "POST",
        body: JSON.stringify({ posting_id: view.id }),
      });
      applicationId = created.application.id;
    }
    return req<{ posting: PostingView }>(`/api/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
  },

  saveNote: (companyId: string, body: string) =>
    req<unknown>("/api/notes", {
      method: "POST",
      body: JSON.stringify({ company_id: companyId, body }),
    }),

  addContact: (contact: Partial<Contact>) =>
    req<{ contact: Contact }>("/api/contacts", {
      method: "POST",
      body: JSON.stringify(contact),
    }),

  patchContact: (id: string, patch: Partial<Contact>) =>
    req<{ contact: Contact }>(`/api/contacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteContact: (id: string) =>
    req<{ deleted: string }>(`/api/contacts/${id}`, { method: "DELETE" }),

  match: (postingId: string, force = false) =>
    req<{ match: Match }>(`/api/match/${postingId}${force ? "?force=1" : ""}`, {
      method: "POST",
    }),

  research: (companyId: string) =>
    req<{ brief: ResearchBrief }>(`/api/research/${companyId}`, { method: "POST" }),

  cachedResearch: (companyId: string) =>
    req<{ brief: ResearchBrief | null }>(`/api/research/${companyId}`),
};
