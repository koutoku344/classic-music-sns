import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { Piece, ScreenName } from '../types';
import { API_BASE, toPiece } from '../lib/repertoireApi';
import type {
  RepertoireItemResponse,
  RepertoireResponse,
} from '../lib/repertoireApi';
import PiecePicker from '../components/PiecePicker';
import { getOwnedPieces, resolvePiece } from '../lib/practiceApi';
import type { SelectablePiece } from '../lib/practiceApi';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Music2,
  MoreVertical,
  X,
  Trash2,
} from 'lucide-react';

interface RepertoireProps {
  navigate: (s: ScreenName) => void;
}

type RepertoireStatus = 'practicing' | 'repertoire';

type CatalogResponse = {
  composers: { id: string; name: string }[];
  pieces: {
    id: string;
    composer_id: string;
    title: string;
    composer_name: string;
  }[];
};

const statusOrder: Record<Piece['status'], number> = {
  practicing: 0,
  repertoire: 1,
  performed: 2,
};

const statusLabels: Record<Piece['status'], string> = {
  practicing: '練習中',
  repertoire: 'レパートリー',
  performed: '演奏済',
};

const statusBadgeColors: Record<Piece['status'], string> = {
  practicing: 'bg-gold-100 text-gold-700',
  repertoire: 'bg-teal-100 text-teal-700',
  performed: 'bg-sage-100 text-sage-700',
};

const statusIconColors: Record<Piece['status'], string> = {
  practicing: 'bg-gold-50 text-gold-600',
  repertoire: 'bg-teal-50 text-teal-600',
  performed: 'bg-sage-50 text-sage-600',
};

function responseError(response: Response): Error {
  if (response.status === 401) {
    return new Error('認証の有効期限が切れました。再度ログインしてください。');
  }
  if (response.status === 409) {
    return new Error('この曲はすでに登録されています。');
  }
  return new Error(`APIエラー（HTTP ${response.status}）`);
}

