"use client";

import { useState } from "react";
import { api, type Board } from "@/lib/hq/client";
import {
  CONTACT_STATUS_LABELS,
  HQ_CONFIG,
  LIVE_STAGES,
  NEXT_CONTACT_STATUS,
  type ContactStatus,
} from "@/lib/hq/config";
import { daysSince } from "@/lib/hq/dates";
import { contactsForCompany } from "@/lib/hq/queue";

const STATUS_TAG: Record<ContactStatus, string> = {
  "to-reach": "tag-neutral",
  sent: "tag-accent",
  replied: "tag-accent-2",
  "call-set": "tag-accent-2",
  met: "tag-soft",
};

/**
 * The referral CRM. Status advances by tapping the chip, which stamps the touch
 * date — that stamp is what the follow-up task on Today is computed from, so
 * the two can never disagree.
 */
export default function PeopleTab({
  board,
  refresh,
  onError,
}: {
  board: Board;
  refresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState({ name: "", role: "", company_name: "" });
  const [busy, setBusy] = useState(false);

  const applied = board.items.filter((v) =>
    LIVE_STAGES.includes(v.application?.stage ?? "watching")
  );
  const uncovered = applied.filter(
    (v) =>
      contactsForCompany(board.contacts, v.company.id, v.company.name).length <
      HQ_CONFIG.contactsPerCompany
  );

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    onError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: "var(--space-3)" }}>
        <div className="eyebrow">Add a contact</div>
        <div className="row">
          <input
            placeholder="Name"
            className="grow"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            placeholder="Title"
            className="grow"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          />
          <input
            placeholder="Company"
            className="grow"
            list="hq-companies"
            value={draft.company_name}
            onChange={(e) => setDraft({ ...draft, company_name: e.target.value })}
          />
          <datalist id="hq-companies">
            {board.items.map((v) => (
              <option key={v.company.id} value={v.company.name} />
            ))}
          </datalist>
          <button
            className="btn btn-primary"
            disabled={busy || !draft.name.trim() || !draft.company_name.trim()}
            onClick={() =>
              act(async () => {
                await api.addContact(draft);
                setDraft({ name: "", role: "", company_name: "" });
              })
            }
          >
            Add
          </button>
        </div>
        <div className="muted">
          The rule: {HQ_CONFIG.contactsPerCompany}–3 people per company, one clear ask, at most{" "}
          {HQ_CONFIG.maxTouchesWithoutReply} touches without a reply, follow up at{" "}
          {HQ_CONFIG.followUpDays} days.
        </div>
      </div>

      {board.contacts.length === 0 && (
        <div className="card dashed" style={{ marginBottom: "var(--space-3)" }}>
          <div style={{ fontSize: 14, color: "var(--color-neutral-800)" }}>
            No contacts yet, and {applied.length} live application
            {applied.length === 1 ? "" : "s"} with nobody inside.{" "}
            {uncovered.length > 0 && (
              <>
                Start with {uncovered.slice(0, 3).map((v) => v.company.name).join(", ")}: open one of
                those companies and hit <em>Research this company</em> — it will hand you named
                targets and a first message for each.
              </>
            )}
          </div>
        </div>
      )}

      <div className="stack">
        {board.contacts.map((c) => {
          const since = daysSince(c.last_touch);
          const followUpDue =
            c.status === "sent" && since !== null && since >= HQ_CONFIG.followUpDays;
          return (
            <div key={c.id} className="card">
              <div className="row">
                <div className="grow">
                  <span style={{ fontWeight: 700 }}>{c.name}</span>
                  <span className="muted">
                    {" "}
                    {c.role ? `${c.role} · ` : ""}
                    {c.company_name}
                  </span>
                  <div className="muted nums">
                    {c.last_touch
                      ? `Last touch ${c.last_touch}${followUpDue ? " · follow up due" : ""}`
                      : "No touches yet — tap the status when you reach out"}
                    {c.touches > 0 && ` · ${c.touches} touch${c.touches === 1 ? "" : "es"}`}
                  </div>
                  {c.angle && <div className="muted">{c.angle}</div>}
                </div>

                {c.linkedin_url && (
                  <a
                    className="btn btn-ghost small"
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    find ↗
                  </a>
                )}

                <button
                  className={`tag ${STATUS_TAG[c.status]}`}
                  title="Click to advance status"
                  style={{ cursor: "pointer", border: "none", fontFamily: "inherit", fontWeight: 700 }}
                  disabled={busy}
                  onClick={() =>
                    act(() => api.patchContact(c.id, { status: NEXT_CONTACT_STATUS[c.status] }))
                  }
                >
                  {CONTACT_STATUS_LABELS[c.status]}
                </button>

                <button
                  className="btn btn-ghost small"
                  disabled={busy}
                  onClick={() => act(() => api.deleteContact(c.id))}
                >
                  remove
                </button>
              </div>

              {c.notes && (
                <div className="callout" style={{ whiteSpace: "pre-wrap" }}>
                  {c.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
