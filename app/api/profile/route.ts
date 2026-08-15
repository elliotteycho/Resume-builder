import { NextRequest } from "next/server";
import { currentUserId } from "@/lib/hq/auth";
import { json, pick, route } from "@/lib/hq/http";
import { getProfile, listCards, updateProfile } from "@/lib/hq/repo";
import type { Profile } from "@/lib/hq/types";

export const runtime = "nodejs";

const EDITABLE = [
  "name",
  "email",
  "phone",
  "location",
  "school",
  "grad_year",
  "class_year",
  "majors",
  "gpa",
  "degree_level",
  "work_authorization",
  "years_experience",
  "target_role",
  "links",
  "summary",
] as const;

export const GET = route(async () => {
  const userId = await currentUserId();
  const [profile, cards] = await Promise.all([getProfile(userId), listCards(userId)]);
  return json({ profile, cards });
});

export const PUT = route(async (req: NextRequest) => {
  const userId = await currentUserId();
  const body = (await req.json()) as Record<string, unknown>;
  const profile = await updateProfile(userId, pick<Profile, (typeof EDITABLE)[number]>(body, EDITABLE));
  return json({ profile });
});
