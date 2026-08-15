import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { HttpError, json, route } from "@/lib/hq/http";
import { parseResume, resumeToText } from "@/lib/pipeline/parseResume";
import { getProfile, listCards, replaceCards, updateProfile } from "@/lib/hq/repo";

export const runtime = "nodejs";
// Reading a resume and deriving capabilities and evidence for every entry.
export const maxDuration = 300;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Import a resume: upload a file (multipart) or paste text (JSON).
 *
 * Cards are replaced wholesale rather than merged. A resume is the canonical
 * statement of someone's experience, and a merge would silently leave stale
 * cards behind from a prior version with no way to tell which is which.
 */
export const POST = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const contentType = req.headers.get("content-type") ?? "";

  let input: { name: string; type: string; bytes: Buffer } | { text: string };
  let fileName = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError("missing_file", "Attach a resume file.");
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError("file_too_large", "Resume must be under 10 MB.", 413);
    }
    fileName = file.name;
    input = {
      name: file.name,
      type: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    };
  } else {
    const body = (await req.json()) as { text?: string };
    if (!body.text || body.text.trim().length < 100) {
      throw new HttpError("missing_text", "Paste the full text of your resume.");
    }
    input = { text: body.text };
    fileName = "pasted-resume.txt";
  }

  const [parsed, text] = await Promise.all([parseResume(input), resumeToText(input)]);

  await replaceCards(
    userId,
    parsed.cards.map((c) => ({
      lane: c.lane,
      title: c.title,
      organization: c.organization,
      location: c.location,
      start_date: c.start_date,
      end_date: c.end_date,
      bullets: c.bullets,
      skills: c.skills,
      capabilities: c.capabilities,
      link: c.link,
      evidence: c.evidence.map((e) => ({ ...e, user_id: userId })),
    }))
  );

  // Only fill profile fields the user hasn't already set — a resume import
  // should never overwrite something they typed by hand.
  const existing = await getProfile(userId);
  const p = parsed.profile;
  await updateProfile(userId, {
    name: existing.name || p.name,
    email: existing.email || p.email,
    phone: existing.phone || p.phone,
    location: existing.location || p.location,
    school: existing.school || p.school,
    grad_year: existing.grad_year || p.grad_year,
    majors: existing.majors.length ? existing.majors : p.majors,
    gpa: existing.gpa ?? p.gpa,
    links: existing.links.length ? existing.links : p.links,
    resume_file_name: fileName,
    resume_uploaded_at: new Date().toISOString(),
    resume_text: text,
  });

  const [profile, cards] = await Promise.all([getProfile(userId), listCards(userId)]);
  return json({ profile, cards });
});
