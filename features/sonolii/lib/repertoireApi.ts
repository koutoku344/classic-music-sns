import type { Piece } from '../types';

export const API_BASE = 'https://sonolii-api.g57cydy6ks.workers.dev';

export type RepertoireRow = {
  id: string;
  piece_id: string | null;
  custom_composer: string | null;
  custom_title: string | null;
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
    composer: row.composer_name ?? row.custom_composer ?? '',
    title: row.piece_title ?? row.custom_title ?? '',
    status: row.status,
  };
}
