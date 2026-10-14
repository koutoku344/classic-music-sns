import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName, Piece } from '../types';
import { me, posts, recruitments } from '../data';
import { getAllPractices } from '../lib/practiceApi';
import type { PracticeRow } from '../lib/practiceApi';
import { API_BASE, toPiece } from '../lib/repertoireApi';
import type { RepertoireResponse } from '../lib/repertoireApi';
import Avatar from '../components/Avatar';
import { TrophyCard } from '../components/Trophy';
import {
  Heart,
  MessageCircle,
  BookOpen,
  Music2,
  ChevronRight,
  Calendar,
  Clock,
  Crown,
  HardDrive,
  Shield,
} from 'lucide-react';

type ProfileResponse = {
  profile: {
    display_name: string;
    bio: string;
    instruments: string[];
    region: string;
    visibility: string;
  } | null;
};

interface MyPageProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

const statusLabels: Record<string, string> = {
  practicing: '練習中',
  repertoire: 'レパートリー',
  performed: '演奏済',
};

const statusColors: Record<string, string> = {
  practicing: 'bg-gold-100 text-gold-700',
  repertoire: 'bg-teal-100 text-teal-700',
  performed: 'bg-sage-100 text-sage-700',
};

export default function MyPage({ navigate }: MyPageProps) {
  const [filter, setFilter] = useState<'all' | 'posts' | 'recruitments' | 'practice'>('all');
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [profile, setProfile] = useState<{
    display_name: string;
    bio: string;
    instruments: string[];
    region: string;
    visibility: string;
  } | null>(null);
  const [profileError, setProfileError] = useState('');
  const [myRepertoire, setMyRepertoire] = useState<Piece[]>([]);
  const [repertoireError, setRepertoireError] = useState('');
  const [repertoireLoading, setRepertoireLoading] = useState(true);
  const [myPracticeRecords, setMyPracticeRecords] = useState<PracticeRow[]>([]);
  const [practiceError, setPracticeError] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setProfile(null);
      setProfileError('');
      return;
    }

    let active = true;

    (async () => {
      try {
        setProfileError('');
        const token = await getToken();
        if (!token) throw new Error('ログインが必要です');

        const res = await fetch(`${API_BASE}/me/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`取得失敗 HTTP ${res.status}`);

        const data = (await res.json()) as ProfileResponse;
        if (active) setProfile(data.profile);
      } catch (error) {
        if (active) setProfileError(String(error));
      }
    })();

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setMyRepertoire([]);
      setRepertoireError('');
      setRepertoireLoading(!isLoaded);
      return;
    }

    let active = true;

    (async () => {
      setRepertoireLoading(true);
      setRepertoireError('');
      try {
        const token = await getToken();
        if (!token) throw new Error('ログインが必要です');

        const res = await fetch(`${API_BASE}/me/repertoire`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`取得失敗 HTTP ${res.status}`);

        const data = (await res.json()) as RepertoireResponse;
        if (!Array.isArray(data.repertoire)) {
          throw new Error('レパートリーの応答形式が不正です');
        }
        if (active) setMyRepertoire(data.repertoire.map(toPiece));
      } catch (error) {
        if (active) {
          setMyRepertoire([]);
          setRepertoireError(String(error));
        }
      } finally {
        if (active) setRepertoireLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const myPosts = posts.filter((p) => p.user.id === 'me');
  if (myPosts.length === 0) {
    myPosts.push(posts[0], posts[2]);
  }

  const myRecruitments = recruitments.filter((r) => r.user.id === 'me');
  if (myRecruitments.length === 0) {
    myRecruitments.push(recruitments[0], recruitments[2]);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setMyPracticeRecords([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const rows = await getAllPractices(getToken);
        if (active) setMyPracticeRecords(rows);
      } catch (e) {
        if (active) setPracticeError(e instanceof Error ? e.message : '練習記録の取得に失敗しました。');
      }
    })();
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken]);
  const showPosts = filter === 'all' || filter === 'posts';
  const showRecruitments = filter === 'all' || filter === 'recruitments';
  const showPractice = filter === 'all' || filter === 'practice';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="bg-white rounded-2xl border border-ink-100 p-6 mb-5 animate-slide-up">
        <div className="flex items-start gap-4 mb-4">
          <Avatar user={me} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-bold text-ink-900">
              {profile?.display_name || 'プロフィール未設定'}
            </h1>
            <p className="text-sm text-ink-400 mt-1">
              {[
                ...(profile?.instruments || []),
                ...(profile?.region && profile.region !== '非公開' ? [profile.region] : []),
              ].join(' · ')}
            </p>
          </div>
        </div>

        <p className="text-sm text-ink-700 leading-relaxed mb-4">{profile?.bio || ''}</p>
        {profileError && (
          <p role="alert" className="text-xs text-red-600">{profileError}</p>
        )}

        <div className="flex items-center gap-6 mb-4 text-sm">
          <div>
            <span className="font-bold text-ink-900">{me.following}</span>{' '}
            <span className="text-ink-400">フォロー中</span>
          </div>
          <div>
            <span className="font-bold text-ink-900">{me.followers}</span>{' '}
            <span className="text-ink-400">フォロワー</span>
          </div>
        </div>
      </div>

      {/* Trophies */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {me.trophies.map((t) => (
          <TrophyCard key={t.type} trophy={t} />
        ))}
      </div>

      {/* Premium banner */}
      <button
        onClick={() => navigate('subscription')}
        className="w-full bg-gradient-to-r from-gold-50 to-amber-50 border border-gold-200 rounded-2xl p-4 mb-5 flex items-center gap-3 hover:shadow-sm transition-shadow text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center flex-shrink-0">
          <Crown size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gold-800">Premiumプラン</p>
          <p className="text-xs text-gold-600 mt-0.5">20GB・長期保存でさらに練習を蓄積</p>
        </div>
        <ChevronRight size={18} className="text-gold-400 flex-shrink-0" />
      </button>

      {/* Storage info */}
      <div className="bg-white rounded-2xl border border-ink-100 p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive size={16} className="text-ink-400" />
          <p className="text-sm font-medium text-ink-700">ストレージ</p>
          <span className="text-xs text-ink-400 ml-auto">Free プラン</span>
        </div>
        <div className="h-2 bg-ink-100 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-teal-500 rounded-full" style={{ width: '35%' }} />
        </div>
        <div className="flex items-center justify-between text-xs text-ink-400">
          <span>1.05 GB / 3 GB</span>
          <span className="flex items-center gap-1">
            <Shield size={12} /> 音声は12か月保存
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base font-semibold text-ink-900 flex items-center gap-2">
            <BookOpen size={18} className="text-teal-600" /> レパートリー
          </h2>
          <button
            onClick={() => navigate('repertoire')}
            className="flex items-center gap-0.5 text-xs text-teal-700 font-medium hover:text-teal-800"
          >
            管理する <ChevronRight size={14} />
          </button>
        </div>
        {repertoireLoading && (
          <p role="status" className="text-sm text-ink-400 mb-2">レパートリーを読み込み中...</p>
        )}
        {repertoireError && (
          <p role="alert" className="text-sm text-red-600 mb-2">{repertoireError}</p>
        )}
        {!repertoireLoading && !repertoireError && myRepertoire.length === 0 && (
          <p className="text-sm text-ink-400">登録されたレパートリーはありません</p>
        )}
        <div className="flex flex-wrap gap-2">
          {myRepertoire.map((p) => (
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

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox
          icon={Heart}
          value={myPosts.reduce((s, p) => s + p.likes, 0)}
          label="総Likes"
          color="text-burgundy-500"
        />
        <StatBox
          icon={MessageCircle}
          value={myPosts.reduce((s, p) => s + p.comments.length + p.timestampComments.length, 0)}
          label="総Comments"
          color="text-teal-600"
        />
        <StatBox
          icon={Music2}
          value={myRepertoire.length}
          label="レパートリー"
          color="text-sage-600"
        />
      </div>

      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-ink-100 p-1">
        {([
          { key: 'all', label: '全て' },
          { key: 'posts', label: '投稿' },
          { key: 'practice', label: '練習' },
          { key: 'recruitments', label: '募集' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === t.key ? 'bg-teal-600 text-white' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {showPosts && myPosts.map((p) => (
          <button
            key={`post-${p.id}`}
            onClick={() => navigate('postDetail', { id: p.id })}
            className="bg-white rounded-xl border border-ink-100 overflow-hidden hover:shadow-md transition-shadow text-left animate-slide-up"
          >
            {p.imageUrl ? (
              <img src={p.imageUrl} alt="" className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-teal-50 to-ink-50 flex items-center justify-center">
                <Music2 size={32} className="text-teal-300" />
              </div>
            )}
            <div className="p-3">
              <p className="text-xs font-serif text-ink-800 truncate">
                <span className="italic text-ink-500">{p.piece.composer}</span> / {p.piece.title}
              </p>
              <p className="text-xs text-ink-400 truncate mt-1">{p.body}</p>
              <div className="flex items-center gap-3 mt-2 text-ink-400">
                <span className="flex items-center gap-1 text-xs">
                  <Heart size={12} /> {p.likes}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <MessageCircle size={12} /> {p.comments.length + p.timestampComments.length}
                </span>
              </div>
            </div>
          </button>
        ))}

        {showRecruitments && myRecruitments.map((r) => (
          <button
            key={`rec-${r.id}`}
            onClick={() => navigate('recruitmentDetail', { id: r.id })}
            className="bg-white rounded-xl border border-ink-100 p-3 hover:shadow-md transition-shadow text-left animate-slide-up"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                r.status === 'open' ? 'bg-sage-100 text-sage-700' : 'bg-ink-100 text-ink-500'
              }`}>
                {r.status === 'open' ? '募集中' : '終了'}
              </span>
            </div>
            <p className="text-xs font-serif text-ink-800 truncate">
              <span className="italic text-ink-500">{r.piece.composer}</span> / {r.piece.title}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-[10px] text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">
                {r.instrument}
              </span>
              <span className="text-[10px] text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">
                {r.region}
              </span>
            </div>
            <p className="text-xs text-ink-400 mt-2">応募 {r.applicants}件</p>
          </button>
        ))}
      </div>

      {showPractice && (
        <div className="space-y-3 mt-3">
          <h2 className="text-sm font-medium text-ink-700">練習記録</h2>
          {practiceError && <p role="alert" className="text-sm text-red-600">{practiceError}</p>}
          {!practiceError && myPracticeRecords.length === 0 &&
            <p className="text-sm text-ink-500">練習記録はまだありません。</p>}
          {myPracticeRecords.map(record => (
            <button
              key={record.id}
              onClick={() => navigate('practiceDetail', { id: record.id })}
              className="w-full p-4 text-left bg-white rounded-xl border border-ink-100 hover:border-teal-300"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex gap-1.5 items-center text-ink-800"><Calendar size={14} /> {record.practice_date}</span>
                <span className="flex gap-1 items-center text-teal-700"><Clock size={12} /> {record.duration_minutes}分</span>
              </div>
              <p className="text-sm mt-2 text-ink-800">
                <span className="italic text-ink-500">{record.composer_name}</span> / {record.piece_title}
              </p>
              {record.comment && <p className="text-xs text-ink-500 mt-1">{record.comment}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Heart;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-4 text-center">
      <Icon size={20} className={`mx-auto mb-1.5 ${color}`} />
      <p className="text-xl font-bold text-ink-900">{value}</p>
      <p className="text-xs text-ink-400">{label}</p>
    </div>
  );
}
