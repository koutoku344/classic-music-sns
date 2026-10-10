import { useState } from 'react';
import type { ScreenName } from '../types';
import { users, posts, recruitments, pieces } from '../data';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import RecruitmentCard from '../components/RecruitmentCard';
import { TrophyCard } from '../components/Trophy';
import { ArrowLeft, MapPin, Music2, Calendar, Heart, MessageCircle, UserPlus, UserCheck, BookOpen } from 'lucide-react';

interface UserProfileProps {
  userId: string;
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

export default function UserProfile({ userId, navigate }: UserProfileProps) {
  const user = users.find((u) => u.id === userId) || users[0];
  const [following, setFollowing] = useState(user.isFollowing);
  const [filter, setFilter] = useState<'posts' | 'recruitments'>('posts');
  const userPosts = posts.filter((p) => p.user.id === user.id);
  const userRecruitments = recruitments.filter((r) => r.user.id === user.id);
  const userRepertoire = pieces;

  const stats = [
    { icon: Heart, label: 'Likes', value: userPosts.reduce((s, p) => s + p.likes, 0) },
    { icon: MessageCircle, label: 'Comments', value: userPosts.reduce((s, p) => s + p.comments.length + p.timestampComments.length, 0) },
  ];

  const statusLabels: Record<string, string> = { practicing: '練習中', repertoire: 'レパートリー', performed: '演奏済' };
  const statusColors: Record<string, string> = {
    practicing: 'bg-gold-100 text-gold-700',
    repertoire: 'bg-teal-100 text-teal-700',
    performed: 'bg-sage-100 text-sage-700',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('community')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>

      <div className="bg-white rounded-2xl border border-ink-100 p-6 mb-5 animate-slide-up">
        <div className="flex items-start gap-4 mb-4">
          <Avatar user={user} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-bold text-ink-900">{user.name}</h1>
            <div className="flex items-center gap-3 text-sm text-ink-400 mt-1">
              <span className="flex items-center gap-1"><Music2 size={14} /> {user.instrument}</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> {user.region}</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-ink-700 leading-relaxed mb-4">{user.bio}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {user.feedbackPrefs.map((p) => (
            <span key={p} className="px-2.5 py-1 text-xs font-medium bg-gold-50 text-gold-700 rounded-full border border-gold-200">{p}</span>
          ))}
        </div>

        <div className="flex items-center gap-6 mb-4 text-sm">
          <div><span className="font-bold text-ink-900">{user.following}</span> <span className="text-ink-400">フォロー中</span></div>
          <div><span className="font-bold text-ink-900">{user.followers}</span> <span className="text-ink-400">フォロワー</span></div>
          {stats.map((s) => (
            <div key={s.label}><span className="font-bold text-ink-900">{s.value}</span> <span className="text-ink-400">{s.label}</span></div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFollowing(!following)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              following ? 'bg-ink-100 text-ink-700 hover:bg-ink-200' : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {following ? <><UserCheck size={16} /> フォロー中</> : <><UserPlus size={16} /> フォローする</>}
          </button>
          <button
            onClick={() => navigate('conversation', { id: 'conv1' })}
            className="px-4 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-xl text-sm font-medium hover:bg-ink-50 transition-colors"
          >
            メッセージ
          </button>
        </div>
      </div>

      {/* Trophies */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {user.trophies.map((t) => (
          <TrophyCard key={t.type} trophy={t} />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 mb-5">
        <h2 className="font-serif text-base font-semibold text-ink-900 flex items-center gap-2 mb-3">
          <BookOpen size={18} className="text-teal-600" /> レパートリー
        </h2>
        <div className="flex flex-wrap gap-2">
          {userRepertoire.map((p) => (
            <span
              key={p.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusColors[p.status]}`}
            >
              {p.composer} / {p.title}
              <span className="ml-1.5 opacity-70">· {statusLabels[p.status]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-ink-100 p-1">
        <button
          onClick={() => setFilter('posts')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'posts' ? 'bg-teal-600 text-white' : 'text-ink-600 hover:bg-ink-50'}`}
        >
          投稿
        </button>
        <button
          onClick={() => setFilter('recruitments')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'recruitments' ? 'bg-teal-600 text-white' : 'text-ink-600 hover:bg-ink-50'}`}
        >
          募集
        </button>
      </div>

      {filter === 'posts' && (
        <>
          <h2 className="font-serif text-lg font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-teal-600" /> 最近の投稿
          </h2>
          <div className="space-y-4">
            {userPosts.length > 0 ? userPosts.map((p) => (
              <PostCard key={p.id} post={p} onPostClick={() => navigate('postDetail', { id: p.id })} onUserClick={() => navigate('userProfile', { id: p.user.id })} />
            )) : (
              <p className="text-center py-12 text-ink-400 text-sm">まだ投稿がありません</p>
            )}
          </div>
        </>
      )}

      {filter === 'recruitments' && (
        <div className="space-y-4">
          {userRecruitments.length > 0 ? userRecruitments.map((r) => (
            <RecruitmentCard key={r.id} recruitment={r} onClick={() => navigate('recruitmentDetail', { id: r.id })} onUserClick={() => navigate('userProfile', { id: r.user.id })} />
          )) : (
            <p className="text-center py-12 text-ink-400 text-sm">まだ募集がありません</p>
          )}
        </div>
      )}
    </div>
  );
}
