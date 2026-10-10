import { useState, useMemo } from 'react';
import type { ScreenName, Post, Recruitment } from '../types';
import { posts, recruitments } from '../data';
import PostCard from '../components/PostCard';
import RecruitmentCard from '../components/RecruitmentCard';
import { Plus, Users, Music2, MessageCircle } from 'lucide-react';

interface CommunityProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

type FeedItem =
  | { type: 'post'; data: Post }
  | { type: 'recruitment'; data: Recruitment };

type Filter = 'all' | 'posts' | 'recruitments';

export default function Community({ navigate }: CommunityProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...posts.map((p) => ({ type: 'post' as const, data: p })),
      ...recruitments.map((r) => ({ type: 'recruitment' as const, data: r })),
    ];
    return items;
  }, []);

  const filtered = feed.filter((item) => {
    if (filter === 'posts') return item.type === 'post';
    if (filter === 'recruitments') return item.type === 'recruitment';
    return true;
  });

  const postCount = posts.length;
  const recruitmentCount = recruitments.length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6">
      <div className="sticky top-16 z-30 bg-ink-50/90 backdrop-blur-md pt-4 pb-3 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-ink-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink-900">コミュニティ</h1>
            <p className="text-xs text-ink-400 mt-0.5">投稿 {postCount}件 · 募集 {recruitmentCount}件</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              <Plus size={16} /> 作成
            </button>
            {showCreateMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-lg border border-ink-100 py-1.5 w-40 animate-slide-down">
                  <button
                    onClick={() => { navigate('createPost'); setShowCreateMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-teal-50 transition-colors"
                  >
                    <Music2 size={16} className="text-teal-600" /> 演奏を投稿
                  </button>
                  <button
                    onClick={() => { navigate('createRecruitment'); setShowCreateMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-teal-50 transition-colors"
                  >
                    <Users size={16} className="text-teal-600" /> 募集を作成
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'posts', 'recruitments'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 border border-ink-200'
              }`}
            >
              {f === 'all' ? '全て' : f === 'posts' ? '投稿' : '募集'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 py-4">
        {filtered.map((item) =>
          item.type === 'post' ? (
            <PostCard
              key={`post-${item.data.id}`}
              post={item.data}
              onPostClick={() => navigate('postDetail', { id: item.data.id })}
              onUserClick={() => navigate('userProfile', { id: item.data.user.id })}
            />
          ) : (
            <RecruitmentCard
              key={`rec-${item.data.id}`}
              recruitment={item.data}
              onClick={() => navigate('recruitmentDetail', { id: item.data.id })}
              onUserClick={() => navigate('userProfile', { id: item.data.user.id })}
            />
          )
        )}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-ink-400">
            <MessageCircle size={32} className="mx-auto mb-3 opacity-40" />
            <p>該当する投稿がありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
