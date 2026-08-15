import type { Eligibility, Profile } from "@/lib/hq/types";

/**
 * The eligibility gate is deterministic code, not model judgment.
 *
 * It runs before any match call, so a posting the user is categorically barred
 * from costs zero tokens and never shows up as a "maybe". A blocker is a hard
 * no; a warning is something to verify on the live posting before spending an
 * afternoon on materials.
 */

export type EligibilityVerdict = {
  pass: boolean;
  blockers: string[];
  warnings: string[];
};

const DEGREE_LABEL: Record<string, string> = {
  bachelors: "bachelor's",
  masters: "master's",
  mba: "MBA",
  phd: "PhD",
};

export function checkEligibility(
  profile: Profile,
  eligibility: Eligibility | null
): EligibilityVerdict {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // No criteria captured yet means the JD hasn't been analyzed — that's an
  // unknown, not a pass. Say so rather than implying a clean check.
  if (!eligibility) {
    return {
      pass: true,
      blockers: [],
      warnings: ["No job description captured yet — eligibility unverified."],
    };
  }

  // Graduation window.
  if (eligibility.grad_years.length) {
    if (!profile.grad_year) {
      warnings.push(
        `Posting targets ${eligibility.grad_years.join(" / ")} graduates — add your graduation year to check.`
      );
    } else if (!eligibility.grad_years.includes(profile.grad_year)) {
      blockers.push(
        `Graduation timeline: posting wants ${eligibility.grad_years.join(" / ")}, you graduate ${profile.grad_year}.`
      );
    }
  }

  // Class standing.
  if (eligibility.class_years.length) {
    if (profile.class_year === null) {
      warnings.push("Posting restricts class standing — add your class year to check.");
    } else if (!eligibility.class_years.includes(profile.class_year)) {
      blockers.push(
        `Class standing: posting wants year ${eligibility.class_years.join("/")}, you are year ${profile.class_year}.`
      );
    }
  }

  // Degree level. An undergrad against an MBA-only program is the classic
  // wasted afternoon this gate exists to prevent.
  if (eligibility.degree_levels.length) {
    if (!eligibility.degree_levels.includes(profile.degree_level)) {
      blockers.push(
        `Degree level: posting wants ${eligibility.degree_levels
          .map((d) => DEGREE_LABEL[d] ?? d)
          .join(" / ")}, you are ${DEGREE_LABEL[profile.degree_level] ?? profile.degree_level}.`
      );
    }
  }

  // Field of study — a soft check, since adjacent majors are usually fine.
  if (eligibility.fields.length && profile.majors.length) {
    const mine = profile.majors.map((m) => m.toLowerCase());
    const overlap = eligibility.fields.some((f) =>
      mine.some((m) => m.includes(f.toLowerCase()) || f.toLowerCase().includes(m))
    );
    if (!overlap) {
      warnings.push(
        `Field: posting names ${eligibility.fields.join(", ")}; your majors are ${profile.majors.join(", ")}. Usually negotiable, worth a look.`
      );
    }
  }

  // GPA.
  if (eligibility.min_gpa !== null) {
    if (profile.gpa === null) {
      warnings.push(`Posting states a ${eligibility.min_gpa} GPA minimum — add your GPA to check.`);
    } else if (profile.gpa < eligibility.min_gpa) {
      blockers.push(`GPA: posting requires ${eligibility.min_gpa}, yours is ${profile.gpa}.`);
    }
  }

  // Work authorization.
  if (eligibility.requires_citizenship && profile.work_authorization !== "citizen") {
    blockers.push("Work authorization: posting requires U.S. citizenship.");
  }
  if (
    eligibility.requires_sponsorship_free &&
    profile.work_authorization === "needs-sponsorship"
  ) {
    blockers.push("Work authorization: posting does not sponsor, and you need sponsorship.");
  }
  if (eligibility.requires_clearance) {
    warnings.push("Posting requires a security clearance — confirm whether they sponsor one.");
  }

  // Experience floor. Interns are expected to have none, so only a real,
  // multi-year requirement counts against a student.
  if (
    eligibility.min_years_experience !== null &&
    eligibility.min_years_experience > profile.years_experience + 1
  ) {
    warnings.push(
      `Experience: posting asks for ${eligibility.min_years_experience}+ years, you have ${profile.years_experience}. Often aspirational, sometimes not.`
    );
  }

  return { pass: blockers.length === 0, blockers, warnings };
}
