import { NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/hq/auth";
import { HttpError, json, route } from "@/lib/hq/http";
import { isMultiUser } from "@/lib/hq/mode";
import { getServiceClient } from "@/lib/hq/supabase";

export const runtime = "nodejs";

/**
 * Redeem an invite code. This is the only place a profiles row is created in
 * multi-user mode — membership *is* having a profile. The redemption itself is
 * a single Postgres function so two concurrent redemptions can't burn a code
 * past its max_uses.
 *
 * Uses session identity directly (not `currentUserId()`), because the caller
 * is by definition not a member yet.
 */
export const POST = route(async (req: NextRequest) => {
  if (!isMultiUser()) {
    throw new HttpError("local_mode", "This install runs in local mode — no invite needed.");
  }

  const userId = await requireSessionUserId();
  const body = (await req.json()) as { code?: string };
  const code = body.code?.trim();
  if (!code) throw new HttpError("missing_code", "Enter your invite code.");

  const { data, error } = await getServiceClient().rpc("redeem_invite", {
    p_code: code,
    p_user_id: userId,
  });
  if (error) throw new Error(`[supabase] ${error.message}`);

  if (!data) {
    throw new HttpError(
      "invalid_invite",
      "That code isn't valid or has been fully used. Check with whoever invited you."
    );
  }
  return json({ ok: true });
});
