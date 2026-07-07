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
  themes: z
    .array(
      z.object({
        id: z.string().describe("Short id: T1, T2, T3..."),
        name: z.string().describe("Concept-level theme name, e.g. 'deciding what matters when everything competes for attention' — NOT a keyword"),
        evidence: z.string().describe("What in the posting signals this theme (order, repetition, 'we value' lines read as clues not answers)"),
      })
    )
    .describe("4-7 concept-level themes the resume must EMBODY. Themes are found beneath the bullet list — what actually makes someone succeed in this role. 'Skillful prioritization with stakeholders' is a theme; 'Jira' is a keyword."),
  success_factors: z
    .array(z.string())
    .describe("What makes someone succeed in this role — often implied rather than written"),
  requirements: z.object({
    non_negotiable: z.array(z.string()).describe("Requirements that are truly load-bearing — the order, repetition, and language of the posting tell you"),
    decoration: z.array(z.string()).describe("Listed requirements that are actually background/nice-to-have decoration"),
    hard_skills: z.array(z.string()).describe("Concrete skills, tools, technologies, certifications explicitly required or preferred"),
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
  company: string;   // markdown findings about the company (including voice notes)
  market: string;    // markdown findings about the role/market
  conventions: string; // markdown findings about resume conventions for this role/industry
};

// ---------- Reframe synthesis (fuses JD parsing + company research) ----------

export const ReframeSchema = z.object({
  company_beliefs: z
    .array(z.string())
    .describe("3-5 statement belief vector compressing what this company believes about itself, its customers, and how work gets done — drawn from research, not the JD alone"),
  demands: z
    .array(
      z.object({
        demand: z.string().describe("What the role actually demands, concept-level"),
        tag: z.enum(["required", "qualification", "preference"]).describe("required = non-negotiable, qualification = screening bar, preference = decoration"),
      })
    )
    .describe("4-7 ranked demand vector distilled from the posting, most load-bearing first"),
  voice: z.object({
    tone: z.string().describe("Company tone: formal vs casual, builder vs operator, technical vs strategic"),
    altitude: z.string().describe("Vision language vs shipped-feature language — where this company speaks"),
    vocabulary: z.array(z.string()).describe("Recurring words this company uses about itself, especially verbs and adjectives"),
    one_liner: z.string().describe("The company's own framing of what it does"),
  }),
  directives: z
    .array(
      z.object({
        experience: z.string().describe("Exact name of the experience/project/leadership entry from the candidate's bank"),
        themes: z.array(z.string()).describe("Theme ids (T1, T2...) this entry will carry — the 1-3 themes it genuinely demonstrates"),
        verb_register: z
          .string()
          .describe("Which verb register the bullets should lead with: diagnostic, listening, weighing, clarity, imagination, building, or doer — matched to the themes carried"),
        framing_angle: z.string().describe("One line: how to frame this entry so its themes come through"),
        anchor_metric: z.string().describe("The strongest metric for this entry, copied VERBATIM from one of its evidence records; empty string if the entry has no visible evidence"),
        rationale: z.string().describe("One line: why this entry earned its slot over alternatives"),
      })
    )
    .describe("Per-entry reframe directives for the entries selected for highest theme density. Select entries so the resume as a whole covers all themes; each entry picks its spots."),
  excluded_notes: z
    .string()
    .describe("One or two sentences on strong bank entries deliberately left off and why; empty string if nothing notable was cut"),
});

export type Reframe = z.infer<typeof ReframeSchema>;

// ---------- Experience bank ----------

export const EvidenceSchema = z.object({
  metric: z.string().describe("The verbatim metric token with minimal context, e.g. '40%', '198 charities', '$1.8M' — this exact number is the only form allowed on a resume"),
  claim: z.string().describe("What the metric substantiates"),
  provenance: z.string().default("").describe("Where the number comes from: report, dashboard, email, commit history…"),
  confidence: z.enum(["high", "medium", "low"]).describe("low-confidence evidence is invisible to the generator entirely"),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export const WorkExperienceSchema = z.object({
  id: z.string(),
  title: z.string(),
  organization: z.string(),
  location: z.string().optional().default(""),
  start: z.string(),
  end: z.string(),
  bullets: z.array(z.string()).describe("Everything you did/achieved — the fuller the better; numbers must be backed by evidence records to appear on a resume"),
  skills: z.array(z.string()).default([]),
  evidence: z.array(EvidenceSchema).default([]).describe("Verified metrics for this entry with provenance and confidence"),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  bullets: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  link: z.string().optional().default(""),
  evidence: z.array(EvidenceSchema).default([]).describe("Verified metrics for this entry with provenance and confidence"),
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

export const ResumeBulletSchema = z.object({
  text: z.string().describe("The bullet text — Action, Responsibility, Impact order; leads with a verb from the entry's assigned register"),
  themes: z.array(z.string()).describe("Theme ids (T1, T2...) this bullet carries — one or two, never all of them"),
});

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
            dates: z.string().describe("Date range formatted 'Month Year - Month Year' with a plain ASCII hyphen; empty string if none"),
            bullets: z.array(ResumeBulletSchema).describe("Tailored achievement bullets; empty array for list-style sections"),
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

// ---------- Metric audit ----------

export type MetricAuditEntry = {
  token: string;
  entry: string;
  provenance: string;
  confidence: "high" | "medium" | "identity";
};

// ---------- Verification ----------

export type VerificationCheck = {
  name: string;
  passed: boolean;
  severity: "fail" | "warn";
  details: string[];
};

export type VerificationReport = {
  passed: boolean;
  revised: boolean; // whether an automatic fix pass ran
  checks: VerificationCheck[];
};

// ---------- SSE progress events ----------

export type ProgressEvent =
  | { type: "stage"; stage: string; detail?: string }
  | { type: "agent"; agent: "company" | "market" | "conventions"; status: "running" | "done"; detail?: string }
  | { type: "analysis"; analysis: JobAnalysis }
  | { type: "reframe"; reframe: Reframe }
  | {
      type: "result";
      resume: Resume;
      research: ResearchFindings;
      reframe: Reframe;
      verification: VerificationReport;
      metric_audit: MetricAuditEntry[];
    }
  | { type: "error"; message: string };
