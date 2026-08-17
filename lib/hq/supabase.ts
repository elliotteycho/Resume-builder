import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Two Supabase clients with two trust levels:
 *
 * - The **session client** reads the caller's auth cookies and answers exactly
 *   one question: who is making this request. It is never used for data.
 * - The **service client** holds the service-role key and does all reads and
 *   writes, server-side only. Ownership is enforced in the repo layer (every
 *   query filters on user_id) with RLS behind it as defense in depth — the
 *   service role is what lets server routes write the shared layer (postings,
 *   companies) that clients can only read.
 */

let service: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!service) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    service = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return service;
}

/**
 * A cookie-writing client for the auth routes (login confirm, signout) —
 * the places where the session itself is being established or torn down.
 * Route handlers may write cookies, so no best-effort guard here.
 */
export async function createAuthRouteClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );
}

/** The authenticated user's id from the request cookies, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Route handlers can't always set cookies; token refresh happens in
        // middleware, so setAll here is best-effort.
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    }
  );
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}
