/**
 * Which mode the app is running in.
 *
 * Local mode: no configuration, one user ("local"), everything in a JSON file.
 * The app must always work this way with zero env vars — it is the demo, the
 * dev loop, and the single-user install.
 *
 * Multi-user mode: Supabase provides auth and Postgres. Turned on by the
 * presence of the env vars, never by a build flag, so the same build serves
 * both and flipping back is deleting four lines of config.
 */

export function isMultiUser(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** For client components and middleware, which can only see public vars. */
export function isMultiUserClient(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
