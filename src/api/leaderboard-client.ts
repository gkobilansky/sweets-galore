export interface LeaderboardEntry {
  rank: number;
  id: string;
  displayName: string | null;
  score: number;
  maxTierReached: number | null;
  piecesMerged: number | null;
  gameDurationSeconds: number | null;
  createdAt: string;
  userId: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

export interface FetchLeaderboardOptions {
  limit?: number;
  signal?: AbortSignal;
}

const LEADERBOARD_ENDPOINT = '/api/leaderboard';

export async function fetchLeaderboard(options: FetchLeaderboardOptions = {}): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (options.limit) {
    params.set('limit', String(options.limit));
  }

  const query = params.toString();
  const url = query ? `${LEADERBOARD_ENDPOINT}?${query}` : LEADERBOARD_ENDPOINT;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: options.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Offline — leaderboard will refresh when you reconnect.');
    }
    throw new Error('Unable to reach leaderboard service');
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Received an invalid leaderboard response');
  }

  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load leaderboard';
    throw new Error(message);
  }

  const entries: LeaderboardEntry[] = Array.isArray(payload?.entries)
    ? payload.entries.map((entry: any) => ({
        rank: Number(entry?.rank ?? 0),
        id: String(entry?.id ?? ''),
        displayName: typeof entry?.displayName === 'string' ? entry.displayName : null,
        score: Number(entry?.score ?? 0),
        maxTierReached: typeof entry?.maxTierReached === 'number' ? entry.maxTierReached : null,
        piecesMerged: typeof entry?.piecesMerged === 'number' ? entry.piecesMerged : null,
        gameDurationSeconds: typeof entry?.gameDurationSeconds === 'number' ? entry.gameDurationSeconds : null,
        createdAt: String(entry?.createdAt ?? ''),
        userId: String(entry?.userId ?? '')
      }))
    : [];

  return { entries };
}
