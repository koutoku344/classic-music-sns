import { useEffect, useState } from 'react';
import { ImagePlus, Library, X } from 'lucide-react';
import {
  imageReadUrl, listPastImages, uploadImage,
  type MediaRow, type TokenGetter,
} from '../lib/mediaApi';

type Props = {
  getToken: TokenGetter;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

export default function PostImagePicker({
  getToken, value, onChange, disabled = false, onBusyChange,
}: Props) {
  const [past, setPast] = useState<MediaRow[]>([]);
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [showPast, setShowPast] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingPast, setLoadingPast] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { onBusyChange?.(uploading); }, [uploading, onBusyChange]);

  // GET signatures expire after 5 minutes. New previews are requested when
  // selected images change; expired previews are reloaded on selection refresh.
  useEffect(() => {
    let active = true;
    (async () => {
      for (const id of value) {
        if (preview[id]) continue;
        try {
          const url = await imageReadUrl(id, getToken);
          if (active) setPreview(p => ({ ...p, [id]: url }));
        } catch {
          if (active) setError('画像のプレビューを取得できませんでした。');
        }
      }
    })();
    return () => { active = false; };
  }, [value, getToken]);

  async function addFiles(files: FileList | null) {
    if (!files || disabled || uploading) return;
    const items = Array.from(files);
    if (items.length + value.length > 5) {
      setError('画像は最大5枚までです。');
      return;
    }
    setError('');
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of items) {
        const id = await uploadImage(file, getToken);
        added.push(id);
      }
      onChange([...value, ...added]);
    } catch (e) {
      // Successfully uploaded files remain available in media management
      // even when a later item fails.
      if (added.length) onChange([...value, ...added]);
      setError(e instanceof Error ? e.message : '画像のアップロードに失敗しました。');
    } finally {
      setUploading(false);
    }
  }

  async function loadPast() {
    setLoadingPast(true);
    setError('');
    setShowPast(true);
    try {
      setPast(await listPastImages(getToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存済み画像を取得できませんでした。');
    } finally {
      setLoadingPast(false);
    }
  }

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter(x => x !== id));
    } else if (value.length < 5) {
      onChange([...value, id]);
      setError('');
    } else {
      setError('画像は最大5枚までです。');
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink-700">画像（任意・最大5枚）</label>
        <span className="text-xs text-ink-400">{value.length}/5枚</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={`border-2 border-dashed border-ink-200 rounded-xl p-4 text-center text-sm cursor-pointer hover:border-teal-400 ${disabled || uploading || value.length >= 5 ? 'opacity-40 pointer-events-none' : ''}`}>
          <ImagePlus size={21} className="mx-auto mb-1 text-ink-500" />
          画像をアップロード
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" multiple className="hidden"
            disabled={disabled || uploading || value.length >= 5}
            onChange={e => { void addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <button type="button" disabled={disabled || uploading} onClick={() => void loadPast()}
          className="border-2 border-dashed border-ink-200 rounded-xl p-4 text-center text-sm hover:border-teal-400 disabled:opacity-40">
          <Library size={21} className="mx-auto mb-1 text-ink-500" />保存済み画像
        </button>
      </div>
      <p className="text-xs text-ink-500">JPEG・PNG・WebP・HEIC・HEIF、1枚10MB以下。選択した順に表示します。</p>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((id, index) => (
            <div key={id} className="relative border border-ink-200 rounded-xl overflow-hidden">
              {preview[id]
                ? <img alt={`投稿画像 ${index + 1}`} src={preview[id]} className="w-full h-28 object-cover" />
                : <div className="h-28 flex items-center justify-center text-xs text-ink-400">読み込み中</div>}
              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 rounded">{index + 1}</span>
              <button type="button" disabled={disabled || uploading} onClick={() => toggle(id)}
                aria-label={`画像 ${index + 1} を解除`}
                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full disabled:opacity-40"><X size={14}/></button>
            </div>
          ))}
        </div>
      )}
      {showPast && (
        <div className="border border-ink-200 rounded-xl p-3 space-y-2 max-h-60 overflow-y-auto">
          <div className="flex justify-between">
            <p className="text-xs font-medium text-ink-700">保存済み画像</p>
            <button type="button" onClick={() => setShowPast(false)} aria-label="閉じる"><X size={16}/></button>
          </div>
          {loadingPast && <p className="text-xs">読み込み中...</p>}
          {!loadingPast && past.length === 0 && <p className="text-xs text-ink-500">保存済み画像はありません。</p>}
          {past.map(item => (
            <label key={item.id} className="flex gap-3 items-center text-xs py-2 border-b border-ink-100">
              <input type="checkbox" checked={value.includes(item.id)}
                disabled={disabled || uploading || (!value.includes(item.id) && value.length >= 5)}
                onChange={() => toggle(item.id)} />
              <span>{new Date(item.created_at).toLocaleString('ja-JP')} ・ {(item.size_bytes / 1_000_000).toFixed(1)} MB</span>
            </label>
          ))}
        </div>
      )}
      {uploading && <p role="status" className="text-sm text-ink-600">R2へ画像をアップロード中です。画面を閉じずにお待ちください。</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
