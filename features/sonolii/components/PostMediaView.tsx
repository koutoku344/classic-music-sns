import { useEffect, useRef, useState } from 'react';
import { postMediaReadUrl, type PostMedia } from '../lib/postApi';
import type { TokenGetter } from '../lib/mediaApi';

type Props = {
  postId: string;
  media: PostMedia[];
  getToken: TokenGetter;
  compact?: boolean;
  onAudioTimeChange?: (seconds: number | null) => void;
  seekToSeconds?: number | null;
  seekVersion?: number;
};

function MediaItem({
  postId, item, getToken, compact, onAudioTimeChange, seekToSeconds, seekVersion,
}: {
  postId: string;
  item: PostMedia;
  getToken: TokenGetter;
  compact: boolean;
  onAudioTimeChange?: (seconds: number | null) => void;
  seekToSeconds?: number | null;
  seekVersion?: number;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (item.media_type !== 'audio' || seekToSeconds === null || seekToSeconds === undefined) return;
    const audio = audioRef.current;
    if (!audio) return;
    const seek = () => { audio.currentTime = seekToSeconds; };
    if (audio.readyState >= 1) seek();
    else audio.addEventListener('loadedmetadata', seek, { once: true });
    return () => audio.removeEventListener('loadedmetadata', seek);
  }, [item.media_type, seekToSeconds, seekVersion, url]);

  useEffect(() => {
    let active = true;
    setUrl('');
    setError('');
    void postMediaReadUrl(postId, item.id, getToken)
      .then(value => { if (active) setUrl(value); })
      .catch(e => {
        if (active) setError(e instanceof Error ? e.message : 'メディアを読み込めません。');
      });
    return () => { active = false; };
  }, [postId, item.id, getToken, retry]);

  if (error) {
    return (
      <div className="rounded-lg border border-ink-200 p-3 text-sm text-ink-600">
        {error}
        <button type="button" className="ml-2 text-teal-700 underline"
          onClick={() => setRetry(v => v + 1)}>再取得</button>
      </div>
    );
  }

  if (!url) {
    return <div className="bg-ink-50 rounded-lg p-4 text-sm text-ink-400">読み込み中...</div>;
  }

  if (item.media_type === 'audio') {
    return (
      <div className="space-y-1">
        <audio
          ref={audioRef}
          onTimeUpdate={event => onAudioTimeChange?.(event.currentTarget.currentTime)}
          onLoadedMetadata={event => onAudioTimeChange?.(event.currentTarget.currentTime)}
          controls
          controlsList="nodownload"
          preload="metadata"
          src={url}
          className="w-full"
          onError={() => setError('音声の再生に失敗しました。期限切れの場合は再取得してください。')}
        />
        <button type="button" className="text-xs text-teal-700 underline"
          onClick={() => setRetry(v => v + 1)}>再生URLを再取得</button>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="投稿画像"
      className={compact ? 'w-full h-52 object-cover rounded-lg' : 'w-full max-h-[650px] object-contain rounded-lg bg-ink-50'}
      onError={() => setError('画像の読み込みに失敗しました。再取得してください。')}
    />
  );
}

export default function PostMediaView({
  postId, media, getToken, compact = false,
  onAudioTimeChange, seekToSeconds, seekVersion,
}: Props) {
  const audio = media.find(m => m.media_type === 'audio');
  const images = media.filter(m => m.media_type === 'image')
    .sort((a, b) => a.display_order - b.display_order);
  const shownImages = compact ? images.slice(0, 1) : images;
  return (
    <div className="space-y-3">
      {shownImages.map(image => (
        <div key={image.id} className="relative">
          <MediaItem postId={postId} item={image} getToken={getToken} compact={compact} />
          {compact && images.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
              画像 {images.length}枚
            </span>
          )}
        </div>
      ))}
      {audio && <MediaItem postId={postId} item={audio} getToken={getToken} compact={compact}
        onAudioTimeChange={onAudioTimeChange} seekToSeconds={seekToSeconds} seekVersion={seekVersion} />}
    </div>
  );
}
