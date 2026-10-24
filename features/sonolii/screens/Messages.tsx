import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Mail, RefreshCw } from 'lucide-react';
import type { ScreenName } from '../types';
import { listConversations, type ConversationRow } from '../lib/messageApi';

export default function Messages({navigate}:{navigate:(s:ScreenName,params?:Record<string,string>)=>void}){
 const {isLoaded,isSignedIn,getToken}=useAuth();
 const [rows,setRows]=useState<ConversationRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 useEffect(()=>{if(!isSignedIn)return;const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void listConversations(getToken).then(setRows).catch(()=>{});},10000);return()=>window.clearInterval(timer);},[isSignedIn,getToken]);
 useEffect(()=>{
  if(!isLoaded)return;
  if(!isSignedIn){setLoading(false);return;}
  let active=true;
  setLoading(true);
  void listConversations(getToken).then(data=>{if(active)setRows(data);})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'会話の取得に失敗しました。');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[isLoaded,isSignedIn,getToken]);
 const visible=rows.filter(r=>r.partner_name?.toLowerCase().includes(search.toLowerCase()));
 return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
  <div className="flex items-center justify-between">
   <h1 className="font-serif text-2xl font-bold text-ink-900">メッセージ</h1>
   <button aria-label="再読み込み" className="p-2 border border-ink-200 rounded-lg"
    onClick={()=>{setLoading(true);void listConversations(getToken).then(setRows).catch(e=>setError(String(e))).finally(()=>setLoading(false));}}><RefreshCw size={18}/></button>
  </div>
  <input aria-label="会話を検索" placeholder="名前で会話を検索" value={search} onChange={e=>setSearch(e.target.value)}
   className="w-full px-4 py-3 border border-ink-200 rounded-xl bg-white text-sm"/>
  {loading&&<p className="text-sm text-ink-500">読み込み中...</p>}
  {!isSignedIn&&!loading&&<p>ログインすると会話を確認できます。</p>}
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {!loading&&isSignedIn&&!error&&visible.length===0&&<div className="text-center py-16 text-ink-400"><Mail className="mx-auto mb-3"/><p>{search.trim() ? "一致する会話がありません。" : "会話はまだありません。相手のプロフィールからメッセージを始められます。"}</p></div>}
  <div className="space-y-2">
   {visible.map(r=><button key={r.id} onClick={()=>navigate('conversation',{id:r.id})} className="w-full text-left border border-ink-100 bg-white rounded-xl p-4">
    <div className="flex justify-between items-center">
     <span className="font-semibold text-sm">{r.partner_name}</span>
     {!!r.unread_count&&<span className="text-xs text-teal-700 font-bold">未読 {r.unread_count}</span>}
    </div>
    <p className="text-sm text-ink-500 truncate mt-1">{r.last_message??'メッセージを送って会話を始めましょう'}</p>
   </button>)}
  </div>
 </div>;
}