export default function Repertoire({ navigate }: RepertoireProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [repertoire, setRepertoire] = useState<Piece[]>([]);
  const [catalog, setCatalog] = useState<SelectablePiece[]>([]);
  const [owned, setOwned] = useState<SelectablePiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<SelectablePiece | null>(null);
  const [newStatus, setNewStatus] = useState<RepertoireStatus>('practicing');

  // 楽曲マスタは公開APIから取得する。マスタIDは user_repertoire.id とは異なる。
  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const response = await fetch(`${API_BASE}/catalog/pieces`, {
          signal: controller.signal,
        });
        if (!response.ok) throw responseError(response);

        const data = (await response.json()) as CatalogResponse;
        if (controller.signal.aborted) return;

        setCatalog(
          data.pieces.map((item) => ({
            id: item.id,
            composer: item.composer_name,
            title: item.title,
            status: 'practicing' as const,
            source: 'master' as const,
          })),
        );
      } catch (cause) {
        if (!controller.signal.aborted) {
          setCatalogError(cause instanceof Error ? cause.message : '曲マスタを取得できませんでした。');
        }
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, []);

  // ログイン中のユーザーが登録したレパートリーだけを取得する。
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setRepertoire([]);
      setOwned([]);
      setLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();

    async function loadRepertoire() {
      setLoading(true);
      setError('');
      try {
        const token = await getToken();
        if (!token) throw new Error('ログインが必要です。');
        if (controller.signal.aborted) return;

        const response = await fetch(`${API_BASE}/me/repertoire`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw responseError(response);

        const data = (await response.json()) as RepertoireResponse;
        const personal = await getOwnedPieces(getToken);
        if (!controller.signal.aborted) {
          setRepertoire(data.repertoire.map(toPiece));
          setOwned(personal.concat(data.repertoire.filter(r => r.piece_id).map(r => ({
            id: r.piece_id!, source: 'master' as const,
            composer: r.composer_name ?? '', title: r.piece_title ?? '',
            status: 'practicing' as const,
          }))));
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'レパートリーを取得できませんでした。');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRepertoire();
    return () => controller.abort();
  }, [isLoaded, isSignedIn, getToken]);

  async function authorizedRequest(
    path: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
  ): Promise<Response> {
    if (!isLoaded || !isSignedIn) throw new Error('ログインが必要です。');

    const token = await getToken();
    if (!token) throw new Error('ログインが必要です。');

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw responseError(response);
    return response;
  }

  async function handleAdd() {
    if (!selectedPiece || saving || !isSignedIn) return;


    setSaving(true);
    setError('');
    try {
      const selection = await resolvePiece(selectedPiece, getToken);
      const response = await authorizedRequest('/me/repertoire', 'POST', { ...selection, status: newStatus });
      const data = (await response.json()) as RepertoireItemResponse;
      setRepertoire((previous) => [...previous, toPiece(data.repertoire)]);
      if (selectedPiece.source === 'manual') {
        const personal = await getOwnedPieces(getToken);
        setOwned(previous => [...personal, ...previous.filter(p => p.source === 'master')]);
      }
      setSelectedPiece(null);
      setNewStatus('practicing');
      setShowAdd(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '曲を追加できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  async function cycleStatus(id: string) {
    if (saving || !isSignedIn) return;
    const target = repertoire.find((piece) => piece.id === id);
    if (!target) return;
    const status: RepertoireStatus = target.status === 'practicing' ? 'repertoire' : 'practicing';

    setSaving(true);
    setError('');
    try {
      const response = await authorizedRequest(`/me/repertoire/${encodeURIComponent(id)}`, 'PATCH', {
        status,
      });
      const data = (await response.json()) as RepertoireItemResponse;
      const updated = toPiece(data.repertoire);
      setRepertoire((previous) => previous.map((piece) => (piece.id === id ? updated : piece)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ステータスを変更できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  async function deletePiece(id: string) {
    if (saving || !isSignedIn) return;
    setSaving(true);
    setError('');
    try {
      await authorizedRequest(`/me/repertoire/${encodeURIComponent(id)}`, 'DELETE');
      // DELETEは204・本文なしを想定する。
      setRepertoire((previous) => previous.filter((piece) => piece.id !== id));
      setMenuOpenId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '曲を削除できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...repertoire].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status],
  );
  const practicing = sorted.filter((piece) => piece.status === 'practicing');
  const repertoireList = sorted.filter(
    (piece) => piece.status === 'repertoire' || piece.status === 'performed',
  );

  const renderItem = (piece: Piece) => (
    <div
      key={piece.id}
      className="bg-white rounded-xl border border-ink-100 p-4 flex items-center gap-3 group hover:shadow-sm transition-shadow relative"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusIconColors[piece.status]}`}>
        <Music2 size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink-900 text-sm">
          <span className="italic text-ink-500">{piece.composer}</span> / {piece.title}
        </p>
        <button
          onClick={() => void cycleStatus(piece.id)}
          disabled={saving || !isSignedIn}
          className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50 ${statusBadgeColors[piece.status]}`}
        >
          {statusLabels[piece.status]} · タップで変更
        </button>
      </div>
      <button
        onClick={() => setMenuOpenId(menuOpenId === piece.id ? null : piece.id)}
        disabled={saving || !isSignedIn}
        className="text-ink-400 hover:text-ink-600 transition-colors disabled:opacity-50"
        aria-label={`${piece.title}のメニュー`}
      >
        <MoreVertical size={18} />
      </button>
      {menuOpenId === piece.id && (
        <div className="absolute right-4 top-12 z-20 bg-white rounded-xl shadow-lg border border-ink-100 py-1 min-w-[120px] animate-scale-in">
          <button
            onClick={() => void deletePiece(piece.id)}
            disabled={saving}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-burgundy-600 hover:bg-burgundy-50 disabled:opacity-50"
          >
            <Trash2 size={14} /> 削除
          </button>
          <button
            onClick={() => setMenuOpenId(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50"
          >
            <X size={14} /> キャンセル
          </button>
        </div>
      )}
    </div>
  );

  if (showAdd) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => {
            if (saving) return;
            setShowAdd(false);
            setSelectedPiece(null);
            setNewStatus('practicing');
            setError('');
          }}
          disabled={saving}
          className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium disabled:opacity-50"
        >
          <ArrowLeft size={18} /> 戻る
        </button>

        <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">レパートリーを追加</h1>

        <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5 animate-slide-up">
          {catalogLoading && <p className="text-sm text-ink-500">曲マスタを読み込み中...</p>}
          {catalogError && <p role="alert" className="text-sm text-red-600">{catalogError}</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <PiecePicker
            pieces={catalog}
            selectedPiece={selectedPiece}
            onSelect={p => setSelectedPiece(p as SelectablePiece | null)}
            ownedPieces={owned}
            label="曲"
          />

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">ステータス</label>
            <div className="flex gap-2">
              {(['practicing', 'repertoire'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setNewStatus(status)}
                  disabled={saving}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 disabled:opacity-50 ${
                    newStatus === status
                      ? status === 'practicing'
                        ? 'bg-gold-100 text-gold-700 border-gold-300'
                        : 'bg-teal-100 text-teal-700 border-teal-300'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                  }`}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void handleAdd()}
            disabled={!selectedPiece || saving || !isSignedIn || loading}
            className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '追加する'}
          </button>
          {!isSignedIn && <p className="text-sm text-ink-500">曲を登録するにはログインしてください。</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button
        onClick={() => navigate('myPage')}
        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium"
      >
        <ArrowLeft size={18} /> マイページ
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-ink-900 flex items-center gap-2">
          <BookOpen size={22} className="text-teal-600" /> レパートリー
        </h1>
        <button
          onClick={() => {
            setError('');
            setShowAdd(true);
          }}
          disabled={saving || loading || !isSignedIn}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> 追加
        </button>
      </div>

      {loading && <p className="mb-4 text-sm text-ink-500">レパートリーを読み込み中...</p>}
      {!isSignedIn && isLoaded && <p className="mb-4 text-sm text-ink-500">ログインするとレパートリーを管理できます。</p>}
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      {saving && <p className="mb-4 text-sm text-ink-500">保存中...</p>}

      {!loading && isSignedIn && (
        <>
          <section className="mb-6">
            <h2 className="font-serif text-lg font-semibold text-ink-800 mb-3">練習中</h2>
            <div className="space-y-2">
              {practicing.map(renderItem)}
              {practicing.length === 0 && !error && (
                <p className="text-sm text-ink-400 text-center py-8">練習中の曲はありません</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink-800 mb-3">レパートリー</h2>
            <div className="space-y-2">
              {repertoireList.map(renderItem)}
              {repertoireList.length === 0 && !error && (
                <p className="text-sm text-ink-400 text-center py-8">レパートリーはありません</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
