import { HQ_CONFIG } from "@/lib/hq/config";
import { HttpError } from "@/lib/hq/http";
import { isMultiUser } from "@/lib/hq/mode";
import { monthlyUsage, recordUsage } from "@/lib/hq/repo";
import type { UsageKind } from "@/lib/hq/types";

/**
 * The spend gate. Called before any metered model call:
 *
 *   1. Per-user quota — actions of this kind this calendar month.
 *   2. Global cap — estimated spend across all users this month. This is the
 *      kill switch: when it trips, the metered features stop and the tracker
 *      keeps working, instead of the bill deciding for you.
 *
 * Enforcement is multi-user only; a local install is the owner's own key and
 * gating them would be noise. Usage is still recorded in both modes, because
 * per-user cost data is what the "should this launch publicly" decision needs.
 *
 * Estimates, not token metering — the point is a bounded worst case, not an
 * invoice. Callers charge *before* the model call: an abandoned call that
 * costs a quota slot is a far smaller failure than a completed call that
 * escaped the ledger.
 */

const month = () => new Date().toISOString().slice(0, 7);

export async function chargeUsage(userId: string, kind: UsageKind): Promise<void> {
  const quota = HQ_CONFIG.quotas[kind];

  if (isMultiUser()) {
    const entries = await monthlyUsage(month());

    const mine = entries.filter((e) => e.user_id === userId && e.kind === kind).length;
    if (mine >= quota.perMonth) {
      throw new HttpError(
        "quota_exceeded",
        `You've used this month's ${quota.perMonth} ${label(kind)}. The quota resets on the 1st.`,
        429
      );
    }

    const totalCents = entries.reduce((sum, e) => sum + e.est_cost_cents, 0);
    if (totalCents + quota.estCostCents > HQ_CONFIG.spendCapCents) {
      throw new HttpError(
        "spend_cap",
        "The pilot's monthly budget is used up — AI features are paused until the 1st. Tracking still works.",
        429
      );
    }
  }

  await recordUsage({ user_id: userId, kind, est_cost_cents: quota.estCostCents });
}

function label(kind: UsageKind): string {
  return {
    import: "resume imports",
    match: "match scores",
    brief: "research briefs",
    generate: "resume generations",
  }[kind];
}
