import { sql } from '@vercel/postgres';

const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/;
const REQUIRED_DB_ENV_VARS = ['POSTGRES_URL'];
let schemaVerified = false;

export const ISO_WEEK_KEY_LENGTH = 7 + 1; // e.g. 2025-W02

export class DatabaseConfigError extends Error {
  constructor(message = 'Postgres connection env vars are missing. Run `vercel env pull .env.local` and restart dev server.') {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

export function assertDatabaseConfig(): void {
  const missing = REQUIRED_DB_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new DatabaseConfigError();
  }
}

export async function ensureTablesExist(): Promise<void> {
  assertDatabaseConfig();
  if (schemaVerified) return;

  // Verify sg_users and sg_scores tables exist (created via db/schema.sql)
  const result = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('sg_users', 'sg_scores');
  `;

  if (result.rows.length < 2) {
    throw new DatabaseConfigError(
      'Database tables sg_users and sg_scores not found. Run db/schema.sql to create them.'
    );
  }

  schemaVerified = true;
}

// Legacy alias for backward compatibility
export const ensureScoresTable = ensureTablesExist;

export function getIsoWeekId(date: Date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((utc.getTime() - yearStart.getTime()) / 86400000);
  const weekNumber = Math.floor(diffDays / 7) + 1;
  return `${utc.getUTCFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

export function normalizeIsoWeekParam(value?: string | string[]): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }
  return ISO_WEEK_PATTERN.test(candidate) ? candidate : null;
}

export function normalizeEmail(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
}
