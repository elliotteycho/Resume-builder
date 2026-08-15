import fs from "fs/promises";
import path from "path";
import { EMPTY_DATA, type HqData, type HqStore } from "@/lib/hq/db/types";
import { seedData } from "@/lib/hq/db/seedData";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "hq.json");

let tmpCounter = 0;

/**
 * File-backed store: the whole database is one JSON document.
 *
 * Good enough for a single user on one machine, which is the local-first
 * default. `HqStore` is the seam — a Postgres/Supabase adapter implements the
 * same two methods and nothing else in the app changes.
 */
export class JsonStore implements HqStore {
  /** Serializes writes so concurrent requests cannot clobber each other. */
  private chain: Promise<unknown> = Promise.resolve();
  private cache: HqData | null = null;
  /** Concurrent first reads share one load, so seeding happens exactly once. */
  private loading: Promise<HqData> | null = null;

  async read(): Promise<HqData> {
    if (this.cache) return this.cache;
    if (!this.loading) {
      this.loading = this.load().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  async write<T>(
    mutate: (data: HqData) => T
  ): Promise<{ data: HqData; result: T }> {
    const run = this.chain.then(async () => {
      const data = await this.read();
      const result = mutate(data);
      await this.persist(data);
      return { data, result };
    });
    // Keep the chain alive even if this write rejects.
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async load(): Promise<HqData> {
    try {
      const raw = await fs.readFile(DB_PATH, "utf-8");
      // Merge onto EMPTY_DATA so a file written by an older version, missing a
      // collection, still loads.
      return { ...EMPTY_DATA, ...(JSON.parse(raw) as Partial<HqData>) };
    } catch {
      const fresh = seedData();
      await this.persist(fresh);
      return fresh;
    }
  }

  private async persist(data: HqData): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Write-then-rename: a crash mid-write never leaves a truncated database.
    // The temp name is unique per call so two writers can never rename the
    // same path out from under each other.
    const tmp = `${DB_PATH}.${process.pid}.${tmpCounter++}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmp, DB_PATH);
    this.cache = data;
  }
}
