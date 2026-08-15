/**
 * Route-handler plumbing. Errors go out in one shape — `{error: {code, message}}` —
 * so the client has exactly one thing to parse on any failure.
 */

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function fail(code: string, message: string, status = 400): Response {
  return json({ error: { code, message } }, status);
}

export class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

export const notFound = (what: string) =>
  new HttpError("not_found", `${what} not found`, 404);

/**
 * Wrap a handler so a thrown `HttpError` becomes its status and anything else
 * becomes a 500 — no route needs its own try/catch.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return fail(err.code, err.message, err.status);
      }
      const message = err instanceof Error ? err.message : "Unexpected error";
      console.error("[hq]", err);
      return fail("internal_error", message, 500);
    }
  };
}

/** Missing key means "not set" — an explicit null means "clear it". */
export function pick<T extends object, K extends keyof T>(
  body: Record<string, unknown>,
  keys: readonly K[]
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key as string)) {
      out[key as string] = body[key as string];
    }
  }
  return out as Partial<T>;
}
