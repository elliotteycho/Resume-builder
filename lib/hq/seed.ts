import type { Radar } from "@/lib/hq/config";

/**
 * Seed rows for the shared posting database.
 *
 * These are last-cycle patterns for the Summer 2027 PM intern season — the
 * "what company, what posting, when" backbone a new user sees before they have
 * contributed anything. Windows marked `expected` are unverified until the
 * daily scan or a user confirms a live posting.
 *
 * Shared-layer data only. Nothing personal belongs here: no application
 * stages, no applied dates, no per-user next actions — those live on each
 * user's own rows.
 */

export type SeedPosting = {
  slug: string;
  company: string;
  careers_url: string;
  program: string;
  tier: 1 | 2 | 3;
  status: "watching" | "open" | "closed";
  portal?: string;
  url: string;
  window_expected: string;
  window_note?: string;
  short_window?: boolean;
  radar?: Radar;
};

export const SEED_POSTINGS: SeedPosting[] = [
  { slug: "microsoft", company: "Microsoft", careers_url: "https://careers.microsoft.com", program: "PM Intern, Summer 2027", tier: 1, status: "closed", portal: "Microsoft Careers", url: "https://careers.microsoft.com/v2/global/en/universityinternship", window_expected: "Opened and closed early August", window_note: "Short early-August window. Next cycle is a year out." },
  { slug: "capitalone", company: "Capital One", careers_url: "https://www.capitalonecareers.com", program: "Product Development Intern, Summer 2027", tier: 2, status: "closed", portal: "Capital One Careers", url: "https://www.capitalonecareers.com/students", window_expected: "Opened mid July, now closed" },
  { slug: "appian", company: "Appian", careers_url: "https://careers.appian.com", program: "PM Intern, Summer 2027", tier: 2, status: "open", portal: "Greenhouse", url: "https://careers.appian.com/jobs/8041243-product-manager-intern-", window_expected: "Open since early August" },
  { slug: "amex", company: "Amex Digital Labs", careers_url: "https://www.americanexpress.com/en-us/careers/", program: "Digital Product Analyst Intern, Summer 2027", tier: 2, status: "open", portal: "Amex Careers", url: "https://www.americanexpress.com/en-us/careers/students/", window_expected: "Open since early August" },
  { slug: "vertiv", company: "Vertiv", careers_url: "https://careers.vertiv.com", program: "PM Intern, Summer 2027", tier: 2, status: "open", portal: "Vertiv Careers", url: "https://careers.vertiv.com", window_expected: "Open since August" },
  { slug: "salesforce", company: "Salesforce", careers_url: "https://www.salesforce.com/company/careers/", program: "APM Intern, Summer 2027 (Futureforce)", tier: 1, status: "open", portal: "Workday", url: "https://www.salesforce.com/company/careers/jobs/JR348039/", window_expected: "Open since mid July, rolling" },
  { slug: "databricks", company: "Databricks", careers_url: "https://www.databricks.com/company/careers", program: "Product Management Intern, Summer 2027", tier: 1, status: "open", portal: "Greenhouse", url: "https://www.databricks.com/company/careers/product/product-management-intern-summer-2027-6883068002", window_expected: "Open now, rolling", window_note: "Rolling review. Every day of delay costs odds.", radar: "now" },
  { slug: "duolingo", company: "Duolingo", careers_url: "https://careers.duolingo.com", program: "APM Intern, Summer 2027", tier: 1, status: "watching", url: "https://careers.duolingo.com", window_expected: "Expected late September to mid October, hard deadline", window_note: "Hard cutoff. Miss it, wait a year.", short_window: true, radar: "sep" },
  { slug: "meta", company: "Meta", careers_url: "https://www.metacareers.com", program: "RPM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.metacareers.com/rpm", window_expected: "Expected late August per last cycle, unverified", window_note: "Could open any day.", short_window: true, radar: "aug" },
  { slug: "amazon", company: "Amazon", careers_url: "https://www.amazon.jobs", program: "PM Intern, Summer 2027 (multiple orgs)", tier: 2, status: "watching", url: "https://www.amazon.jobs/en/teams/internships-for-students", window_expected: "Expected August to September, rolling", radar: "aug" },
  { slug: "google", company: "Google", careers_url: "https://www.google.com/about/careers/", program: "APM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.google.com/about/careers/applications/students", window_expected: "Expected October, 2 to 4 week window", window_note: "Very short window. Recruits non-CS majors.", short_window: true, radar: "oct" },
  { slug: "linkedin", company: "LinkedIn", careers_url: "https://careers.linkedin.com", program: "APM Intern, Summer 2027", tier: 1, status: "watching", url: "https://careers.linkedin.com/students", window_expected: "Expected early October, about 11 days", window_note: "Very short window.", short_window: true, radar: "oct" },
  { slug: "atlassian", company: "Atlassian", careers_url: "https://www.atlassian.com/company/careers", program: "APM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.atlassian.com/company/careers/students", window_expected: "Expected fall, about a 4 day window", window_note: "Extremely short window. Speed is everything.", short_window: true, radar: "oct" },
  { slug: "uber", company: "Uber", careers_url: "https://www.uber.com/us/en/careers/", program: "PM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.uber.com/us/en/careers/teams/university/", window_expected: "Expected August to October", radar: "sep" },
  { slug: "intuit", company: "Intuit", careers_url: "https://www.intuit.com/careers/", program: "RPM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.intuit.com/careers/students/", window_expected: "Expected September", radar: "sep" },
  { slug: "servicenow", company: "ServiceNow", careers_url: "https://careers.servicenow.com", program: "APM Intern, Summer 2027", tier: 2, status: "watching", url: "https://careers.servicenow.com/careers/students/", window_expected: "Expected September to October", radar: "sep" },
  { slug: "stripe", company: "Stripe", careers_url: "https://stripe.com/jobs", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://stripe.com/jobs/university", window_expected: "Expected August to October", radar: "sep" },
  { slug: "palantir", company: "Palantir", careers_url: "https://www.palantir.com/careers/", program: "PM Intern, Summer 2027 (PD)", tier: 2, status: "watching", url: "https://www.palantir.com/careers/", window_expected: "Expected August to October, fills before November", radar: "sep" },
  { slug: "tiktok", company: "TikTok", careers_url: "https://lifeattiktok.com", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://lifeattiktok.com/campus", window_expected: "Expected August to October", radar: "sep" },
  { slug: "block", company: "Block (Square)", careers_url: "https://block.xyz/careers", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://block.xyz/careers", window_expected: "Expected August to October", radar: "sep" },
  { slug: "bloomberg", company: "Bloomberg", careers_url: "https://www.bloomberg.com/careers/", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.bloomberg.com/careers/early-career/", window_expected: "Expected August to October", radar: "sep" },
  { slug: "adobe", company: "Adobe", careers_url: "https://www.adobe.com/careers.html", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.adobe.com/careers/university.html", window_expected: "Expected after Labor Day", radar: "sep" },
  { slug: "apple", company: "Apple", careers_url: "https://www.apple.com/careers/us/", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.apple.com/careers/us/students.html", window_expected: "Expected September to November", radar: "sep" },
  { slug: "spotify", company: "Spotify", careers_url: "https://www.lifeatspotify.com", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.lifeatspotify.com/students", window_expected: "Expected September to October", radar: "sep" },
  { slug: "hubspot", company: "HubSpot", careers_url: "https://www.hubspot.com/careers", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.hubspot.com/careers/students", window_expected: "Expected September to November", radar: "sep" },
  { slug: "cloudflare", company: "Cloudflare", careers_url: "https://www.cloudflare.com/careers/", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.cloudflare.com/careers/early-talent/", window_expected: "Expected December to January", window_note: "Late window. Good backstop.", radar: "dec" },
  { slug: "ycombinator", company: "YC startups", careers_url: "https://www.workatastartup.com", program: "PM roles via Work at a Startup", tier: 3, status: "watching", url: "https://www.workatastartup.com", window_expected: "Rolling, year round", window_note: "Sweep monthly for PM intern posts.", radar: "now" },
];
