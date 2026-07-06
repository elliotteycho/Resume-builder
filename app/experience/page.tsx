"use client";

import { useEffect, useState } from "react";
import type { ExperienceBank } from "@/lib/types";

const newId = () => Math.random().toString(36).slice(2, 10);

export default function ExperiencePage() {
  const [bank, setBank] = useState<ExperienceBank | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/experience")
      .then((r) => r.json())
      .then(setBank)
      .catch(() => setError("Failed to load experience bank"));
  }, []);

  async function save() {
    if (!bank) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/experience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bank),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!bank) {
    return <p className="subtitle">{error ?? "Loading…"}</p>;
  }

  const set = (patch: Partial<ExperienceBank>) => setBank({ ...bank, ...patch });

  return (
    <div>
      <h1>Experience bank</h1>
      <p className="subtitle">
        Your complete career history — the raw material every resume is built from. Be generous
        here: include metrics, tools, and outcomes. The generator selects and tailors; it never
        invents anything that isn&apos;t in this bank.
      </p>

      {error && <div className="error">{error}</div>}

      {/* Profile */}
      <div className="card">
        <div className="section-head" style={{ margin: "0 0 10px" }}>
          <h2>Profile</h2>
        </div>
        <div className="exp-grid">
          <Field label="Name" value={bank.profile.name} onChange={(v) => set({ profile: { ...bank.profile, name: v } })} />
          <Field label="Email" value={bank.profile.email} onChange={(v) => set({ profile: { ...bank.profile, email: v } })} />
          <Field label="Phone" value={bank.profile.phone} onChange={(v) => set({ profile: { ...bank.profile, phone: v } })} />
          <Field label="Location" value={bank.profile.location} onChange={(v) => set({ profile: { ...bank.profile, location: v } })} />
        </div>
        <Field
          label="Links (comma-separated)"
          value={bank.profile.links.join(", ")}
          onChange={(v) => set({ profile: { ...bank.profile, links: splitList(v) } })}
        />
        <div className="field">
          <label>About you — goals, interests, anything a resume writer should know</label>
          <textarea
            value={bank.profile.summary}
            onChange={(e) => set({ profile: { ...bank.profile, summary: e.target.value } })}
          />
        </div>
      </div>

      {/* Work */}
      <div className="section-head">
        <h2>Work experience</h2>
        <button
          className="ghost small"
          onClick={() =>
            set({
              work: [
                { id: newId(), title: "", organization: "", location: "", start: "", end: "", bullets: [], skills: [] },
                ...bank.work,
              ],
            })
          }
        >
          + Add
        </button>
      </div>
      {bank.work.map((w, i) => (
        <div className="entry-card" key={w.id}>
          <div className="exp-grid">
            <Field label="Title" value={w.title} onChange={(v) => set({ work: patch(bank.work, i, { title: v }) })} />
            <Field label="Organization" value={w.organization} onChange={(v) => set({ work: patch(bank.work, i, { organization: v }) })} />
            <Field label="Location" value={w.location} onChange={(v) => set({ work: patch(bank.work, i, { location: v }) })} />
            <div className="exp-grid">
              <Field label="Start" value={w.start} onChange={(v) => set({ work: patch(bank.work, i, { start: v }) })} />
              <Field label="End" value={w.end} onChange={(v) => set({ work: patch(bank.work, i, { end: v }) })} />
            </div>
          </div>
          <BulletsField
            label="What you did / achieved (one per line — include numbers!)"
            bullets={w.bullets}
            onChange={(bullets) => set({ work: patch(bank.work, i, { bullets }) })}
          />
          <Field
            label="Skills used (comma-separated)"
            value={w.skills.join(", ")}
            onChange={(v) => set({ work: patch(bank.work, i, { skills: splitList(v) }) })}
          />
          <button className="small" onClick={() => set({ work: bank.work.filter((_, j) => j !== i) })}>
            Remove
          </button>
        </div>
      ))}

      {/* Projects */}
      <div className="section-head">
        <h2>Projects</h2>
        <button
          className="ghost small"
          onClick={() =>
            set({ projects: [{ id: newId(), name: "", description: "", bullets: [], skills: [], link: "" }, ...bank.projects] })
          }
        >
          + Add
        </button>
      </div>
      {bank.projects.map((p, i) => (
        <div className="entry-card" key={p.id}>
          <div className="exp-grid">
            <Field label="Name" value={p.name} onChange={(v) => set({ projects: patch(bank.projects, i, { name: v }) })} />
            <Field label="Link" value={p.link} onChange={(v) => set({ projects: patch(bank.projects, i, { link: v }) })} />
          </div>
          <Field label="One-line description" value={p.description} onChange={(v) => set({ projects: patch(bank.projects, i, { description: v }) })} />
          <BulletsField
            label="Highlights (one per line)"
            bullets={p.bullets}
            onChange={(bullets) => set({ projects: patch(bank.projects, i, { bullets }) })}
          />
          <Field
            label="Skills used (comma-separated)"
            value={p.skills.join(", ")}
            onChange={(v) => set({ projects: patch(bank.projects, i, { skills: splitList(v) }) })}
          />
          <button className="small" onClick={() => set({ projects: bank.projects.filter((_, j) => j !== i) })}>
            Remove
          </button>
        </div>
      ))}

      {/* Education */}
      <div className="section-head">
        <h2>Education</h2>
        <button
          className="ghost small"
          onClick={() =>
            set({ education: [{ id: newId(), institution: "", degree: "", field: "", graduation: "", details: [] }, ...bank.education] })
          }
        >
          + Add
        </button>
      </div>
      {bank.education.map((e, i) => (
        <div className="entry-card" key={e.id}>
          <div className="exp-grid">
            <Field label="Institution" value={e.institution} onChange={(v) => set({ education: patch(bank.education, i, { institution: v }) })} />
            <Field label="Degree" value={e.degree} onChange={(v) => set({ education: patch(bank.education, i, { degree: v }) })} />
            <Field label="Field / minor" value={e.field} onChange={(v) => set({ education: patch(bank.education, i, { field: v }) })} />
            <Field label="Graduation" value={e.graduation} onChange={(v) => set({ education: patch(bank.education, i, { graduation: v }) })} />
          </div>
          <BulletsField
            label="Details — GPA, honors, coursework (one per line)"
            bullets={e.details}
            onChange={(details) => set({ education: patch(bank.education, i, { details }) })}
          />
          <button className="small" onClick={() => set({ education: bank.education.filter((_, j) => j !== i) })}>
            Remove
          </button>
        </div>
      ))}

      {/* Flat lists */}
      <div className="card" style={{ marginTop: 24 }}>
        <Field label="Skills (comma-separated)" value={bank.skills.join(", ")} onChange={(v) => set({ skills: splitList(v) })} />
        <Field label="Certifications (comma-separated)" value={bank.certifications.join(", ")} onChange={(v) => set({ certifications: splitList(v) })} />
        <Field label="Awards (comma-separated)" value={bank.awards.join(", ")} onChange={(v) => set({ awards: splitList(v) })} />
      </div>

      <div className="savebar no-print">
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save experience bank"}
        </button>
        {savedAt && <span className="saved-flash">Saved ✓</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function BulletsField({
  label,
  bullets,
  onChange,
}: {
  label: string;
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  // Keep raw text in local state so typing newlines feels natural;
  // split into bullets only on blur.
  const [text, setText] = useState(bullets.join("\n"));
  useEffect(() => setText(bullets.join("\n")), [bullets]);
  return (
    <div className="field">
      <label>{label}</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.split("\n").map((s) => s.trim()).filter(Boolean))}
      />
    </div>
  );
}

function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function patch<T>(arr: T[], index: number, changes: Partial<T>): T[] {
  return arr.map((item, i) => (i === index ? { ...item, ...changes } : item));
}
