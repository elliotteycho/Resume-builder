import { JsonStore } from "@/lib/hq/db/json";
import type { HqStore } from "@/lib/hq/db/types";

let store: HqStore | null = null;

/**
 * The one place the storage backend is chosen.
 *
 * Today: a JSON file. To move to Postgres/Supabase, implement `HqStore` against
 * `supabase/migrations/0001_init.sql` and branch here on an env var.
 */
export function getStore(): HqStore {
  if (!store) {
    store = new JsonStore();
  }
  return store;
}

export type { HqData, HqStore } from "@/lib/hq/db/types";
