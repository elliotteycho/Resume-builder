import { z } from "zod";

// ---------- Job description analysis ----------

export const JobAnalysisSchema = z.object({
  company: z.object({
    name: z.string().describe("Company name as stated or inferred from the job description"),
    industry: z.string().describe("Primary industry the company operates in, e.g. 'fintech', 'healthcare SaaS'"),
    market_segment: z.string().describe("Market segment / customer base, e.g. 'enterprise B2B', 'consumer marketplace'"),
    stage: z.string().describe("Company stage if inferable: startup, growth-stage, public enterprise, agency, nonprofit, government, or unknown"),
  }),
  role: z.object({
    title: z.string().describe("Job title"),
    family: z.string().describe("Role family, e.g. 'software engineering', 'product management', 'finance', 'nursing', 'marketing'"),
    seniority: z.string().describe("Seniority level: intern, entry, mid, senior, staff/principal, manager, director, executive"),
    location_type: z.string().describe("onsite, hybrid, remote, or unknown"),
  }),
  requirements: z.object({
    hard_skills: z.array(z.string()).describe("Concrete skills, tools, technologies, certifications explicitly required or preferred"),
    soft_skills: z.array(z.string()).describe("Soft skills and behavioral traits emphasized"),
    responsibilities: z.array(z.string()).describe("Core responsibilities of the role, condensed"),
    qualifications: z.array(z.string()).describe("Education, years of experience, licenses, clearances required"),
  }),
  ats_keywords: z
    .array(z.string())
    .describe("Exact keywords and phrases from the posting an ATS or recruiter will likely screen for, in priority order"),
  culture_signals: z
    .array(z.string())
    .describe("Signals about company culture and values evident in the posting"),
  research_queries: z.object({
    company_query: z.string().describe("A focused web-search brief for researching this specific company right now"),
    market_query: z.string().describe("A focused web-search brief for researching the current market/state of this role and industry"),
  }),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

// ---------- Research ----------

export type ResearchFindings = {
  company: string;   // markdown findings about the company
  market: string;    // markdown findings about the role/market
  conventions: string; // markdown findings about resume conventions for this role/industry
};

// ---------- Experience bank ----------

export const WorkExperienceSchema = z.object({
  id: z.string(),
  title: z.string(),
  organization: z.string(),
  location: z.string().optional().default(""),
  start: z.string(),
  end: z.string(),
  bullets: z.array(z.string()).describe("Everything you did/achieved, with metrics where possible — the fuller the better"),
  skills: z.array(z.string()).default([]),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  bullets: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  link: z.string().optional().default(""),
});

export const EducationSchema = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string(),
  field: z.string().optional().default(""),
  graduation: z.string().optional().default(""),
  details: z.array(z.string()).default([]),
});

export const ExperienceBankSchema = z.object({
  profile: z.object({
    name: z.string(),
    email: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    location: z.string().optional().default(""),
    links: z.array(z.string()).default([]),
    summary: z
      .string()
      .optional()
      .default("")
      .describe("Free-form notes about who you are, career goals, anything a resume writer should know"),
  }),
  work: z.array(WorkExperienceSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  awards: z.array(z.string()).default([]),
});

export type ExperienceBank = z.infer<typeof ExperienceBankSchema>;

// ---------- Generated resume ----------

export const ResumeSchema = z.object({
  header: z.object({
    name: z.string(),
    tagline: z.string().describe("One-line professional identity tailored to the target role; empty string if inappropriate for this industry"),
    contact: z.array(z.string()).describe("Contact lines to show: email, phone, location, links — ordered per industry convention"),
  }),
  summary: z
    .string()
    .describe("Professional summary tailored to the role; empty string if this industry/role convention omits summaries"),
  sections: z
    .array(
      z.object({
        title: z.string().describe("Section heading, named per industry convention (e.g. 'Professional Experience', 'Clinical Experience', 'Selected Projects')"),
        entries: z.array(
          z.object({
            heading: z.string().describe("Entry heading, e.g. role title"),
            subheading: z.string().describe("Organization · location, or equivalent; empty string if none"),
            dates: z.string().describe("Date range; empty string if none"),
            bullets: z.array(z.string()).describe("Tailored achievement bullets; empty array for list-style sections"),
            inline: z.string().describe("For list-style sections (skills, certifications): comma-separated content; else empty string"),
          })
        ),
      })
    )
    .describe("Resume sections in the order this industry expects them"),
  tailoring_notes: z.object({
    strategy: z.string().describe("2-4 sentences: how this resume was tailored to the company, role, and industry conventions, citing research insights used"),
    keywords_used: z.array(z.string()).describe("ATS keywords from the posting that were woven into the resume"),
    gaps: z.array(z.string()).describe("Requirements from the posting the candidate's bank couldn't support — be honest, never fabricate"),
  }),
});

export type Resume = z.infer<typeof ResumeSchema>;

// ---------- SSE progress events ----------

export type ProgressEvent =
  | { type: "stage"; stage: string; detail?: string }
  | { type: "agent"; agent: "company" | "market" | "conventions"; status: "running" | "done"; detail?: string }
  | { type: "analysis"; analysis: JobAnalysis }
  | { type: "result"; resume: Resume; research: ResearchFindings }
  | { type: "error"; message: string };
