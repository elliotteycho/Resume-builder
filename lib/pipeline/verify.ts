import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODEL } from "@/lib/anthropic";
import { SYNTHESIS_RULES } from "@/lib/pipeline/synthesize";
import {
  ResumeSchema,
  type Resume,
  type VerificationCheck,
  type VerificationReport,
} from "@/lib/types";

const FORBIDDEN_CHARS = /[—–“”‘’]/; // em dash, en dash, smart quotes
const MAX_BULLET_CHARS = 210;
const LIFT_SHINGLE_WORDS = 5;

type LocatedBullet = { location: string; text: string };

function collectBullets(resume: Resume): LocatedBullet[] {
  const out: LocatedBullet[] = [];
  for (const section of resume.sections) {
    for (const entry of section.entries) {
      for (const [i, b] of entry.bullets.entries()) {
        out.push({ location: `${entry.heading || section.title} · bullet ${i + 1}`, text: b.text });
      }
    }
  }
  return out;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(words: string[], n: number): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) {
    set.add(words.slice(i, i + n).join(" "));
  }
  return set;
}

/**
 * Deterministic rule checks — code, not model judgment.
 */
export function runChecks(resume: Resume, jobDescription: string): VerificationCheck[] {
  const bullets = collectBullets(resume);
  const checks: VerificationCheck[] = [];

  // 1. Unique first verbs across all bullets
  const firstWords = new Map<string, string[]>();
  for (const b of bullets) {
    const first = normalizeWords(b.text)[0];
    if (!first) continue;
    firstWords.set(first, [...(firstWords.get(first) ?? []), b.location]);
  }
  const dupVerbs = [...firstWords.entries()].filter(([, locs]) => locs.length > 1);
  checks.push({
    name: "Unique first verbs",
    passed: dupVerbs.length === 0,
    severity: "fail",
    details: dupVerbs.map(([verb, locs]) => `"${verb}" leads ${locs.length} bullets: ${locs.join("; ")}`),
  });

  // 2. No em/en dashes or smart quotes anywhere
  const dashHits: string[] = [];
  const scanText = (label: string, text: string) => {
    if (FORBIDDEN_CHARS.test(text)) dashHits.push(`${label}: "${text.slice(0, 80)}"`);
  };
  scanText("tagline", resume.header.tagline);
  scanText("summary", resume.summary);
  for (const b of bullets) scanText(b.location, b.text);
  for (const section of resume.sections) {
    for (const entry of section.entries) {
      scanText(`${entry.heading} dates`, entry.dates);
      scanText(`${entry.heading} inline`, entry.inline);
    }
  }
  checks.push({
    name: "No em/en dashes or smart quotes",
    passed: dashHits.length === 0,
    severity: "fail",
    details: dashHits,
  });

  // 3. No verbatim JD phrase lifts (5+ consecutive words)
  const jdShingles = shingles(normalizeWords(jobDescription), LIFT_SHINGLE_WORDS);
  const liftHits: string[] = [];
  for (const b of bullets) {
    const words = normalizeWords(b.text);
    for (let i = 0; i + LIFT_SHINGLE_WORDS <= words.length; i++) {
      const shingle = words.slice(i, i + LIFT_SHINGLE_WORDS).join(" ");
      if (jdShingles.has(shingle)) {
        liftHits.push(`${b.location}: lifts "${shingle}" from the posting`);
        break;
      }
    }
  }
  checks.push({
    name: "No phrases lifted from the posting",
    passed: liftHits.length === 0,
    severity: "fail",
    details: liftHits,
  });

  // 4. Bullet length ceiling (warn only)
  const longHits = bullets
    .filter((b) => b.text.length > MAX_BULLET_CHARS)
    .map((b) => `${b.location}: ${b.text.length} chars`);
  checks.push({
    name: `Bullets within ${MAX_BULLET_CHARS} characters`,
    passed: longHits.length === 0,
    severity: "warn",
    details: longHits,
  });

  // 5. Metric coverage (informational warn)
  const withNumbers = bullets.filter((b) => /\d/.test(b.text)).length;
  const ratio = bullets.length > 0 ? withNumbers / bullets.length : 1;
  checks.push({
    name: "Metric density (most bullets carry a number)",
    passed: ratio >= 0.5,
    severity: "warn",
    details: ratio < 0.5 ? [`Only ${withNumbers}/${bullets.length} bullets contain a number`] : [],
  });

  return checks;
}

function hardFailures(checks: VerificationCheck[]): VerificationCheck[] {
  return checks.filter((c) => !c.passed && c.severity === "fail");
}

async function reviseResume(resume: Resume, failures: VerificationCheck[]): Promise<Resume> {
  const client = getClient();

  const issueList = failures
    .map((c) => `- ${c.name}:\n${c.details.map((d) => `    ${d}`).join("\n")}`)
    .join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      format: zodOutputFormat(ResumeSchema),
    },
    system: `You are revising a generated resume that failed automated rule checks. Fix ONLY the reported violations — rewrite the offending bullets (or characters) while preserving each bullet's meaning, metrics, themes, and verb register family. Change nothing else.

The rules being enforced:
${SYNTHESIS_RULES}`,
    messages: [
      {
        role: "user",
        content: `<resume>
${JSON.stringify(resume, null, 2)}
</resume>

<violations>
${issueList}
</violations>

Return the corrected resume.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Failed to revise resume");
  }
  return response.parsed_output;
}

/**
 * Verify the resume against the hard rules; if it fails, run one automatic
 * revision pass and re-verify. Returns the (possibly revised) resume and
 * the final report.
 */
export async function verifyAndFix(
  resume: Resume,
  jobDescription: string
): Promise<{ resume: Resume; report: VerificationReport }> {
  let checks = runChecks(resume, jobDescription);
  let failures = hardFailures(checks);
  let revised = false;
  let current = resume;

  if (failures.length > 0) {
    current = await reviseResume(current, failures);
    revised = true;
    checks = runChecks(current, jobDescription);
    failures = hardFailures(checks);
  }

  return {
    resume: current,
    report: {
      passed: failures.length === 0,
      revised,
      checks,
    },
  };
}
