import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { DatabaseConfigError, ensureTablesExist } from './_db.js';
import { sendJson } from './_http.js';

interface LeaderboardRow {
  id: string;
  display_name: string | null;
  score: number;
  max_tier_reached: number | null;
  pieces_merged: number | null;
  game_duration_seconds: number | null;
  created_at: string;
  user_id: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const limitParam = req.query?.limit;
  const limit = Math.min(
    Math.max(1, parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam || '10', 10) || 10),
    100
  );

  try {
    await ensureTablesExist();

    // Use the sg_leaderboard view which protects email addresses
    const result = await sql<LeaderboardRow>`
      SELECT
        id,
        display_name,
        score,
        max_tier_reached,
        pieces_merged,
        game_duration_seconds,
        created_at,
        user_id
      FROM sg_leaderboard
      LIMIT ${limit};
    `;

    sendJson(res, 200, {
      entries: result.rows.map((row: LeaderboardRow, index: number) => ({
        rank: index + 1,
        id: row.id,
        displayName: row.display_name,
        score: row.score,
        maxTierReached: row.max_tier_reached,
        piecesMerged: row.pieces_merged,
        gameDurationSeconds: row.game_duration_seconds,
        createdAt: row.created_at,
        userId: row.user_id
      }))
    });
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      sendJson(res, 503, { error: error.message });
      return;
    }
    console.error('Failed to fetch leaderboard', error);
    sendJson(res, 500, { error: 'Failed to fetch leaderboard' });
  }
}
