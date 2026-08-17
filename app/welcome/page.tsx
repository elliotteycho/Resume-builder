"use client";

import { useState } from "react";

/** Invite redemption — the gate between "signed in" and "member". */
export default function WelcomePage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not redeem that code");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not redeem that code");
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 440 }}>
      <div className="card raised" style={{ marginTop: "10vh" }}>
        <div className="eyebrow">Internship HQ</div>
        <h1 style={{ fontSize: 26, margin: 0 }}>You&rsquo;re almost in</h1>
        <p className="muted" style={{ margin: 0 }}>
          This pilot is invite-only. Enter the code you were given to activate your account —
          you&rsquo;ll only do this once.
        </p>
        <input
          placeholder="Invite code"
          value={code}
          autoFocus
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim()) void redeem();
          }}
        />
        {error && <div className="error" style={{ margin: 0 }}>{error}</div>}
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={busy || !code.trim()}
            onClick={() => void redeem()}
          >
            {busy ? "Checking…" : "Activate"}
          </button>
          <a className="btn btn-ghost" href="/auth/signout">
            Sign out
          </a>
        </div>
      </div>
    </main>
  );
}
