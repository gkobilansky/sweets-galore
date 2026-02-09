import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { DatabaseConfigError, ensureTablesExist, normalizeEmail } from './_db.js';
import { JsonBodyParseError, readJsonBody, sendJson } from './_http.js';

const UserPayloadSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().email('Email must be valid').max(254, 'Email must be 254 characters or fewer')
  ),
  displayName: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().min(2).max(24)
  ).optional()
});

type UserPayload = z.infer<typeof UserPayloadSchema>;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let payload: UserPayload;
  try {
    const rawBody = await readJsonBody(req);
    const parsed = UserPayloadSchema.safeParse(rawBody);
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
    console.error('Unexpected error parsing user payload', error);
    sendJson(res, 500, { error: 'Unexpected error' });
    return;
  }

  try {
    await ensureTablesExist();
    const normalizedEmail = normalizeEmail(payload.email);
    if (!normalizedEmail) {
      sendJson(res, 400, { error: 'Email is required' });
      return;
    }

    const result = await sql<{ id: string; display_name: string | null }>`
      INSERT INTO sg_users (email, display_name)
      VALUES (${normalizedEmail}, ${payload.displayName ?? null})
      ON CONFLICT (email)
      DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, sg_users.display_name),
        updated_at = NOW()
      RETURNING id, display_name;
    `;

    const record = result.rows[0];

    sendJson(res, 200, {
      id: record.id,
      email: normalizedEmail,
      displayName: record.display_name ?? null
    });
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      sendJson(res, 503, { error: error.message });
      return;
    }
    console.error('Failed to store user contact info', error);
    sendJson(res, 500, { error: 'Failed to store user contact info' });
  }
}
