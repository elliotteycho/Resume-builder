import { randomUUID } from "crypto";
import { HQ_CONFIG } from "@/lib/hq/config";
import { SEED_POSTINGS } from "@/lib/hq/seed";
import { EMPTY_DATA, type HqData } from "@/lib/hq/db/types";
import { DEFAULT_USER_ID } from "@/lib/hq/auth";
import type { Company, Posting } from "@/lib/hq/types";

/**
 * First-run contents of the database.
 *
 * The shared layer (companies + postings) is populated so a brand-new user
 * opens the app to a real season on the radar instead of an empty board. The
 * personal layer starts empty apart from a blank profile row for the local
 * user — applications are created when a user actually engages with a posting,
 * never by the seed.
 */
export function seedData(): HqData {
  const now = new Date().toISOString();
  const data: HqData = structuredClone(EMPTY_DATA);

  const companyBySlug = new Map<string, Company>();

  for (const seed of SEED_POSTINGS) {
    let company = companyBySlug.get(seed.slug);
    if (!company) {
      company = {
        id: randomUUID(),
        slug: seed.slug,
        name: seed.company,
        careers_url: seed.careers_url,
        tier_default: seed.tier,
        created_at: now,
      };
      companyBySlug.set(seed.slug, company);
      data.companies.push(company);
    }

    const posting: Posting = {
      id: randomUUID(),
      company_id: company.id,
      program: seed.program,
      url: seed.url,
      portal: seed.portal ?? "",
      season: HQ_CONFIG.defaultSeason,
      status: seed.status,
      window_expected: seed.window_expected,
      window_note: seed.window_note ?? "",
      short_window: seed.short_window ?? false,
      radar: seed.radar ?? null,
      opened_at: seed.status === "open" ? null : null,
      closed_at: null,
      jd_text: "",
      jd_analysis: null,
      eligibility: null,
      source: "seed",
      submitted_by: null,
      verified: false,
      last_verified_at: null,
      created_at: now,
      updated_at: now,
    };
    data.postings.push(posting);
  }

  data.profiles.push({
    user_id: DEFAULT_USER_ID,
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
    target_role: "Product Manager Intern",
    links: [],
    summary: "",
    resume_file_name: "",
    resume_uploaded_at: null,
    resume_text: "",
    created_at: now,
    updated_at: now,
  });

  return data;
}
