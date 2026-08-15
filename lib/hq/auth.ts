/**
 * Who is making this request.
 *
 * The app runs local-first: one user, no login. Every row still carries a
 * `user_id` and every query still filters on it, so turning this into a real
 * multi-user app means replacing the body of `currentUserId()` with a session
 * lookup — no call sites change.
 */

export const DEFAULT_USER_ID = "local";

export async function currentUserId(): Promise<string> {
  return DEFAULT_USER_ID;
}
