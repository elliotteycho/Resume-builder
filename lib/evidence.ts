import type { Evidence, ExperienceBank, MetricAuditEntry, Resume } from "@/lib/types";

/**
 * The evidence layer: retrieval decides the facts, generation decides only
 * the selection and phrasing. This module builds the "generator view" of the
 * experience bank — the only version any prompt ever sees:
 *   - evidence records flagged `low` confidence are removed entirely
 *   - numeric tokens in prose that aren't backed by visible evidence are
 *     redacted, so untagged numbers can't leak past the evidence layer
 *   - the allowed-token set is derived from the view itself: a number is
 *     permitted in output iff the generator was actually shown it
 */

export const REDACTION_MARKER = "[unverified metric removed]";

// Numeric tokens like $1.8M, 40%, 3,000+, 4x, 85, 12.
// Lookarounds keep letter-adjacent digits out (Q4, 2nd, ids like "k3j9").
const TOKEN_RE = /(?<![A-Za-z0-9])\$?\d[\d,]*(?:\.\d+)?(?:%|\+|[xkmb](?![A-Za-z0-9]))?(?![A-Za-z0-9])/gi;

export function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[$,]/g, "");
}

export function isBareYear(token: string): boolean {
  return /^(19|20)\d{2}$/.test(token.replace(/[$,]/g, ""));
}

/** Extract metric tokens from text, excluding bare years (dates are exempt facts). */
export function extractMetricTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    if (!isBareYear(m[0])) out.push(m[0]);
  }
  return out;
}

export type EvidenceIndexEntry = {
  metric: string;
  entry: string;
  provenance: string;
  confidence: "high" | "medium";
};

export type GeneratorView = {
  visibleBank: ExperienceBank;
  allowedTokens: Set<string>;
  evidenceIndex: Map<string, EvidenceIndexEntry[]>;
  evidenceLines: string[]; // human-readable list for revision prompts
};

export function buildGeneratorView(bank: ExperienceBank): GeneratorView {
  const visible: ExperienceBank = structuredClone(bank);
  const evidenceIndex = new Map<string, EvidenceIndexEntry[]>();
  const evidenceLines: string[] = [];
  const evidenceTokens = new Set<string>();

  const registerEvidence = (entryName: string, evidence: Evidence[]): Evidence[] => {
    const kept = evidence.filter((e) => e.confidence !== "low");
    for (const e of kept) {
      const conf = e.confidence as "high" | "medium";
      evidenceLines.push(`"${e.metric}" — ${e.claim} | ${entryName}${e.provenance ? ` | source: ${e.provenance}` : ""} [${conf}]`);
      for (const raw of e.metric.matchAll(TOKEN_RE)) {
        const norm = normalizeToken(raw[0]);
        evidenceTokens.add(norm);
        evidenceIndex.set(norm, [
          ...(evidenceIndex.get(norm) ?? []),
          { metric: e.metric, entry: entryName, provenance: e.provenance, confidence: conf },
        ]);
      }
    }
    return kept;
  };

  const redact = (text: string): string =>
    text.replace(TOKEN_RE, (tok) =>
      isBareYear(tok) || evidenceTokens.has(normalizeToken(tok)) ? tok : REDACTION_MARKER
    );

  // Pass 1: register all visible evidence (redaction matches against the
  // full set so a metric verified on one entry isn't shredded elsewhere).
  for (const w of visible.work) w.evidence = registerEvidence(`${w.title}, ${w.organization}`, w.evidence);
  for (const p of visible.projects) p.evidence = registerEvidence(p.name, p.evidence);

  // Pass 2: redact untagged numbers from performance prose. Identity facts
  // (profile, education, skills, certifications, awards, dates) pass through.
  for (const w of visible.work) w.bullets = w.bullets.map(redact);
  for (const p of visible.projects) {
    p.bullets = p.bullets.map(redact);
    p.description = redact(p.description);
  }

  // The invariant: allowed tokens = every numeric token present in the view.
  const allowedTokens = new Set<string>();
  for (const m of JSON.stringify(visible).matchAll(TOKEN_RE)) {
    allowedTokens.add(normalizeToken(m[0]));
  }

  return { visibleBank: visible, allowedTokens, evidenceIndex, evidenceLines };
}

/** Map every metric token used in the final resume back to its evidence record. */
export function buildMetricAudit(resume: Resume, evidenceIndex: Map<string, EvidenceIndexEntry[]>): MetricAuditEntry[] {
  const texts: string[] = [resume.header.tagline, resume.summary];
  for (const section of resume.sections) {
    for (const entry of section.entries) {
      texts.push(entry.inline);
      for (const b of entry.bullets) texts.push(b.text);
    }
  }

  const seen = new Set<string>();
  const audit: MetricAuditEntry[] = [];
  for (const text of texts) {
    for (const token of extractMetricTokens(text)) {
      const norm = normalizeToken(token);
      if (seen.has(norm)) continue;
      seen.add(norm);
      const matches = evidenceIndex.get(norm);
      if (matches && matches.length > 0) {
        audit.push({ token, entry: matches[0].entry, provenance: matches[0].provenance, confidence: matches[0].confidence });
      } else {
        audit.push({
          token,
          entry: "experience bank",
          provenance: "identity fact (education, certification, award, or profile)",
          confidence: "identity",
        });
      }
    }
  }
  return audit;
}
