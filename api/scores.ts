import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { DatabaseConfigError, ensureTablesExist, normalizeEmail } from './_db.js';
import { JsonBodyParseError, readJsonBody, sendJson } from './_http.js';

const ScorePayloadSchema = z.object({
  nickname: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string()
      .min(2, 'Nickname must be at least 2 characters')
      .max(24, 'Nickname must be 24 characters or fewer')
  ),
  score: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().int('Score must be an integer').min(0, 'Score cannot be negative').max(1_000_000_000, 'Score is unreasonably large')
  ),
  email: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    },
    z.string().email('Email must be valid').max(254, 'Email must be 254 characters or fewer')
  ).optional(),
  maxTierReached: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().int().min(1).max(11)
  ).optional(),
  piecesMerged: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().int().min(0)
  ).optional(),
  gameDurationSeconds: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().int().min(0)
  ).optional()
});

type ScorePayload = z.infer<typeof ScorePayloadSchema>;

interface DbUserRow {
  id: string;
  display_name: string | null;
}

async function ensureUserRecord(payload: ScorePayload): Promise<DbUserRow> {
  const normalizedEmail = normalizeEmail(payload.email);
  if (normalizedEmail) {
    const result = await sql<DbUserRow>`
      INSERT INTO sg_users (email, display_name)
      VALUES (${normalizedEmail}, ${payload.nickname})
      ON CONFLICT (email)
      DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, sg_users.display_name),
        updated_at = NOW()
      RETURNING id, display_name;
    `;
    return result.rows[0];
  }

  // For anonymous users, create a record without email
  const userResult = await sql<DbUserRow>`
    INSERT INTO sg_users (email, display_name)
    VALUES (${`anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@anonymous.local`}, ${payload.nickname})
    RETURNING id, display_name;
  `;
  return userResult.rows[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let payload: ScorePayload;
  try {
    const rawBody = await readJsonBody(req);
    const parsed = ScorePayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      sendJson(res, 400, { error: issue?.message ?? 'Invalid payload' });
      return;
    }
    payload = parsed.data;
  } catch (error) {
    if (error instanceof JsonBodyParseError) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    console.error('Unexpected error parsing score payload', error);
    sendJson(res, 500, { error: 'Unexpected error' });
    return;
  }

  try {
    await ensureTablesExist();
    const user = await ensureUserRecord(payload);

    const result = await sql<{
      id: string;
      user_id: string;
      score: number;
      max_tier_reached: number | null;
      pieces_merged: number | null;
      game_duration_seconds: number | null;
      created_at: string;
    }>`
      INSERT INTO sg_scores (user_id, score, max_tier_reached, pieces_merged, game_duration_seconds)
      VALUES (
        ${user.id},
        ${payload.score},
        ${payload.maxTierReached ?? null},
        ${payload.piecesMerged ?? null},
        ${payload.gameDurationSeconds ?? null}
      )
      RETURNING id, user_id, score, max_tier_reached, pieces_merged, game_duration_seconds, created_at;
    `;

    const entry = result.rows[0];

    // Calculate placement (rank) based on all-time scores
    const placementResult = await sql<{ higher: number }>`
      SELECT COUNT(DISTINCT user_id)::int AS higher
      FROM sg_scores
      WHERE score > ${payload.score};
    `;

    const placement = (placementResult.rows[0]?.higher ?? 0) + 1;

    sendJson(res, 201, {
      placement,
      entry: {
        id: entry.id,
        userId: entry.user_id,
        displayName: user.display_name,
        score: entry.score,
        maxTierReached: entry.max_tier_reached,
        piecesMerged: entry.pieces_merged,
        gameDurationSeconds: entry.game_duration_seconds,
        createdAt: entry.created_at
      }
    });
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      sendJson(res, 503, { error: error.message });
      return;
    }
    console.error('Failed to store score', error);
    sendJson(res, 500, { error: 'Failed to store score' });
  }
}
