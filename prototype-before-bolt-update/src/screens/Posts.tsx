import { useState } from 'react';
import type { ScreenName } from '../types';
import { posts } from '../data';
import PostCard from '../components/PostCard';
import { Plus } from 'lucide-react';

interface PostsProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

export default function Posts({ navigate }: PostsProps) {
  const [filter, setFilter] = useState<'all' | 'following'>('all');
  const [composer, setComposer] = useState('all');

  const filtered = posts.filter((p) => {
    if (filter === 'following' && !p.user.isFollowing) return false;
    if (composer !== 'all' && p.piece.composer !== composer) return false;
    return true;
  });

  const composers = [...new Set(posts.map((p) => p.piece.composer))];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6">
      <div className="sticky top-16 z-30 bg-ink-50/90 backdrop-blur-md pt-4 pb-3 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-ink-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-serif text-2xl font-bold text-ink-900">演奏投稿</h1>
          <button
            onClick={() => navigate('createPost')}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            投稿
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}
          >
            みんなの投稿
          </button>
          <button
            onClick={() => setFilter('following')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === 'following' ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}
          >
            フォロー中
          </button>
          <div className="w-px h-6 bg-ink-200 mx-1 flex-shrink-0" />
          <button
            onClick={() => setComposer('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${composer === 'all' ? 'bg-teal-600 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}
          >
            全ての作曲家
          </button>
          {composers.map((c) => (
            <button
              key={c}
              onClick={() => setComposer(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${composer === c ? 'bg-teal-600 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 py-4">
        {filtered.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onPostClick={() => navigate('postDetail', { id: post.id })}
            onUserClick={() => navigate('userProfile', { id: post.user.id })}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-ink-400">
            <p>該当する投稿がありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
