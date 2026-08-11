# Canonical Resume Layout Spec ("Appian layout")

Derived byte-for-byte from `ElliottCho_AppianPM_Resume.docx` (Aug 2026), the reference for ALL
generated resumes. `scripts/build-resume-docx.js` implements it; keep the two in sync.

## Page
- US Letter (12240 x 15840 twips)
- Margins: top/bottom **0.4"** (576), left/right **0.5"** (720) -> text width 7.5"

## Type
- Times New Roman everywhere; document default **11pt** (w:sz 22)
- Document-default paragraph: `line=256, lineRule=exact` (12.8pt exact lines), before/after 0
  (exact line rule is what keeps Word from inflating to ~1.15 and spilling to page 2)

## Blocks
| Block | Size | Style | Spacing (twips: before/after) | Notes |
|---|---|---|---|---|
| Name | 28pt (sz 56) | bold, **centered** | before=240, after=40, line=400 exact | |
| Contact line | 12pt (sz 24) | **centered** | after=40 | pipe-separated |
| Section header | 12pt (sz 24) | bold, ALL CAPS | before=100, after=20 | bottom border single sz=6 space=1 black |
| Entry header | 11pt | see below | before=60, after=10 | right tab at **10800** (7.5") |
| Bullet | 11pt | plain | after=30 | prefix `•  ` (bullet + 2 spaces); indent left=274 hanging=187 |
| Edu degree line | 11pt | plain | (default, after=0) | |
| Labeled inline line | 11pt | bold `Label:` + plain rest | after=25 | GPA, Coursework, Skills lines |

## Entry header composition
`[Employer bold]` + `" | "` plain + `[descriptor | role | location all ITALIC]` + right-tab + `[dates bold]`
Example: **Instawork** | *Series-D YC (S15) B2B | Product Management Intern | Chicago, IL* <tab> **June 2026 - Present**

## Structure (one page)
EDUCATION -> PROFESSIONAL EXPERIENCE (3 entries: lead role 3 bullets, others 2) -> PROJECTS (1 entry, 2 bullets)
-> LEADERSHIP & EXTRACURRICULARS (2 entries, 2 bullets each) -> INTERESTS & SKILLS (5 labeled lines)

## Content rules that ride with the layout
- Bullets fill ~2 lines (~170-207 chars), unique first verbs, verbatim metrics, plain hyphens only
- Present tense lead verbs for roles ending "Present"; past tense otherwise
- Internal codenames/accounts generalized on output (see experience bank glossary)
