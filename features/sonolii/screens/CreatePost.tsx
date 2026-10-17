import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import type { ScreenName } from '../types';
import type { SelectablePiece } from '../lib/practiceApi';
import {
  getOwnedPieces, loadCatalog, resolvePiece,
} from '../lib/practiceApi';
import { createPost } from '../lib/postApi';
import PiecePicker from '../components/PiecePicker';
import PracticeAudioPicker from '../components/PracticeAudioPicker';
import PostImagePicker from '../components/PostImagePicker';

type Props = {
  navigate: (screen: ScreenName, params?: Record<string, string>) => void;
};

const ALL_PREFS = ['感想歓迎', 'Advice歓迎', '厳しめAdvice歓迎'];

export default function CreatePost({ navigate }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [body, setBody] = useState('');
  const [piece, setPiece] = useState<SelectablePiece | null>(null);
  const [catalog, setCatalog] = useState<SelectablePiece[]>([]);
  const [ownedPieces, setOwnedPieces] = useState<SelectablePiece[]>([]);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<string[]>([]);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [audioBusy, setAudioBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [master, owned] = await Promise.all([
          loadCatalog(),
          getOwnedPieces(getToken),
        ]);
        if (active) {
          setCatalog(master);
          setOwnedPieces(owned);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '曲の読み込みに失敗しました。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken]);

  // /record can hand off an existing saved audio media ID.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('audioMediaId');
    if (id && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) setAudioId(id);
  }, []);

  function togglePref(pref: string) {
    setPrefs(current => current.includes(pref)
      ? current.filter(x => x !== pref)
      : current.length < 3 ? [...current, pref] : current);
  }

  const busy = saving || loading || audioBusy || imageBusy;
  const canPost = isSignedIn && !busy && (!piece || !!audioId)
    && (body.trim().length > 0 || !!audioId || imageIds.length > 0);

  async function save() {
    if (!canPost || createdId) return;
    if (piece && !audioId) {
      setError('演奏した曲を選択した場合は、音声を添付してください。');
      return;
    }
    if (body.trim().length > 2000) {
      setError('本文は2000文字以内にしてください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const reference = piece
        ? await resolvePiece(piece, getToken)
        : {};
      const id = await createPost({
        body: body.trim(),
        pieceId: reference.pieceId ?? null,
        userPieceId: reference.userPieceId ?? null,
        mediaIds: [...(audioId ? [audioId] : []), ...imageIds],
        feedbackPrefs: prefs,
        commentsEnabled,
      }, getToken);
      setCreatedId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '投稿に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded) {
    return <p className="max-w-2xl mx-auto p-6 text-ink-500">読み込み中...</p>;
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-3">
        <p className="text-ink-700">投稿にはログインが必要です。</p>
        <button className="text-teal-700" onClick={() => navigate('auth')}>ログインへ</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('community')}
        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">演奏を投稿</h1>

      {createdId ? (
        <div className="bg-white rounded-2xl border border-ink-100 p-6 space-y-3">
          <CheckCircle className="text-teal-600" size={28} />
          <h2 className="text-lg font-bold text-ink-900">投稿を保存しました</h2>
          <p className="text-sm text-ink-600">投稿は保存され、公開範囲に応じてコミュニティに表示されます。</p>
          <p className="text-xs text-ink-400 break-all">投稿ID：{createdId}</p>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm"
              onClick={() => navigate('postDetail', { id: createdId })}>投稿を見る</button>
            <button className="px-4 py-2 rounded-lg border border-ink-200 text-ink-700 text-sm"
              onClick={() => navigate('community')}>コミュニティへ</button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5">
          {loading && <p className="text-sm text-ink-500">曲データを読み込み中...</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <div>
            <label htmlFor="post-body" className="block text-sm font-medium text-ink-700 mb-2">メッセージ（任意）</label>
            <textarea id="post-body" rows={4} maxLength={2000}
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="練習の感想や聴いてほしいポイントなど"
              className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"/>
            <p className="text-xs text-ink-400 text-right">{body.length}/2000文字</p>
          </div>

          <div>
            <PiecePicker
              pieces={catalog}
              selectedPiece={piece}
              onSelect={p => setPiece(p as SelectablePiece | null)}
              ownedPieces={ownedPieces}
              recentPieces={[]}
              label="演奏した曲（音声がある場合のみ・任意）"
            />
            <p className="text-xs text-ink-500 mt-1">曲の選択は任意です。選択する場合は音声の添付が必須です。</p>
          </div>

          <PracticeAudioPicker
            getToken={getToken}
            value={audioId}
            onChange={setAudioId}
            disabled={saving}
            onBusyChange={setAudioBusy}
          />

          <PostImagePicker
            getToken={getToken}
            value={imageIds}
            onChange={setImageIds}
            disabled={saving}
            onBusyChange={setImageBusy}
          />

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">フィードバック希望</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PREFS.map(pref => (
                <button type="button" key={pref} onClick={() => togglePref(pref)}
                  className={`px-4 py-2 rounded-full text-sm border-2 font-medium ${prefs.includes(pref)
                    ? 'bg-gold-100 text-gold-700 border-gold-300'
                    : 'bg-white text-ink-600 border-ink-200'}`}>
                  {pref}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label htmlFor="post-comments" className="text-sm font-medium text-ink-700">コメント受付（将来の交流機能用）</label>
            <input id="post-comments" type="checkbox" checked={commentsEnabled}
              onChange={e => setCommentsEnabled(e.target.checked)} />
          </div>

          {piece && !audioId && (
            <p role="status" className="text-sm text-amber-700">
              演奏した曲を選択したため、音声を添付すると投稿できます。
            </p>
          )}
          <p className="text-xs text-ink-500">
            本文・音声・画像のうち1つ以上が必要です。曲を選択した場合は音声必須です。公開範囲はプロフィール設定に従います。
          </p>
          <button type="button" disabled={!canPost}
            onClick={() => void save()}
            className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? '投稿を保存中...' : '投稿する'}
          </button>
        </div>
      )}
    </div>
  );
}
