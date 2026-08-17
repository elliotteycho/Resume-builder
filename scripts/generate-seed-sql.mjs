#!/usr/bin/env node
/**
 * Regenerate supabase/migrations/0003_seed.sql from lib/hq/seed.ts.
 *
 * The TS file is the source of truth for both modes (the JSON store seeds from
 * it directly); this script keeps the SQL seed mechanically derived so the two
 * never drift. Run after editing seed.ts:
 *
 *   node scripts/generate-seed-sql.mjs
 */

import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const root = new URL("..", import.meta.url).pathname;
const src = readFileSync(join(root, "lib/hq/seed.ts"), "utf-8");

// Strip the type-only syntax; the remainder is a plain ESM module.
const js = src
  .replace(/import type .*?;\n/s, "")
  .replace(/export type SeedPosting = \{.*?\};\n/s, "")
  .replace("export const SEED_POSTINGS: SeedPosting[] =", "export const SEED_POSTINGS =");

const tmp = join(mkdtempSync(join(tmpdir(), "hq-seed-")), "seed.mjs");
writeFileSync(tmp, js);
const { SEED_POSTINGS } = await import(pathToFileURL(tmp).href);

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const SEASON = "summer-2027";

const lines = [
  "-- Shared-layer seed: the Summer 2027 PM-intern season.",
  "--",
  "-- GENERATED from lib/hq/seed.ts by scripts/generate-seed-sql.mjs — edit the",
  "-- TS file and regenerate rather than editing here. Idempotent: reruns are",
  "-- no-ops thanks to the unique keys on companies.slug and",
  "-- postings (company_id, season, program).",
  "",
];

const seenCompanies = new Set();
for (const p of SEED_POSTINGS) {
  if (!seenCompanies.has(p.slug)) {
    seenCompanies.add(p.slug);
    lines.push(
      `insert into companies (slug, name, careers_url, tier_default)`,
      `values (${q(p.slug)}, ${q(p.company)}, ${q(p.careers_url)}, ${p.tier})`,
      `on conflict (slug) do nothing;`,
      ""
    );
  }
  lines.push(
    `insert into postings (company_id, program, url, portal, season, status,`,
    `                      window_expected, window_note, short_window, radar, source)`,
    `select c.id, ${q(p.program)}, ${q(p.url)}, ${q(p.portal ?? "")}, ${q(SEASON)}, ${q(p.status)},`,
    `       ${q(p.window_expected)}, ${q(p.window_note ?? "")}, ${p.short_window ? "true" : "false"}, ${
      p.radar ? q(p.radar) : "null"
    }, 'seed'`,
    `from companies c where c.slug = ${q(p.slug)}`,
    `on conflict (company_id, season, program) do nothing;`,
    ""
  );
}

const out = join(root, "supabase/migrations/0003_seed.sql");
writeFileSync(out, lines.join("\n"));
console.log(`wrote ${out}: ${seenCompanies.size} companies, ${SEED_POSTINGS.length} postings`);
