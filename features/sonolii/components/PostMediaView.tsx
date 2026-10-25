import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, ChevronLeft, ChevronRight } from 'lucide-react';
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
  onTimestampComment?: (seconds: number) => void;
};

function MediaItem({
  postId, item, getToken, compact, onAudioTimeChange, seekToSeconds, seekVersion,
  onTimestampComment,
}: {
  postId: string;
  item: PostMedia;
  getToken: TokenGetter;
  compact: boolean;
  onAudioTimeChange?: (seconds: number | null) => void;
  seekToSeconds?: number | null;
  seekVersion?: number;
  onTimestampComment?: (seconds: number) => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioReady, setAudioReady] = useState(false);

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
    setAudioReady(false);
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
          onLoadedMetadata={event => {
            setAudioReady(true);
            onAudioTimeChange?.(event.currentTarget.currentTime);
          }}
          controls
          controlsList="nodownload"
          preload="metadata"
          src={url}
          className="w-full"
          onError={() => setError('音声の再生に失敗しました。期限切れの場合は再取得してください。')}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="text-xs text-teal-700 underline"
            onClick={() => setRetry(v => v + 1)}>再生URLを再取得</button>
          {onTimestampComment && (
            <button type="button"
              disabled={!audioReady}
              onClick={() => {
                const audio = audioRef.current;
                if (!audio || !Number.isFinite(audio.currentTime)) return;
                // Stored durations use whole seconds; stay within the Backend's range.
                const duration = item.duration_seconds;
                const seconds = Math.max(
                  0,
                  duration !== null && duration > 0
                    ? Math.min(Math.floor(audio.currentTime), duration - 1)
                    : Math.floor(audio.currentTime),
                );
                onTimestampComment(seconds);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 text-sm font-medium hover:bg-teal-100 disabled:opacity-40">
              <MessageSquarePlus size={16} />
              この位置にコメント
            </button>
          )}
        </div>
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
  onAudioTimeChange, seekToSeconds, seekVersion, onTimestampComment,
}: Props) {
  const audio = media.find(m => m.media_type === 'audio');
  const images = media.filter(m => m.media_type === 'image')
    .sort((a, b) => a.display_order - b.display_order);
  const [activeImage,setActiveImage]=useState(0);
  const imageIndex=Math.min(activeImage,Math.max(0,images.length-1));
  const touchStart=useRef<number|null>(null);
  function move(delta:number){
    setActiveImage(index=>Math.max(0,Math.min(images.length-1,index+delta)));
  }
  return (
    <div className="space-y-3">
      {images.length>0&&<div className="relative" onTouchStart={e=>{touchStart.current=e.touches[0]?.clientX??null;}}
        onTouchEnd={e=>{
          if(touchStart.current===null)return;
          const diff=e.changedTouches[0].clientX-touchStart.current;
          if(Math.abs(diff)>45)move(diff<0?1:-1);
          touchStart.current=null;
        }}>
        <MediaItem key={images[imageIndex].id} postId={postId} item={images[imageIndex]} getToken={getToken} compact={compact}/>
        {images.length>1&&<>
          <button type="button" aria-label="前の画像" disabled={imageIndex===0}
            onClick={e=>{e.stopPropagation();move(-1);}}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow disabled:opacity-30">
            <ChevronLeft size={20}/>
          </button>
          <button type="button" aria-label="次の画像" disabled={imageIndex===images.length-1}
            onClick={e=>{e.stopPropagation();move(1);}}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow disabled:opacity-30">
            <ChevronRight size={20}/>
          </button>
          <span className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {imageIndex+1} / {images.length}
          </span>
        </>}
      </div>}
      {audio && <MediaItem postId={postId} item={audio} getToken={getToken} compact={compact}
        onAudioTimeChange={onAudioTimeChange} seekToSeconds={seekToSeconds} seekVersion={seekVersion}
        onTimestampComment={onTimestampComment} />}
    </div>
  );
}
