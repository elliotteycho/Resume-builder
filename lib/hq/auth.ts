import { HttpError } from "@/lib/hq/http";
import { isMultiUser } from "@/lib/hq/mode";

/**
 * Who is making this request.
 *
 * Local mode: one constant user, no login — the app works with zero config.
 *
 * Multi-user mode: the id comes from the Supabase session cookie, and a
 * profile row must exist — profiles are only created by invite redemption
 * (`/api/invite`), so "has a profile" is the membership gate. Routes get two
 * distinct failures to surface: no session (401, go log in) and no membership
 * (403, go redeem an invite).
 *
 * Every row in the store carries a user_id and every repo query filters on it,
 * so this function is the single place identity enters the system.
 */

export const DEFAULT_USER_ID = "local";

export async function currentUserId(): Promise<string> {
  if (!isMultiUser()) return DEFAULT_USER_ID;

  const userId = await requireSessionUserId();

  const { getServiceClient } = await import("@/lib/hq/supabase");
  const { data } = await getServiceClient()
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    throw new HttpError(
      "invite_required",
      "This pilot is invite-only. Enter your invite code to activate your account.",
      403
    );
  }
  return userId;
}

/** Session identity without the membership gate — for the invite flow itself. */
export async function requireSessionUserId(): Promise<string> {
  const { getSessionUserId } = await import("@/lib/hq/supabase");
  const userId = await getSessionUserId();
  if (!userId) {
    throw new HttpError("auth_required", "Sign in to continue.", 401);
  }
  return userId;
}
