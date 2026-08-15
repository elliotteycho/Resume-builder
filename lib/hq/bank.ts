import { buildGeneratorView, type GeneratorView } from "@/lib/evidence";
import { formatMonth } from "@/lib/hq/dates";
import type { ExperienceBank } from "@/lib/types";
import type { ExperienceCardWithEvidence, Profile } from "@/lib/hq/types";

/**
 * The bridge between experience cards (how the app stores and shows a career)
 * and `ExperienceBank` (what the resume pipeline already consumes).
 *
 * Card ids are carried through as entry ids, so the evidence layer's redaction
 * can be read back per card — which is what lets the matcher cite a specific
 * card and the Profile UI light it up.
 */

const laneSection = (lane: string) =>
  lane === "projects" ? "projects" : lane === "education" ? "education" : "work";

export function cardsToBank(
  profile: Profile,
  cards: ExperienceCardWithEvidence[]
): ExperienceBank {
  const bank: ExperienceBank = {
    profile: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      links: profile.links,
      summary: profile.summary,
    },
    work: [],
    projects: [],
    education: [],
    skills: [],
    certifications: [],
    awards: [],
  };

  for (const card of cards) {
    const section = laneSection(card.lane);
    const evidence = card.evidence.map((e) => ({
      metric: e.metric,
      claim: e.claim,
      provenance: e.provenance,
      confidence: e.confidence,
    }));

    if (section === "work") {
      bank.work.push({
        id: card.id,
        title: card.title,
        organization: card.organization,
        location: card.location,
        start: formatMonth(card.start_date),
        end: card.end_date ? formatMonth(card.end_date) : "Present",
        bullets: card.bullets,
        skills: card.skills,
        evidence,
      });
    } else if (section === "projects") {
      bank.projects.push({
        id: card.id,
        name: card.title || card.organization,
        description: card.organization,
        bullets: card.bullets,
        skills: card.skills,
        link: card.link,
        evidence,
      });
    } else {
      bank.education.push({
        id: card.id,
        institution: card.organization,
        degree: card.title,
        field: card.skills.join(", "),
        graduation: card.end_date ? formatMonth(card.end_date) : "",
        details: card.bullets,
      });
    }

    for (const s of card.skills) {
      if (!bank.skills.includes(s)) bank.skills.push(s);
    }
  }

  return bank;
}

/** One card as the matcher sees it: evidence-filtered, numbers redacted. */
export type MatchCardView = {
  id: string;
  lane: string;
  title: string;
  organization: string;
  period: string;
  bullets: string[];
  capabilities: string[];
  skills: string[];
  evidence: { metric: string; claim: string }[];
};

/**
 * The same discipline the resume generator gets, applied to matching: a card's
 * unverified numbers are invisible here too, so a match reason can never cite a
 * metric the resume itself would refuse to print.
 */
export function buildMatchView(
  profile: Profile,
  cards: ExperienceCardWithEvidence[]
): { cards: MatchCardView[]; view: GeneratorView } {
  const view = buildGeneratorView(cardsToBank(profile, cards));

  const byId = new Map<string, { bullets: string[]; evidence: { metric: string; claim: string }[] }>();
  for (const w of view.visibleBank.work) {
    byId.set(w.id, {
      bullets: w.bullets,
      evidence: w.evidence.map((e) => ({ metric: e.metric, claim: e.claim })),
    });
  }
  for (const p of view.visibleBank.projects) {
    byId.set(p.id, {
      bullets: p.bullets,
      evidence: p.evidence.map((e) => ({ metric: e.metric, claim: e.claim })),
    });
  }

  const out: MatchCardView[] = cards.map((card) => {
    const filtered = byId.get(card.id);
    return {
      id: card.id,
      lane: card.lane,
      title: card.title,
      organization: card.organization,
      period: `${formatMonth(card.start_date)} - ${card.end_date ? formatMonth(card.end_date) : "Present"}`,
      bullets: filtered?.bullets ?? card.bullets,
      capabilities: card.capabilities,
      skills: card.skills,
      evidence: filtered?.evidence ?? [],
    };
  });

  return { cards: out, view };
}
