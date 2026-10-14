import type { Piece } from '../types';

export const API_BASE = 'https://sonolii-api.g57cydy6ks.workers.dev';

export type RepertoireRow = {
  id: string;
  piece_id: string | null;
  user_piece_id: string | null;
  composer_name: string | null;
  piece_title: string | null;
  status: 'practicing' | 'repertoire';
  created_at: string;
};

export type RepertoireResponse = { repertoire: RepertoireRow[] };
export type RepertoireItemResponse = { repertoire: RepertoireRow };

export function toPiece(row: RepertoireRow): Piece {
  return {
    id: row.id,
    composer: row.composer_name ?? '',
    title: row.piece_title ?? '',
    status: row.status,
  };
}
