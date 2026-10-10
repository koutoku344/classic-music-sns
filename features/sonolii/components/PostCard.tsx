import { useState } from 'react';
import { Heart, MessageCircle, MessageSquarePlus, Music2, X, Send } from 'lucide-react';
import type { Post, TimestampComment } from '../types';
import { users } from '../data';
import Avatar from './Avatar';
import { getTopTrophy, TrophyBadge } from './Trophy';

interface PostCardProps {
  post: Post;
  onPostClick?: () => void;
  onUserClick?: () => void;
}

function timeToSeconds(t: string): number {
  const parts = t.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + (parts[1] || 0);
}

function secondsToTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PostCard({ post, onPostClick, onUserClick }: PostCardProps) {
  const hasAudio = !!(post.audioTitle && post.audioDuration);
  const topTrophy = getTopTrophy(post.user.trophies);
  const totalSec = hasAudio && post.audioDuration ? timeToSeconds(post.audioDuration) : 0;

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [showTsComment, setShowTsComment] = useState(false);
  const [tsText, setTsText] = useState('');
  const [tsComments, setTsComments] = useState<TimestampComment[]>(post.timestampComments);

  const pct = totalSec > 0 ? (current / totalSec) * 100 : 0;
  const currentTimeStr = secondsToTime(current);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasAudio) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrent(ratio * totalSec);
    setPlaying(true);
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasAudio) return;
    if (!playing && current === 0) {
      setCurrent(0);
    }
    setPlaying(!playing);
  };

  const handleTsClick = (e: React.MouseEvent, timestamp: string) => {
    e.stopPropagation();
    const sec = timeToSeconds(timestamp);
    setCurrent(sec);
    setPlaying(true);
  };

  const submitTsComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tsText.trim()) return;
    setTsComments([...tsComments, { id: `tc${Date.now()}`, user: users[4], timestamp: currentTimeStr, text: tsText, likes: 0, liked: false, replies: [] }]);
    setTsText('');
    setShowTsComment(false);
  };

  return (
    <article
      onClick={onPostClick}
      className="bg-white rounded-2xl border border-ink-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer animate-slide-up"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3">
          <Avatar user={post.user} size="md" onClick={onUserClick} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-ink-900 text-sm truncate hover:text-teal-700 transition-colors" onClick={(e) => { e.stopPropagation(); onUserClick?.(); }}>
                {post.user.name}
              </p>
              {topTrophy && (
                <span onClick={(e) => e.stopPropagation()}>
                  <TrophyBadge trophy={topTrophy} size="xs" />
                </span>
              )}
            </div>
            <p className="text-xs text-ink-400">{post.createdAt}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasAudio && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded-md text-xs font-medium" title="音声付き投稿">
                <Music2 size={12} /> ♪
              </span>
            )}
            {post.feedbackPrefs.length > 0 && (
              <div className="hidden sm:flex gap-1.5">
                {post.feedbackPrefs.map((p) => (
                  <span key={p} className="px-2 py-0.5 text-[10px] font-medium bg-gold-50 text-gold-700 rounded-full border border-gold-200">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {hasAudio && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <Music2 size={14} className="text-teal-600 flex-shrink-0" />
            <span className="font-serif text-base text-ink-800">
              <span className="italic text-ink-600">{post.piece.composer}</span> / {post.piece.title}
            </span>
          </div>
        )}

        {post.body && (
          <p className="text-sm text-ink-700 leading-relaxed mb-4 whitespace-pre-line">{post.body}</p>
        )}

        {post.imageUrl && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <img src={post.imageUrl} alt="" className="w-full h-48 sm:h-56 object-cover" />
          </div>
        )}

        {/* Inline audio player - play directly from feed */}
        {hasAudio && (
          <div className="bg-ink-100 rounded-xl p-3 border border-ink-200 mb-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayPause}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 active:scale-95 transition-all shadow-sm"
              >
                {playing ? <span className="text-lg leading-none">⏸</span> : <span className="text-lg leading-none ml-0.5">▶</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-800 truncate mb-1.5">{post.audioTitle}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-ink-500 tabular-nums w-9 text-right">{currentTimeStr}</span>
                  <div className="flex-1 relative cursor-pointer group" onClick={handleSeek}>
                    <div className="h-2 bg-ink-200 rounded-full" />
                    <div className="absolute top-0 left-0 h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                    {tsComments.map((tc) => {
                      const tcPct = totalSec > 0 ? (timeToSeconds(tc.timestamp) / totalSec) * 100 : 0;
                      return (
                        <div
                          key={tc.id}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-gold-400 rounded-full ring-2 ring-white cursor-pointer hover:scale-125 transition-transform z-10"
                          style={{ left: `${tcPct}%` }}
                          title={`${tc.timestamp} - ${tc.text}`}
                          onClick={(e) => handleTsClick(e, tc.timestamp)}
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono text-ink-500 tabular-nums w-9">{post.audioDuration}</span>
                </div>
              </div>
            </div>
            {/* Timestamp comment button */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowTsComment(!showTsComment); }}
              className="mt-2.5 flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 font-medium transition-colors"
            >
              <MessageSquarePlus size={14} />
              {currentTimeStr} にコメント
            </button>
            {showTsComment && (
              <div className="mt-2 bg-white rounded-lg p-2.5 border border-teal-200">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-teal-800">{currentTimeStr} のコメント</p>
                  <button onClick={(e) => { e.stopPropagation(); setShowTsComment(false); }} className="text-ink-400 hover:text-ink-600">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={tsText}
                    onChange={(e) => setTsText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="コメントを入力"
                    className="flex-1 px-2.5 py-2 bg-ink-50 border border-ink-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <button
                    onClick={submitTsComment}
                    className="w-8 h-8 flex-shrink-0 bg-teal-600 text-white rounded-lg flex items-center justify-center hover:bg-teal-700"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-5 mt-4 text-ink-500">
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-burgundy-500 transition-colors text-sm group"
          >
            <Heart size={18} className={post.liked ? 'fill-burgundy-500 text-burgundy-500' : ''} />
            <span className={post.liked ? 'text-burgundy-500 font-medium' : ''}>{post.likes}</span>
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-teal-600 transition-colors text-sm"
          >
            <MessageCircle size={18} />
            <span>{post.comments.length + tsComments.length}</span>
          </button>
          {!post.commentsEnabled && (
            <span className="text-xs text-ink-400 ml-auto">コメント受付停止中</span>
          )}
        </div>
      </div>
    </article>
  );
}
