import type { Radar } from "@/lib/hq/config";

/**
 * Seed rows for the shared posting database.
 *
 * These are last-cycle patterns for the Summer 2027 PM intern season — the
 * "what company, what posting, when" backbone a new user sees before they have
 * contributed anything. Windows marked `expected` are unverified until the
 * daily scan or a user confirms a live posting.
 */

export type SeedPosting = {
  slug: string;
  company: string;
  careers_url: string;
  program: string;
  tier: 1 | 2 | 3;
  status: "watching" | "open" | "closed";
  /** Present only if the seed knows the user already applied. */
  stage?: "applied";
  applied_date?: string;
  portal?: string;
  url: string;
  window_expected: string;
  window_note?: string;
  short_window?: boolean;
  radar?: Radar;
  next_action?: string;
};

export const SEED_POSTINGS: SeedPosting[] = [
  { slug: "microsoft", company: "Microsoft", careers_url: "https://careers.microsoft.com", program: "PM Intern, Summer 2027", tier: 1, status: "closed", stage: "applied", applied_date: "2026-08-04", portal: "Microsoft Careers", url: "https://careers.microsoft.com/v2/global/en/universityinternship", window_expected: "Opened and closed early August", next_action: "Applied before the window closed. Find 2 to 3 contacts" },
  { slug: "capitalone", company: "Capital One", careers_url: "https://www.capitalonecareers.com", program: "Product Development Intern, Summer 2027", tier: 2, status: "closed", stage: "applied", applied_date: "2026-07-17", portal: "Capital One Careers", url: "https://www.capitalonecareers.com/students", window_expected: "Applied mid July", next_action: "No response — status check due" },
  { slug: "appian", company: "Appian", careers_url: "https://careers.appian.com", program: "PM Intern, Summer 2027", tier: 2, status: "open", stage: "applied", applied_date: "2026-08-07", portal: "Greenhouse", url: "https://careers.appian.com/jobs/8041243-product-manager-intern-", window_expected: "Applied early August", next_action: "Fresh — nothing expected yet" },
  { slug: "amex", company: "Amex Digital Labs", careers_url: "https://www.americanexpress.com/en-us/careers/", program: "Digital Product Analyst Intern, Summer 2027", tier: 2, status: "open", stage: "applied", applied_date: "2026-08-05", portal: "Amex Careers", url: "https://www.americanexpress.com/en-us/careers/students/", window_expected: "Applied early August", next_action: "Fresh — nothing expected yet" },
  { slug: "vertiv", company: "Vertiv", careers_url: "https://careers.vertiv.com", program: "PM Intern, Summer 2027", tier: 2, status: "open", stage: "applied", applied_date: "2026-08-07", portal: "Vertiv Careers", url: "https://careers.vertiv.com", window_expected: "Applied August", next_action: "Fresh — confirm exact applied date" },
  { slug: "salesforce", company: "Salesforce", careers_url: "https://www.salesforce.com/company/careers/", program: "APM Intern, Summer 2027 (Futureforce)", tier: 1, status: "open", stage: "applied", applied_date: "2026-07-14", portal: "Workday", url: "https://www.salesforce.com/company/careers/jobs/JR348039/", window_expected: "Applied July 14, rolling", next_action: "No response — longest-silent application. Status check overdue" },
  { slug: "databricks", company: "Databricks", careers_url: "https://www.databricks.com/company/careers", program: "Product Management Intern, Summer 2027", tier: 1, status: "open", portal: "Greenhouse", url: "https://www.databricks.com/company/careers/product/product-management-intern-summer-2027-6883068002", window_expected: "Open now, rolling", window_note: "Rolling review. Every day of delay costs odds.", radar: "now", next_action: "Rolling review — submit now" },
  { slug: "duolingo", company: "Duolingo", careers_url: "https://careers.duolingo.com", program: "APM Intern, Summer 2027", tier: 1, status: "watching", url: "https://careers.duolingo.com", window_expected: "Expected late September to mid October, hard deadline", window_note: "Hard cutoff. Miss it, wait a year.", short_window: true, radar: "sep", next_action: "Materials ready by mid September" },
  { slug: "meta", company: "Meta", careers_url: "https://www.metacareers.com", program: "RPM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.metacareers.com/rpm", window_expected: "Expected late August per last cycle, unverified", window_note: "Could open any day.", short_window: true, radar: "aug", next_action: "Daily scan is watching" },
  { slug: "amazon", company: "Amazon", careers_url: "https://www.amazon.jobs", program: "PM Intern, Summer 2027 (multiple orgs)", tier: 2, status: "watching", url: "https://www.amazon.jobs/en/teams/internships-for-students", window_expected: "Expected August to September, rolling", radar: "aug", next_action: "Daily scan is watching" },
  { slug: "google", company: "Google", careers_url: "https://www.google.com/about/careers/", program: "APM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.google.com/about/careers/applications/students", window_expected: "Expected October, 2 to 4 week window", window_note: "Very short window. Recruits non-CS majors.", short_window: true, radar: "oct", next_action: "Materials ready before October" },
  { slug: "linkedin", company: "LinkedIn", careers_url: "https://careers.linkedin.com", program: "APM Intern, Summer 2027", tier: 1, status: "watching", url: "https://careers.linkedin.com/students", window_expected: "Expected early October, about 11 days", window_note: "Very short window.", short_window: true, radar: "oct", next_action: "Materials ready before October" },
  { slug: "atlassian", company: "Atlassian", careers_url: "https://www.atlassian.com/company/careers", program: "APM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.atlassian.com/company/careers/students", window_expected: "Expected fall, about a 4 day window", window_note: "Extremely short window. Speed is everything.", short_window: true, radar: "oct", next_action: "Daily scan is watching" },
  { slug: "uber", company: "Uber", careers_url: "https://www.uber.com/us/en/careers/", program: "PM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.uber.com/us/en/careers/teams/university/", window_expected: "Expected August to October", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "intuit", company: "Intuit", careers_url: "https://www.intuit.com/careers/", program: "RPM Intern, Summer 2027", tier: 1, status: "watching", url: "https://www.intuit.com/careers/students/", window_expected: "Expected September", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "servicenow", company: "ServiceNow", careers_url: "https://careers.servicenow.com", program: "APM Intern, Summer 2027", tier: 2, status: "watching", url: "https://careers.servicenow.com/careers/students/", window_expected: "Expected September to October", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "stripe", company: "Stripe", careers_url: "https://stripe.com/jobs", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://stripe.com/jobs/university", window_expected: "Expected August to October", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "palantir", company: "Palantir", careers_url: "https://www.palantir.com/careers/", program: "PM Intern, Summer 2027 (PD)", tier: 2, status: "watching", url: "https://www.palantir.com/careers/", window_expected: "Expected August to October, fills before November", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "tiktok", company: "TikTok", careers_url: "https://lifeattiktok.com", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://lifeattiktok.com/campus", window_expected: "Expected August to October", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "block", company: "Block (Square)", careers_url: "https://block.xyz/careers", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://block.xyz/careers", window_expected: "Expected August to October", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "bloomberg", company: "Bloomberg", careers_url: "https://www.bloomberg.com/careers/", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.bloomberg.com/careers/early-career/", window_expected: "Expected August to October", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "adobe", company: "Adobe", careers_url: "https://www.adobe.com/careers.html", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.adobe.com/careers/university.html", window_expected: "Expected after Labor Day", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "apple", company: "Apple", careers_url: "https://www.apple.com/careers/us/", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.apple.com/careers/us/students.html", window_expected: "Expected September to November", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "spotify", company: "Spotify", careers_url: "https://www.lifeatspotify.com", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.lifeatspotify.com/students", window_expected: "Expected September to October", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "hubspot", company: "HubSpot", careers_url: "https://www.hubspot.com/careers", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.hubspot.com/careers/students", window_expected: "Expected September to November", radar: "sep", next_action: "Daily scan is watching" },
  { slug: "cloudflare", company: "Cloudflare", careers_url: "https://www.cloudflare.com/careers/", program: "PM Intern, Summer 2027", tier: 2, status: "watching", url: "https://www.cloudflare.com/careers/early-talent/", window_expected: "Expected December to January", window_note: "Late window. Good backstop.", radar: "dec", next_action: "Revisit in November" },
  { slug: "ycombinator", company: "YC startups", careers_url: "https://www.workatastartup.com", program: "PM roles via Work at a Startup", tier: 3, status: "watching", url: "https://www.workatastartup.com", window_expected: "Rolling, year round", radar: "now", next_action: "Sweep monthly for PM intern posts" },
];
