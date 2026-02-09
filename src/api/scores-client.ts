export interface SubmitScorePayload {
  nickname: string;
  score: number;
  email?: string;
  maxTierReached?: number;
  piecesMerged?: number;
  gameDurationSeconds?: number;
}

export interface SubmitScoreResponse {
  placement: number;
  entry: {
    id: string;
    userId: string;
    displayName: string | null;
    score: number;
    maxTierReached: number | null;
    piecesMerged: number | null;
    gameDurationSeconds: number | null;
    createdAt: string;
  };
}

export interface SubmitScoreOptions {
  signal?: AbortSignal;
}

const SCORES_ENDPOINT = '/api/scores';

export async function submitScore(
  payload: SubmitScorePayload,
  options: SubmitScoreOptions = {}
): Promise<SubmitScoreResponse> {
  const nickname = payload.nickname?.trim();
  if (!nickname) {
    throw new Error('Nickname is required');
  }

  if (!Number.isFinite(payload.score)) {
    throw new Error('Score is missing');
  }

  const email = payload.email?.trim();

  let response: Response;
  try {
    response = await fetch(SCORES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        nickname,
        email: email?.length ? email : undefined,
        score: payload.score,
        maxTierReached: payload.maxTierReached,
        piecesMerged: payload.piecesMerged,
        gameDurationSeconds: payload.gameDurationSeconds
      }),
      signal: options.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Offline — reconnect to submit your score.');
    }
    throw new Error('Unable to reach score service');
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    throw new Error('Score service returned an invalid response');
  }

  if (!response.ok) {
    const serverMessage = typeof body?.error === 'string' ? body.error : null;
    if (response.status === 400) {
      throw new Error(serverMessage ?? 'Please check your nickname and try again');
    }
    if (response.status === 503) {
      throw new Error(serverMessage ?? 'Score service is temporarily unavailable');
    }
    throw new Error(serverMessage ?? 'Failed to submit score');
  }

  return {
    placement: Number(body?.placement ?? 0),
    entry: {
      id: String(body?.entry?.id ?? ''),
      userId: String(body?.entry?.userId ?? ''),
      displayName: typeof body?.entry?.displayName === 'string' ? body.entry.displayName : null,
      score: Number(body?.entry?.score ?? payload.score),
      maxTierReached: typeof body?.entry?.maxTierReached === 'number' ? body.entry.maxTierReached : null,
      piecesMerged: typeof body?.entry?.piecesMerged === 'number' ? body.entry.piecesMerged : null,
      gameDurationSeconds: typeof body?.entry?.gameDurationSeconds === 'number' ? body.entry.gameDurationSeconds : null,
      createdAt: typeof body?.entry?.createdAt === 'string' ? body.entry.createdAt : ''
    }
  };
}
