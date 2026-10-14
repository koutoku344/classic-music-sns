import { API_BASE } from './repertoireApi';
import type { Piece } from '../types';

export type SelectablePiece = Piece & { source: 'master' | 'user' | 'manual' };

export type PracticeRow = {
  id: string;
  piece_id: string | null;
  user_piece_id: string | null;
  practice_date: string;
  composer_name: string;
  piece_title: string;
  duration_minutes: number;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type UserPieceRow = {
  id: string;
  composer: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type PracticeInput = {
  practiceDate: string;
  pieceId?: string;
  userPieceId?: string;
  durationMinutes: number;
  comment: string;
};

export function toSelectablePiece(
  row: PracticeRow,
): SelectablePiece {
  return {
    id: row.user_piece_id ?? row.piece_id ?? '',
    source: row.user_piece_id ? 'user' : 'master',
    composer: row.composer_name,
    title: row.piece_title,
    status: 'practicing',
  };
}

export function toUserPiece(row: UserPieceRow): SelectablePiece {
  return {
    id: row.id,
    source: 'user',
    composer: row.composer,
    title: row.title,
    status: 'practicing',
  };
}

export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function apiFetch(
  path: string,
  getToken: () => Promise<string | null>,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  if (!token) {
    throw new Error('ログインが必要です。');
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('再度ログインしてください。');
    }
    if (res.status === 404) {
      throw new Error('指定したデータが見つかりません。');
    }
    if (res.status === 409) {
      throw new Error('同じ曲がすでに登録されています。');
    }
    throw new Error(`APIエラー（HTTP ${res.status}）`);
  }
  return res;
}

export async function getOwnedPieces(
  getToken: () => Promise<string | null>,
): Promise<SelectablePiece[]> {
  const res = await apiFetch('/me/pieces', getToken);
  const data = await res.json() as { pieces: UserPieceRow[] };
  return data.pieces.map(toUserPiece);
}

export async function resolvePiece(
  piece: SelectablePiece,
  getToken: () => Promise<string | null>,
): Promise<{ pieceId?: string; userPieceId?: string }> {
  if (piece.source === 'master') return { pieceId: piece.id };
  if (piece.source === 'user') return { userPieceId: piece.id };
  const res = await apiFetch('/me/pieces', getToken, {
    method: 'POST',
    body: JSON.stringify({ composer: piece.composer, title: piece.title }),
  });
  const data = await res.json() as { piece: UserPieceRow };
  return { userPieceId: data.piece.id };
}

export async function getAllPractices(
  getToken: () => Promise<string | null>,
  from?: string,
  to?: string,
): Promise<PracticeRow[]> {
  const all: PracticeRow[] = [];
  let cursor: string | null = null;
  // Per-page data is not used to calculate the total. Fetch all requested pages.
  do {
    const search = new URLSearchParams({ limit: '100' });
    if (from && to) {
      search.set('from', from);
      search.set('to', to);
    }
    if (cursor) {
      search.set('cursor', cursor);
    }
    const res = await apiFetch(`/practices?${search}`, getToken);
    const data = await res.json() as {
      practices: PracticeRow[];
      nextCursor: string | null;
    };
    all.push(...data.practices);
    cursor = data.nextCursor;
  } while (cursor !== null);
  return all;
}

export async function loadCatalog(): Promise<SelectablePiece[]> {
  const res = await fetch(`${API_BASE}/catalog/pieces`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`曲マスタの取得に失敗しました（HTTP ${res.status}）`);
  }
  const data = await res.json() as {
    pieces: { id: string; composer_name: string; title: string }[];
  };
  return data.pieces.map(p => ({
    id: p.id,
    source: 'master' as const,
    composer: p.composer_name,
    title: p.title,
    status: 'practicing' as const,
  }));
}
