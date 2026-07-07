import type { Resume } from "@/lib/types";

export default function ResumeView({ resume }: { resume: Resume }) {
  return (
    <div className="resume-sheet" id="resume-sheet">
      <h2 className="res-name">{resume.header.name}</h2>
      {resume.header.tagline && <p className="res-tagline">{resume.header.tagline}</p>}
      <div className="res-contact">{resume.header.contact.join("  ·  ")}</div>

      {resume.summary && <p className="res-summary">{resume.summary}</p>}

      {resume.sections.map((section, si) => (
        <section key={si}>
          <div className="res-section-title">{section.title}</div>
          {section.entries.map((entry, ei) => (
            <div className="res-entry" key={ei}>
              {(entry.heading || entry.dates) && (
                <div className="res-entry-head">
                  <span className="res-heading">{entry.heading}</span>
                  {entry.dates && <span className="res-dates">{entry.dates}</span>}
                </div>
              )}
              {entry.subheading && <div className="res-subheading">{entry.subheading}</div>}
              {entry.inline && <p className="res-inline">{entry.inline}</p>}
              {entry.bullets.length > 0 && (
                <ul className="res-bullets">
                  {entry.bullets.map((b, bi) => (
                    <li key={bi}>{b.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export function resumeToMarkdown(resume: Resume): string {
  const lines: string[] = [];
  lines.push(`# ${resume.header.name}`);
  if (resume.header.tagline) lines.push(`*${resume.header.tagline}*`);
  lines.push(resume.header.contact.join(" · "), "");
  if (resume.summary) lines.push(resume.summary, "");
  for (const section of resume.sections) {
    lines.push(`## ${section.title}`, "");
    for (const entry of section.entries) {
      if (entry.heading) {
        lines.push(`**${entry.heading}**${entry.dates ? ` — ${entry.dates}` : ""}`);
      }
      if (entry.subheading) lines.push(`*${entry.subheading}*`);
      if (entry.inline) lines.push(entry.inline);
      for (const b of entry.bullets) lines.push(`- ${b.text}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}
