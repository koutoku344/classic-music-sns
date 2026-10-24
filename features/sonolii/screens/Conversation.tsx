import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ArrowLeft, Send } from 'lucide-react';
import type { ScreenName } from '../types';
import { getConversation, listMessages, markConversationRead, sendMessage, type ConversationRow, type MessageRow } from '../lib/messageApi';
import { API_BASE } from '../lib/repertoireApi';

export default function Conversation({conversationId,navigate}:{conversationId:string;navigate:(s:ScreenName,params?:Record<string,string>)=>void}){
 const {getToken}=useAuth();
 const [conversation,setConversation]=useState<ConversationRow|null>(null);
 const [messages,setMessages]=useState<MessageRow[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);
 const [myId,setMyId]=useState('');
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  const [conv,page]=await Promise.all([getConversation(conversationId,getToken),listMessages(conversationId,getToken)]);
  setConversation(conv);
  setMessages(page.messages.slice().reverse());
  setCursor(page.nextCursor);
  await markConversationRead(conversationId,getToken);
 },[conversationId,getToken]);
 useEffect(()=>{
  let active=true;
  setLoading(true);
  void Promise.all([refresh(),getToken().then(async token=>{
    const response=await fetch(API_BASE+'/me/profile',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(!response.ok)throw Error('プロフィールを取得できませんでした。');
    const info=await response.json() as {profile:{user_id:string}};
    if(active)setMyId(info.profile.user_id);
  })]).catch(e=>{if(active)setError(e instanceof Error?e.message:'取得に失敗しました。');}).finally(()=>{if(active)setLoading(false);});
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});},10000);
  return()=>{active=false;window.clearInterval(timer);};
 },[refresh,getToken]);
 async function send(e:React.FormEvent){
  e.preventDefault();
  if(busy||!draft.trim())return;
  setBusy(true);setError('');
  try{
   const message=await sendMessage(conversationId,draft,getToken);
   setMessages(old=>[...old,message]);
   setDraft('');
  }catch(e){setError(e instanceof Error?e.message:'送信できませんでした。');}
  finally{setBusy(false);}
 }
 async function loadOlder(){
  if(!cursor||busy)return;
  setBusy(true);
  try{
   const page=await listMessages(conversationId,getToken,cursor);
   setMessages(old=>[...page.messages.slice().reverse(),...old]);
   setCursor(page.nextCursor);
  }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3" style={{minHeight:'calc(100vh - 8rem)'}}>
  <div className="flex items-center gap-3 pb-4 border-b border-ink-100">
   <button aria-label="メッセージ一覧へ戻る" onClick={()=>navigate('messages')}><ArrowLeft size={20}/></button>
   <div><p className="font-semibold text-ink-900">{conversation?.partner_name??'会話'}</p>
</div>
  </div>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {loading?<p className="text-sm text-ink-500">会話を読み込み中...</p>:
  <div className="flex-1 space-y-3 py-3">
   {cursor&&<button disabled={busy} className="block mx-auto text-sm text-teal-700" onClick={()=>void loadOlder()}>以前のメッセージを表示</button>}
   {messages.length===0&&<p className="text-center py-8 text-sm text-ink-400">まだメッセージはありません。</p>}
   {messages.map(m=><div key={m.id} className={'flex '+(m.sender_id===myId?'justify-end':'justify-start')}>
    <div className={'max-w-[78%] rounded-2xl px-4 py-2.5 '+(m.sender_id===myId?'bg-teal-600 text-white':'bg-white border border-ink-100 text-ink-800')}>
     <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
     <time className="block text-xs opacity-70 mt-1">{new Date(m.created_at).toLocaleString('ja-JP',{dateStyle:'short',timeStyle:'short'})}</time>
    </div>
   </div>)}
  </div>}
  <form onSubmit={e=>void send(e)} className="flex gap-2 border-t border-ink-100 pt-3">
   <input aria-label="メッセージ本文" maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)}
    placeholder="メッセージを入力..." className="flex-1 min-w-0 border border-ink-200 rounded-xl p-3 text-sm bg-white"/>
   <button type="submit" disabled={loading||busy||!draft.trim()} aria-label="送信" className="px-4 py-3 rounded-xl bg-teal-600 text-white disabled:opacity-50"><Send size={18}/></button>
  </form>
 </div>;
}
