import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAuthRouteClient } from "@/lib/hq/supabase";

export const runtime = "nodejs";

/**
 * Lands the magic link. Supabase sends either a PKCE `code` or a
 * `token_hash` + `type` pair depending on flow and email template — accept
 * both, establish the session cookie, and hand off to the app (which routes
 * un-invited users to /welcome via the membership gate).
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") as EmailOtpType | null) ?? "email";

  const fail = () =>
    NextResponse.redirect(`${origin}/login?error=link_expired`);

  try {
    const supabase = await createAuthRouteClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail();
    } else if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) return fail();
    } else {
      return fail();
    }
  } catch {
    return fail();
  }

  return NextResponse.redirect(`${origin}/`);
}
