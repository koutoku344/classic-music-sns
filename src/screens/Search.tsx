import { useState } from 'react';
import type { ScreenName } from '../types';
import { users, posts, recruitments } from '../data';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import RecruitmentCard from '../components/RecruitmentCard';
import { Search as SearchIcon, Music2, MapPin, X } from 'lucide-react';

interface SearchProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

export default function Search({ navigate }: SearchProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'users' | 'posts' | 'recruitments'>('users');

  const q = query.toLowerCase();
  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(q) || u.instrument.toLowerCase().includes(q) || u.region.toLowerCase().includes(q));
  const filteredPosts = posts.filter((p) => p.piece.composer.toLowerCase().includes(q) || p.piece.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q));
  const filteredRecruits = recruitments.filter((r) => r.piece.composer.toLowerCase().includes(q) || r.piece.title.toLowerCase().includes(q) || r.instrument.toLowerCase().includes(q) || r.region.toLowerCase().includes(q));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-5">検索</h1>

      <div className="relative mb-5">
        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ユーザー、曲、投稿を検索..."
          className="w-full pl-12 pr-12 py-3.5 bg-white border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-ink-100 p-1">
        {(['users', 'posts', 'recruitments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-teal-600 text-white' : 'text-ink-600 hover:bg-ink-50'}`}
          >
            {t === 'users' ? 'ユーザー' : t === 'posts' ? '投稿' : '募集'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tab === 'users' && filteredUsers.map((u) => (
          <div key={u.id} className="bg-white rounded-xl border border-ink-100 p-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer animate-slide-up" onClick={() => navigate('userProfile', { id: u.id })}>
            <Avatar user={u} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ink-900 text-sm">{u.name}</p>
              <div className="flex items-center gap-3 text-xs text-ink-400 mt-0.5">
                <span className="flex items-center gap-1"><Music2 size={12} /> {u.instrument}</span>
                <span className="flex items-center gap-1"><MapPin size={12} /> {u.region}</span>
              </div>
            </div>
            <span className="text-xs text-ink-400">{u.followers} フォロワー</span>
          </div>
        ))}

        {tab === 'posts' && filteredPosts.map((p) => (
          <PostCard key={p.id} post={p} onPostClick={() => navigate('postDetail', { id: p.id })} onUserClick={() => navigate('userProfile', { id: p.user.id })} />
        ))}

        {tab === 'recruitments' && filteredRecruits.map((r) => (
          <RecruitmentCard key={r.id} recruitment={r} onClick={() => navigate('recruitmentDetail', { id: r.id })} onUserClick={() => navigate('userProfile', { id: r.user.id })} />
        ))}

        {((tab === 'users' && filteredUsers.length === 0) || (tab === 'posts' && filteredPosts.length === 0) || (tab === 'recruitments' && filteredRecruits.length === 0)) && (
          <div className="text-center py-20 text-ink-400">
            <p>該当する結果がありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
