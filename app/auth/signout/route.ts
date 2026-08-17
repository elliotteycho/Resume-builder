import { NextRequest, NextResponse } from "next/server";
import { createAuthRouteClient } from "@/lib/hq/supabase";
import { isMultiUser } from "@/lib/hq/mode";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (isMultiUser()) {
    const supabase = await createAuthRouteClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${req.nextUrl.origin}/login`);
}
