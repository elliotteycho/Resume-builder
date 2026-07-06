import fs from "fs/promises";
import path from "path";
import { ExperienceBankSchema, type ExperienceBank } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const BANK_PATH = path.join(DATA_DIR, "experience-bank.json");
const SAMPLE_PATH = path.join(DATA_DIR, "experience-bank.sample.json");

export async function loadBank(): Promise<ExperienceBank> {
  try {
    const raw = await fs.readFile(BANK_PATH, "utf-8");
    return ExperienceBankSchema.parse(JSON.parse(raw));
  } catch {
    // fall back to the sample so the app works out of the box
    const raw = await fs.readFile(SAMPLE_PATH, "utf-8");
    return ExperienceBankSchema.parse(JSON.parse(raw));
  }
}

export async function saveBank(bank: unknown): Promise<ExperienceBank> {
  const parsed = ExperienceBankSchema.parse(bank);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(BANK_PATH, JSON.stringify(parsed, null, 2), "utf-8");
  return parsed;
}
