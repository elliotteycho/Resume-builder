"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Magic-link sign-in. No passwords to store or reset — Supabase emails a
 * one-time link that lands on /auth/confirm.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return (
      <main style={{ maxWidth: 440 }}>
        <div className="card">
          <h1 style={{ fontSize: 24, margin: 0 }}>Local mode</h1>
          <p className="muted">
            This install runs without accounts — everything is saved on this machine.{" "}
            <Link href="/">Back to the tracker</Link>.
          </p>
        </div>
      </main>
    );
  }

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserClient(url, anonKey);
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 440 }}>
      <div className="card raised" style={{ marginTop: "10vh" }}>
        <div className="eyebrow">Internship HQ</div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Sign in</h1>

        {sent ? (
          <p style={{ margin: 0 }}>
            Check <strong>{email}</strong> for a sign-in link. It works once and expires quickly —
            request another if it lapses.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Enter your email and we&rsquo;ll send a one-time sign-in link. New here? You&rsquo;ll
              need an invite code after your first sign-in.
            </p>
            <input
              type="email"
              placeholder="you@school.edu"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.includes("@")) void send();
              }}
            />
            {error && <div className="error" style={{ margin: 0 }}>{error}</div>}
            <div>
              <button
                className="btn btn-primary"
                disabled={busy || !email.includes("@")}
                onClick={() => void send()}
              >
                {busy ? "Sending…" : "Send sign-in link"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
