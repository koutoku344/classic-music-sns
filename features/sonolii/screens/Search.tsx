import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName, Piece } from '../types';
import { searchUsers, type SearchUser } from '../lib/searchApi';
import { listRecruitments, type RecruitmentRow } from '../lib/recruitmentApi';
import { loadCatalog, type SelectablePiece } from '../lib/practiceApi';
import { listPosts, type PostRow } from '../lib/postApi';
import PostSummary from '../components/PostSummary';
import RecruitmentCard from '../components/RecruitmentCard';
import PiecePicker from '../components/PiecePicker';
import { Search as SearchIcon, Music2, MapPin, X, UserRound } from 'lucide-react';

interface SearchProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

type Tab = 'users' | 'posts' | 'recruitments';

export default function Search({ navigate }: SearchProps) {
  const [tab, setTab] = useState<Tab>('users');
  const [userQuery, setUserQuery] = useState('');
  const [keyword,setKeyword]=useState('');
  const [userRows,setUserRows]=useState<SearchUser[]>([]);
  const [userCursor,setUserCursor]=useState<string|null>(null);
  const [userBusy,setUserBusy]=useState(false);
  const [userError,setUserError]=useState('');
  const [userInstrument,setUserInstrument]=useState('all');
  const [userRegion,setUserRegion]=useState('all');
  const { isLoaded, getToken } = useAuth();
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [catalog, setCatalog] = useState<SelectablePiece[]>([]);
  const [postRows, setPostRows] = useState<PostRow[]>([]);
  const [recruitments,setRecruitments] = useState<RecruitmentRow[]>([]);
  const [recruitCursor,setRecruitCursor] = useState<string|null>(null);
  const [recruitBusy,setRecruitBusy] = useState(false);
  const [recruitError,setRecruitError] = useState('');
  const [postCursor, setPostCursor] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsMoreBusy, setPostsMoreBusy] = useState(false);
  const [postsError, setPostsError] = useState('');
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    let active = true;
    void loadCatalog().then(rows => {
      if (active) setCatalog(rows);
    }).catch(e => {
      if (active) setCatalogError(e instanceof Error ? e.message : '曲マスターを読み込めませんでした。');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isLoaded || tab !== 'posts') return;
    let active = true;
    setPostsLoading(true);
    setPostsError('');
    setPostRows([]);
    setPostCursor(null);
    void listPosts(getToken, null, selectedPiece?.id ?? null, keyword)
      .then(data => {
        if (active) { setPostRows(data.posts); setPostCursor(data.nextCursor); }
      })
      .catch(e => {
        if (active) setPostsError(e instanceof Error ? e.message : '検索に失敗しました。');
      })
      .finally(() => { if (active) setPostsLoading(false); });
    return () => { active = false; };
  }, [isLoaded, getToken, tab, selectedPiece?.id, keyword]);

  async function loadMorePosts() {
    if (!postCursor || postsMoreBusy) return;
    setPostsMoreBusy(true);
    try {
      const data = await listPosts(getToken, postCursor, selectedPiece?.id ?? null, keyword);
      setPostRows(previous => [...previous, ...data.posts.filter(
        item => !previous.some(p => p.id === item.id)
      )]);
      setPostCursor(data.nextCursor);
    } catch (e) {
      setPostsError(e instanceof Error ? e.message : '追加の投稿を取得できませんでした。');
    } finally {
      setPostsMoreBusy(false);
    }
  }

  const [rInstrument, setRInstrument] = useState('all');
  const [rRegion, setRRegion] = useState('all');
  const [rPurpose, setRPurpose] = useState('all');
  const [rLevel, setRLevel] = useState('all');

  useEffect(()=>{
    if(!isLoaded||tab!=='users')return;
    let active=true;
    setUserBusy(true);setUserError('');setUserCursor(null);
    const timer=window.setTimeout(()=>{
      void searchUsers({keyword:userQuery,instrument:userInstrument,region:userRegion},getToken)
        .then(page=>{if(active){setUserRows(page.users);setUserCursor(page.nextCursor);}})
        .catch(e=>{if(active)setUserError(e instanceof Error?e.message:'検索に失敗しました。');})
        .finally(()=>{if(active)setUserBusy(false);});
    },250);
    return()=>{active=false;window.clearTimeout(timer);};
  },[isLoaded,getToken,tab,userQuery,userInstrument,userRegion]);
  async function moreUsers(){
    if(!userCursor||userBusy)return;
    setUserBusy(true);
    try{
      const data=await searchUsers({keyword:userQuery,instrument:userInstrument,region:userRegion,cursor:userCursor},getToken);
      setUserRows(prev=>[...prev,...data.users.filter(u=>!prev.some(x=>x.user_id===u.user_id))]);
      setUserCursor(data.nextCursor);
    }catch(e){setUserError(String(e));}finally{setUserBusy(false);}
  }

  const filteredRecruitments = recruitments;
  useEffect(() => {
    if (!isLoaded || tab !== 'recruitments') return;
    let active = true;
    setRecruitBusy(true);
    setRecruitError('');
    setRecruitments([]);
    setRecruitCursor(null);
    void listRecruitments(getToken, {
      instrument:rInstrument, region:rRegion, level:rLevel, purpose:rPurpose,
      pieceId:selectedPiece?.id??null,keyword
    }).then(data => {
      if(active){setRecruitments(data.recruitments);setRecruitCursor(data.nextCursor);}
    }).catch(e => {if(active)setRecruitError(e instanceof Error?e.message:'募集を検索できませんでした。');})
      .finally(()=>{if(active)setRecruitBusy(false);});
    return ()=>{active=false;};
  }, [isLoaded,getToken,tab,rInstrument,rRegion,rLevel,rPurpose,selectedPiece?.id,keyword]);

  async function loadMoreRecruitments(){
    if (!recruitCursor || recruitBusy)return;
    setRecruitBusy(true);
    try{
      const data=await listRecruitments(getToken,{cursor:recruitCursor,instrument:rInstrument,region:rRegion,level:rLevel,purpose:rPurpose,pieceId:selectedPiece?.id??null,keyword});
      setRecruitments(prev=>[...prev,...data.recruitments.filter(r=>!prev.some(x=>x.id===r.id))]);
      setRecruitCursor(data.nextCursor);
    }catch(e){setRecruitError(e instanceof Error?e.message:'募集を追加取得できませんでした。');}
    finally{setRecruitBusy(false);}
  }

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

          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="text-xs text-ink-500">楽器
              <select className={selectCls} value={userInstrument} onChange={e=>setUserInstrument(e.target.value)}>
                {['all','Piano','Violin','Cello','Viola','Flute','Clarinet','Oboe','Trumpet','Guitar','その他'].map(v=><option key={v} value={v}>{v==='all'?'全て':v}</option>)}
              </select>
            </label>
            <label className="text-xs text-ink-500">地域
              <select className={selectCls} value={userRegion} onChange={e=>setUserRegion(e.target.value)}>
                {['all','東京','大阪','神奈川','京都','愛知','兵庫','福岡','非公開'].map(v=><option key={v} value={v}>{v==='all'?'全て':v}</option>)}
              </select>
            </label>
          </div>
          {userError&&<p role="alert" className="text-red-600 text-sm">{userError}</p>}
          {userBusy&&<p className="text-sm text-ink-500">検索中...</p>}
          <div className="space-y-3">
            {userRows.map(u=><button key={u.user_id} type="button" onClick={()=>navigate('userProfile',{id:u.user_id})}
              className="w-full text-left bg-white rounded-xl border border-ink-100 p-4 flex gap-3 items-center">
              <UserRound size={32} className="text-ink-400 flex-shrink-0"/>
              <div><p className="font-medium text-sm">{u.display_name}</p>
                <p className="text-xs text-ink-500">{u.instruments?.join('・')||'楽器未設定'} · {u.region||'地域未設定'}</p>
              </div>
            </button>)}
            {!userBusy&&userRows.length===0&&!userError&&<p className="text-ink-400 text-center py-12">該当するユーザーがいません</p>}
            {userCursor&&<button onClick={()=>void moreUsers()} disabled={userBusy} className="w-full border rounded-lg p-3 text-sm text-teal-700">さらに表示</button>}
          </div>
        </>
      )}

      {tab !== 'users' && <label className="block mb-4 text-sm text-ink-600">キーワード検索（任意）
        <input value={keyword} onChange={e=>setKeyword(e.target.value)} maxLength={100} placeholder="本文・作曲者・曲名"
          className="mt-1 w-full px-4 py-3 bg-white border border-ink-200 rounded-xl text-sm"/>
      </label>}

      {tab === 'posts' && (
        <>
          <div className="bg-white rounded-2xl border border-ink-100 p-5 mb-5">
            <PiecePicker
              pieces={catalog}
              defaultLibraryMode="catalog"
              selectedPiece={selectedPiece}
              onSelect={setSelectedPiece}
              label="曲で絞り込む（任意）"
              allowFreeInput={false}
              recentPieces={[]}
            />
          </div>

          <div className="space-y-4">
            {catalogError && <p role="alert" className="text-sm text-red-600">{catalogError}</p>}
            <p className="text-xs text-ink-500">
              共通曲マスターでの絞り込みに対応しています。独自登録曲の横断検索は今後対応予定です。
            </p>
            {postsLoading && <p className="text-sm text-ink-500">投稿を検索中...</p>}
            {postsError && <p role="alert" className="text-sm text-red-600">{postsError}</p>}
            {!postsLoading && postRows.length === 0 && !postsError && (
              <div className="text-center py-20 text-ink-400">
                <p>該当する投稿がありません</p>
              </div>
            )}
            {postRows.map(post => (
              <PostSummary key={post.id} post={post} getToken={getToken}
                onOpen={() => navigate('postDetail', { id: post.id })} />
            ))}
            {postCursor && (
              <button type="button" onClick={() => void loadMorePosts()} disabled={postsMoreBusy}
                className="w-full border border-ink-200 rounded-xl p-3 text-sm text-teal-700 disabled:opacity-50">
                {postsMoreBusy ? '読み込み中...' : 'さらに投稿を表示'}
              </button>
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

          <div className="bg-white rounded-2xl border border-ink-100 p-4 mb-5">
            <PiecePicker pieces={catalog} defaultLibraryMode="catalog" selectedPiece={selectedPiece}
              onSelect={setSelectedPiece} label="曲で絞り込む（任意）" allowFreeInput={false} recentPieces={[]} />
          </div>
          {recruitError && <p role="alert" className="text-sm text-red-600">{recruitError}</p>}
          {recruitBusy && <p className="text-sm text-ink-500">募集中の案件を検索しています...</p>}
          <div className="space-y-4">
            {filteredRecruitments.map((r) => (
              <RecruitmentCard
                key={r.id}
                recruitment={r}
                onClick={() => navigate('recruitmentDetail', { id: r.id })}
                onUserClick={() => navigate('userProfile', { id: r.user_id })}
              />
            ))}
            {!recruitBusy && filteredRecruitments.length === 0 && !recruitError && (
              <div className="text-center py-20 text-ink-400">
                <p>該当する結果がありません</p>
              </div>
            )}
            {recruitCursor && <button type="button" onClick={() => void loadMoreRecruitments()} disabled={recruitBusy} className="w-full border border-ink-200 rounded-xl p-3 text-sm text-teal-700 disabled:opacity-50">{recruitBusy?'読み込み中...':'さらに募集を表示'}</button>}
          </div>
        </>
      )}
    </div>
  );
}
