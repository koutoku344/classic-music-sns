import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ArrowLeft, CheckCircle, Image as ImageIcon, Mic, X } from 'lucide-react';
import type { ScreenName } from '../types';
import type { SelectablePiece } from '../lib/practiceApi';
import { getOwnedPieces, loadCatalog, resolvePiece } from '../lib/practiceApi';
import { createPost, getPost, updatePost } from '../lib/postApi';
import PiecePicker from '../components/PiecePicker';
import PracticeAudioPicker from '../components/PracticeAudioPicker';
import PostImagePicker from '../components/PostImagePicker';

type Props = {
  navigate: (screen: ScreenName, params?: Record<string, string>) => void;
  editId?: string;
};

const ALL_PREFS = ['感想歓迎', 'Advice歓迎', '厳しめAdvice歓迎'];
type Panel = 'main' | 'audio' | 'piece' | 'image';

export default function CreatePost({ navigate, editId }: Props) {
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
  const [panel, setPanel] = useState<Panel>('main');

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [master, owned, existing] = await Promise.all([
          loadCatalog(),
          getOwnedPieces(getToken),
          editId ? getPost(editId, getToken) : Promise.resolve(null),
        ]);
        if (!active) return;
        setCatalog(master);
        setOwnedPieces(owned);
        if (existing) {
          const selected = [...master, ...owned].find(p =>
            existing.piece_id
              ? p.source === 'master' && p.id === existing.piece_id
              : p.source === 'user' && p.id === existing.user_piece_id
          );
          setPiece(selected ?? (
            existing.piece_id || existing.user_piece_id
              ? {
                  id: existing.piece_id ?? existing.user_piece_id!,
                  source: existing.piece_id ? 'master' : 'user',
                  composer: existing.composer_name ?? '',
                  title: existing.piece_title ?? '',
                  status: 'practicing',
                }
              : null
          ));
          setBody(existing.body);
          setPrefs(existing.feedback_prefs ?? []);
          setCommentsEnabled(existing.comments_enabled);
          setAudioId(existing.media?.find(m => m.media_type === 'audio')?.id ?? null);
          setImageIds((existing.media ?? [])
            .filter(m => m.media_type === 'image')
            .sort((a, b) => a.display_order - b.display_order)
            .map(m => m.id));
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'データの取得に失敗しました。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken, editId]);

  useEffect(() => {
    if (editId) return;
    const id = new URLSearchParams(window.location.search).get('audioMediaId');
    if (id && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) setAudioId(id);
  }, [editId]);

  function togglePref(pref: string) {
    setPrefs(current => current.includes(pref)
      ? current.filter(x => x !== pref)
      : [...current, pref]);
  }

  async function save() {
    if (loading || saving || audioBusy || imageBusy || !isSignedIn) return;
    setError('');
    if (!body.trim() && !audioId && imageIds.length === 0) {
      setError('本文・音声・画像のうち1つ以上を入力してください。');
      return;
    }
    if (piece && !audioId) {
      setError('演奏した曲を選択した場合は、音声の添付が必要です。');
      return;
    }
    if (body.trim().length > 2000) {
      setError('本文は2000文字以内にしてください。');
      return;
    }
    setSaving(true);
    try {
      const reference = piece ? await resolvePiece(piece, getToken) : {};
      const input = {
        body: body.trim(),
        pieceId: reference.pieceId ?? null,
        userPieceId: reference.userPieceId ?? null,
        mediaIds: [...(audioId ? [audioId] : []), ...imageIds],
        feedbackPrefs: prefs,
        commentsEnabled,
      };
      if (editId) {
        await updatePost(editId, input, getToken);
        navigate('postDetail', { id: editId });
      } else {
        setCreatedId(await createPost(input, getToken));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '投稿の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded) return <p className="p-6">読み込み中...</p>;
  if (!isSignedIn) return (
    <div className="max-w-2xl mx-auto p-6">
      <p>投稿にはログインが必要です。</p>
      <button className="text-teal-700" onClick={() => navigate('auth')}>ログインへ</button>
    </div>
  );

  const busy = loading || saving || audioBusy || imageBusy;
  const heading = panel === 'audio' ? '音声を追加' : panel === 'piece'
    ? '演奏した曲を選択' : panel === 'image' ? '画像を追加' : (editId ? '投稿を編集' : '演奏を投稿');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button type="button" onClick={() => {
        if (panel !== 'main') {
          if (audioBusy || imageBusy) return;
          setPanel(panel === 'piece' ? 'audio' : 'main');
        } else if (editId) navigate('postDetail', { id: editId });
        else navigate('community');
      }} className="flex items-center gap-2 text-ink-600 mb-4 text-sm">
        <ArrowLeft size={18}/> {panel === 'main' ? '戻る' : '入力画面へ戻る'}
      </button>
      {(panel !== "main" || editId) && <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">{heading}</h1>}

      {createdId ? (
        <div className="bg-white rounded-2xl border border-ink-100 p-6 space-y-3">
          <CheckCircle size={28} className="text-teal-600"/>
          <p className="font-bold">投稿を保存しました</p>
          <button onClick={() => navigate('postDetail', { id: createdId })}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg">投稿を見る</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5">
          {loading && <p className="text-sm text-ink-500">読み込み中...</p>}
          {error && panel !== 'main' && <p role="alert" className="text-sm text-red-600">{error}</p>}

          {panel === 'main' && (
            <>
              <div>
                <label htmlFor="post-body" className="block text-sm font-medium text-ink-700 mb-2">メッセージ</label>
                <textarea id="post-body" rows={5} value={body} maxLength={2000}
                  onChange={e => setBody(e.target.value)}
                  placeholder="いま何を演奏していますか？感想や聴いてほしいことを入力..."
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm resize-none"/>
                <p className="text-xs text-ink-400 text-right">{body.length}/2000文字</p>
              </div>
              <div className="flex items-center gap-3 py-2 border-y border-ink-100">
                <button type="button" aria-label="音声を追加" onClick={() => setPanel('audio')}
                  className="flex items-center gap-2 px-3 py-2 text-teal-700 rounded-lg hover:bg-teal-50">
                  <Mic size={21}/> <span className="text-sm">音声{audioId ? ' ✓' : ''}</span>
                </button>
                <button type="button" aria-label="画像を追加" onClick={() => setPanel('image')}
                  className="flex items-center gap-2 px-3 py-2 text-teal-700 rounded-lg hover:bg-teal-50">
                  <ImageIcon size={21}/> <span className="text-sm">画像{imageIds.length ? ` ${imageIds.length}枚` : ''}</span>
                </button>
              </div>
              {piece && (
                <div className="flex items-center justify-between gap-2 text-sm text-ink-700 rounded-lg bg-teal-50 p-3">
                  <span>演奏曲：{piece.composer} / {piece.title}</span>
                  <button type="button" onClick={() => setPanel('piece')} className="text-teal-700 underline">変更</button>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">フィードバック希望</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PREFS.map(pref => (
                    <button type="button" key={pref} onClick={() => togglePref(pref)}
                      className={`px-3 py-2 rounded-full text-sm border ${prefs.includes(pref) ? 'bg-gold-100 border-gold-300' : 'border-ink-200'}`}>
                      {pref}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between text-sm text-ink-700">
                コメント受付
                <input type="checkbox" checked={commentsEnabled}
                  onChange={e => setCommentsEnabled(e.target.checked)}/>
              </label>
              
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button type="button" disabled={busy} onClick={() => void save()}
                className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium disabled:opacity-50">
                {saving ? '保存中...' : editId ? '変更を保存' : '投稿する'}
              </button>
            </>
          )}

          {panel === 'audio' && (
            <>
              <p className="text-sm text-ink-600">録音・ファイル・保存済み音声から選択してください。曲の指定は任意です。</p>
              <PracticeAudioPicker
                getToken={getToken} value={audioId} onChange={setAudioId}
                disabled={saving} onBusyChange={setAudioBusy}
                contextLabel="投稿"
              />
              <div className="flex items-center justify-between gap-3 border border-ink-200 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-xs text-ink-500">演奏した曲</p>
                  <p className="text-sm text-ink-800 truncate">
                    {piece ? `${piece.composer} / ${piece.title}` : '未選択'}
                  </p>
                </div>
                <button type="button" disabled={audioBusy} onClick={() => setPanel('piece')}
                  className="shrink-0 text-sm font-medium text-teal-700 underline disabled:opacity-50">
                  {piece ? '曲を変更' : '曲を選択'}
                </button>
              </div>
              <button type="button" disabled={audioBusy} onClick={() => setPanel('main')}
                className="w-full py-3 rounded-xl bg-teal-600 text-white disabled:opacity-50">
                入力画面へ戻る
              </button>
            </>
          )}

          {panel === 'piece' && (
            <>
              <PiecePicker
                pieces={catalog} selectedPiece={piece}
                onSelect={p => {
                  setPiece(p as SelectablePiece | null);
                  setPanel('audio');
                }}
                ownedPieces={ownedPieces} recentPieces={[]}
                label="演奏した曲"
              />
              {piece && (
                <button type="button" onClick={() => { setPiece(null); setPanel('audio'); }}
                  className="flex items-center gap-2 text-sm text-ink-500">
                  <X size={16}/> 曲の選択を解除
                </button>
              )}
              <p className="text-xs text-ink-500">曲を登録する場合は音声が必要です。</p>
              <button onClick={() => setPanel('audio')} className="w-full p-3 rounded-xl border border-ink-200">音声選択に戻る</button>
            </>
          )}

          {panel === 'image' && (
            <>
              <PostImagePicker
                getToken={getToken} value={imageIds} onChange={setImageIds}
                disabled={saving} onBusyChange={setImageBusy}
              />
              <button type="button" disabled={imageBusy} onClick={() => setPanel('main')}
                className="w-full p-3 rounded-xl bg-teal-600 text-white disabled:opacity-50">入力画面へ戻る</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
