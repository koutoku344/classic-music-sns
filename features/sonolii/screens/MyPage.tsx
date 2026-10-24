import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName, Piece } from '../types';
import { listRecruitments, type RecruitmentRow } from '../lib/recruitmentApi';
import { listUserPosts, type PostRow } from '../lib/postApi';
import PostSummary from '../components/PostSummary';
import { getAllPractices } from '../lib/practiceApi';
import { getMediaUsage, formatMediaBytes } from '../lib/mediaApi';
import type { MediaUsage } from '../lib/mediaApi';
import type { PracticeRow } from '../lib/practiceApi';
import { API_BASE, toPiece } from '../lib/repertoireApi';
import type { RepertoireResponse } from '../lib/repertoireApi';
import {
  Heart,
  MessageCircle,
  BookOpen,
  Music2,
  ChevronRight,
  Calendar,
  Clock,
  HardDrive,
  UserRound,
} from 'lucide-react';

type ProfileResponse = {
  profile: {
    user_id: string;
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
    user_id: string;
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
  const [mediaUsage, setMediaUsage] = useState<MediaUsage | null>(null);
  const [mediaUsageError, setMediaUsageError] = useState('');
  const [myRecruitments,setMyRecruitments]=useState<RecruitmentRow[]>([]);
  const [recruitmentsLoading,setRecruitmentsLoading]=useState(false);
  const [recruitmentsError,setRecruitmentsError]=useState('');

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

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setMediaUsage(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const value = await getMediaUsage(getToken);
        if (active) { setMediaUsage(value); setMediaUsageError(''); }
      } catch {
        if (active) setMediaUsageError('容量を取得できませんでした。');
      }
    })();
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken]);

  const [myPosts, setMyPosts] = useState<PostRow[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsMoreBusy, setPostsMoreBusy] = useState(false);
  const [postsError, setPostsError] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !profile?.user_id) {
      setMyPosts([]);
      setPostsCursor(null);
      setPostsLoading(false);
      return;
    }
    let active = true;
    setPostsLoading(true);
    setPostsError('');
    void listUserPosts(profile.user_id, getToken)
      .then(page => {
        if (active) { setMyPosts(page.posts); setPostsCursor(page.nextCursor); }
      })
      .catch(e => { if (active) setPostsError(e instanceof Error ? e.message : '投稿を取得できませんでした。'); })
      .finally(() => { if (active) setPostsLoading(false); });
    return () => { active = false; };
  }, [isLoaded, isSignedIn, profile?.user_id, getToken]);

  async function loadMorePosts() {
    if (!postsCursor || !profile?.user_id || postsMoreBusy) return;
    setPostsMoreBusy(true);
    try {
      const page = await listUserPosts(profile.user_id, getToken, postsCursor);
      setMyPosts(current => [...current, ...page.posts.filter(
        p => !current.some(existing => existing.id === p.id)
      )]);
      setPostsCursor(page.nextCursor);
    } catch (e) {
      setPostsError(e instanceof Error ? e.message : '追加取得に失敗しました。');
    } finally {
      setPostsMoreBusy(false);
    }
  }

  useEffect(()=>{
    if(!isLoaded||!isSignedIn||!profile?.user_id){
      setMyRecruitments([]);setRecruitmentsLoading(false);setRecruitmentsError('');
      return;
    }
    let active=true;
    setRecruitmentsLoading(true);setRecruitmentsError('');setMyRecruitments([]);
    (async()=>{
      try{
        // Recruitment listing is paginated; collect up to five pages of public
        // listings and filter by the authenticated profile's user id.
        let cursor:string|null=null;
        const mine:RecruitmentRow[]=[];
        for(let page=0;page<5;page++){
          const result=await listRecruitments(getToken,{cursor});
          mine.push(...result.recruitments.filter(r=>r.user_id===profile.user_id));
          cursor=result.nextCursor;
          if(!cursor)break;
        }
        if(active)setMyRecruitments(mine);
      }catch(e){
        if(active)setRecruitmentsError(e instanceof Error?e.message:'募集を取得できませんでした。');
      }finally{if(active)setRecruitmentsLoading(false);}
    })();
    return()=>{active=false;};
  },[isLoaded,isSignedIn,profile?.user_id,getToken]);

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
          <div className="w-20 h-20 rounded-full bg-ink-100 text-ink-400 flex items-center justify-center flex-shrink-0" aria-label="プロフィール画像未設定"><UserRound size={36}/></div>
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

      </div>

      {/* Storage usage from authenticated Backend API */}
      <button
        type="button"
        onClick={() => navigate('mediaManager')}
        className="block text-left w-full bg-white rounded-2xl border border-ink-100 p-4 mb-5 hover:border-teal-300"
      >
        <div className="flex items-center gap-2 mb-3">
          <HardDrive size={16} className="text-ink-400" />
          <p className="text-sm font-medium text-ink-700">ストレージ</p>
          <span className="text-xs text-ink-400 ml-auto">Free プラン</span>
          <ChevronRight size={16} className="text-ink-400" />
        </div>
        {mediaUsage ? (
          <>
            <div className="h-2 bg-ink-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-teal-500 rounded-full"
                style={{ width: `${Math.min(100, 100 * (
                  mediaUsage.active_bytes + mediaUsage.deleted_bytes + mediaUsage.pending_bytes
                ) / mediaUsage.limit_bytes)}%` }} />
            </div>
            <p className="text-xs text-ink-500">
              {formatMediaBytes(
                mediaUsage.active_bytes + mediaUsage.deleted_bytes + mediaUsage.pending_bytes
              )} / {formatMediaBytes(mediaUsage.limit_bytes)}
            </p>
            <p className="text-xs text-ink-400 mt-1">
              ゴミ箱・アップロード予約も使用量に含まれます。管理するにはこちらを選択
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-500">
            {mediaUsageError || (isSignedIn ? '使用量を取得しています...' : 'ログイン後に使用量を確認できます')}
          </p>
        )}
      </button>

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

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatBox icon={Music2} value={myPosts.length} label="取得済み投稿数" color="text-teal-600" />
        <StatBox icon={BookOpen} value={myRepertoire.length} label="レパートリー" color="text-sage-600" />
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
        {showPosts && postsLoading && <p className="text-sm text-ink-500 col-span-2">投稿を読み込み中...</p>}
        {showPosts && postsError && <p role="alert" className="text-sm text-red-600 col-span-2">{postsError}</p>}
        {showPosts && !postsLoading && myPosts.length === 0 && !postsError && (
          <p className="text-sm text-ink-500 col-span-2">まだ投稿がありません。</p>
        )}
        {showPosts && myPosts.map(post => (
          <div key={post.id} className="col-span-2">
            <PostSummary post={post} getToken={getToken}
              onOpen={() => navigate('postDetail', { id: post.id, from: 'my-page' })}
              onOpenTimestamp={seconds => navigate('postDetail', { id: post.id, from: 'my-page', commentAt: String(seconds) })} />
          </div>
        ))}
        {showPosts && postsCursor && (
          <button type="button" onClick={() => void loadMorePosts()} disabled={postsMoreBusy}
            className="col-span-2 rounded-lg border border-ink-200 text-teal-700 py-3 text-sm disabled:opacity-50">
            {postsMoreBusy ? '読み込み中...' : 'さらに投稿を表示'}
          </button>
        )}

        {showRecruitments && recruitmentsLoading && <p className="text-sm text-ink-500 col-span-2">募集を読み込み中...</p>}
        {showRecruitments && recruitmentsError && <p role="alert" className="text-sm text-red-600 col-span-2">{recruitmentsError}</p>}
        {showRecruitments && !recruitmentsLoading && !recruitmentsError && myRecruitments.length===0 &&
          <p className="text-sm text-ink-500 col-span-2">自分が作成した募集はありません。</p>}
        {showRecruitments && myRecruitments.map(r=><button key={r.id}
          onClick={()=>navigate('recruitmentDetail',{id:r.id})}
          className="col-span-2 bg-white rounded-xl border border-ink-100 p-4 text-left hover:border-teal-300">
          <p className="text-sm font-semibold text-ink-800">{r.piece_title ?? '曲の指定なし'}</p>
          <p className="text-xs text-ink-500 mt-1">{r.composer_name ?? ''} {r.instruments.join('・')} / {r.regions.join('・')}</p>
          <p className="text-xs text-ink-500 mt-2">{r.status==='open'?'募集中':'終了'} · 承認済み応募 {r.applicants}件</p>
        </button>)}
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
                <span className="flex gap-1.5 items-center text-ink-800">
                  <Calendar size={14} />
                  {record.practice_date}
                </span>
                <span className="flex gap-1 items-center text-teal-700">
                  <Clock size={12} />
                  {record.duration_minutes}分
                </span>
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
