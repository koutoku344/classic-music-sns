import { useState } from 'react';
import type { ScreenName, Piece } from '../types';
import { users, posts, recruitments, pieces, recentPieceIds } from '../data';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import RecruitmentCard from '../components/RecruitmentCard';
import PiecePicker from '../components/PiecePicker';
import { Search as SearchIcon, Music2, MapPin, X } from 'lucide-react';

interface SearchProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

const recentPieces = pieces.filter((p) => recentPieceIds.includes(p.id));

type Tab = 'users' | 'posts' | 'recruitments';

export default function Search({ navigate }: SearchProps) {
  const [tab, setTab] = useState<Tab>('users');
  const [userQuery, setUserQuery] = useState('');
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

  const [rInstrument, setRInstrument] = useState('all');
  const [rRegion, setRRegion] = useState('all');
  const [rPurpose, setRPurpose] = useState('all');
  const [rLevel, setRLevel] = useState('all');

  const uq = userQuery.toLowerCase();
  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(uq) || u.instrument.toLowerCase().includes(uq) || u.region.toLowerCase().includes(uq)
  );

  const filteredPosts = posts.filter((p) => {
    if (selectedPiece) return p.piece.id === selectedPiece.id;
    return true;
  });

  const filteredRecruitments = recruitments.filter((r) => {
    if (rInstrument !== 'all' && r.instrument !== rInstrument) return false;
    if (rRegion !== 'all' && r.region !== rRegion) return false;
    if (rPurpose !== 'all' && r.purpose !== rPurpose) return false;
    if (rLevel !== 'all' && r.level !== rLevel) return false;
    return true;
  });

  const selectCls = "w-full px-2 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-5">検索</h1>

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

      {tab === 'users' && (
        <>
          <div className="relative mb-5">
            <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="ユーザー名、楽器、地域で検索..."
              className="w-full pl-12 pr-12 py-3.5 bg-white border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {userQuery && (
              <button onClick={() => setUserQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {filteredUsers.map((u) => (
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
            {filteredUsers.length === 0 && (
              <div className="text-center py-20 text-ink-400">
                <p>該当する結果がありません</p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'posts' && (
        <>
          <div className="bg-white rounded-2xl border border-ink-100 p-5 mb-5">
            <PiecePicker
              pieces={pieces}
              selectedPiece={selectedPiece}
              onSelect={setSelectedPiece}
              label="曲で絞り込む（任意）"
              allowFreeInput={false}
              recentPieces={recentPieces}
            />
          </div>

          <div className="space-y-4">
            {filteredPosts.map((p) => (
              <PostCard key={p.id} post={p} onPostClick={() => navigate('postDetail', { id: p.id })} onUserClick={() => navigate('userProfile', { id: p.user.id })} />
            ))}
            {filteredPosts.length === 0 && (
              <div className="text-center py-20 text-ink-400">
                <p>該当する結果がありません</p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'recruitments' && (
        <>
          <div className="bg-white rounded-2xl border border-ink-100 p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">楽器</label>
              <select value={rInstrument} onChange={(e) => setRInstrument(e.target.value)} className={selectCls}>
                <option value="all">全て</option>
                <option>Piano</option><option>Violin</option><option>Cello</option><option>Flute</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">地域</label>
              <select value={rRegion} onChange={(e) => setRRegion(e.target.value)} className={selectCls}>
                <option value="all">全て</option>
                <option>東京</option><option>大阪</option><option>神奈川</option><option>京都</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">レベル</label>
              <select value={rLevel} onChange={(e) => setRLevel(e.target.value)} className={selectCls}>
                <option value="all">全て</option>
                <option>初級</option><option>中級</option><option>上級</option><option>問わない</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">目的</label>
              <select value={rPurpose} onChange={(e) => setRPurpose(e.target.value)} className={selectCls}>
                <option value="all">全て</option>
                <option>アンサンブル</option><option>発表会</option><option>趣味で合わせ</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredRecruitments.map((r) => (
              <RecruitmentCard
                key={r.id}
                recruitment={r}
                onClick={() => navigate('recruitmentDetail', { id: r.id })}
                onUserClick={() => navigate('userProfile', { id: r.user.id })}
              />
            ))}
            {filteredRecruitments.length === 0 && (
              <div className="text-center py-20 text-ink-400">
                <p>該当する結果がありません</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
