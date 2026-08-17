import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session keep-alive and page-level auth redirects, multi-user mode only.
 *
 * Two jobs:
 * 1. Refresh the Supabase session cookie on every request (the SDK rotates
 *    tokens here — API routes read the cookie but can't always write it).
 * 2. Send signed-out visitors of app pages to /login. API routes are left
 *    alone: they answer 401/403 JSON themselves, and the client redirects.
 *
 * In local mode (no Supabase env), this is a straight pass-through — the app
 * keeps working with zero configuration.
 */

const PUBLIC_PATHS = ["/login", "/auth", "/welcome"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Always call getUser: this is what refreshes an expiring session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith("/api/");

  if (!user && !isPublic && !isApi) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  // Everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
