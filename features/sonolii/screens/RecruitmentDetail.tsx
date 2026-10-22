import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import { getRecruitment, applyRecruitment, cancelRecruitmentApplication, listRecruitmentApplicants, decideRecruitmentApplicant, setRecruitmentStatus, updateRecruitment, deleteRecruitment, type RecruitmentRow, type ApplicantRow } from '../lib/recruitmentApi';
import { ArrowLeft } from 'lucide-react';

export default function RecruitmentDetail({recruitmentId,navigate}:{recruitmentId:string;navigate:(s:ScreenName,params?:Record<string,string>)=>void}) {
 const {getToken,userId:clerkId}=useAuth();
 const [row,setRow]=useState<RecruitmentRow|null>(null);
 const [applicants,setApplicants]=useState<ApplicantRow[]>([]);
 const [owner,setOwner]=useState(false);
 const [busy,setBusy]=useState(false);
 const [applyMessage,setApplyMessage]=useState('');
 const [applyInstrument,setApplyInstrument]=useState('');
 const [editing,setEditing]=useState(false);
 const [editDescription,setEditDescription]=useState('');
 const [editLevel,setEditLevel]=useState('問わない');
 const [editPurpose,setEditPurpose]=useState('アンサンブル');
 const [editInstruments,setEditInstruments]=useState<string[]>([]);
 const [editRegions,setEditRegions]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 async function refresh(){
   const value=await getRecruitment(recruitmentId,getToken);
   setRow(value);
   // Own applicant list is private: 404 is expected for a non-owner.
   // Compare via explicit /me/profile ownership when available.
   const token=await getToken();
   if(token){
    const {API_BASE}=await import('../lib/repertoireApi');
    const response=await fetch(API_BASE+'/me/profile',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(response.ok){const profile=await response.json() as {profile?:{user_id?:string}};const isOwner=profile.profile?.user_id===value.user_id;setOwner(isOwner);
      if(isOwner)setApplicants(await listRecruitmentApplicants(recruitmentId,getToken));
    }
   }
 }
 useEffect(()=>{let active=true;setLoading(true);void getRecruitment(recruitmentId,getToken).then(async value=>{
  if(!active)return;setRow(value);
  const token=await getToken();
  if(!token||!active)return;
  const {API_BASE}=await import('../lib/repertoireApi');
  const res=await fetch(API_BASE+'/me/profile',{headers:{Authorization:'Bearer '+token}});
  if(!res.ok||!active)return;
  const info=await res.json() as {profile?:{user_id?:string}};
  const mine=info.profile?.user_id===value.user_id;
  setOwner(mine);
  if(mine){const items=await listRecruitmentApplicants(recruitmentId,getToken);if(active)setApplicants(items);}
 }).catch(e=>{if(active)setError(e instanceof Error?e.message:'募集を表示できませんでした。');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[recruitmentId,getToken,clerkId]);
 async function perform(action:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await action();window.dispatchEvent(new Event('sonolii:recruitment-changed'));await refresh();}catch(e){setError(e instanceof Error?e.message:'操作に失敗しました。');}finally{setBusy(false);}}
 if(loading)return <div className="max-w-2xl mx-auto p-6">募集を読み込み中...</div>;
 return <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
  <button onClick={()=>navigate('community')} className="flex gap-2 items-center text-sm text-ink-600"><ArrowLeft size={18}/> コミュニティ</button>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {!row?<p>この募集は見つかりません。</p>:<>
   <div className="bg-white border border-ink-100 rounded-2xl p-5 space-y-4">
    <div className="flex items-center justify-between gap-2"><button onClick={()=>navigate('userProfile',{id:row.user_id})} className="font-medium text-teal-700">{row.display_name}</button><span className="text-xs">{row.status==='open'?'募集中':'募集終了'}</span></div>
    <h1 className="text-xl font-serif">{row.composer_name&&row.piece_title?`${row.composer_name} / ${row.piece_title}`:'曲目未指定'}</h1>
    <div className="text-sm space-y-1 text-ink-600"><p>楽器：{row.instruments.length?row.instruments.join('・'):'募集楽器の指定なし'}</p><p>地域：{row.regions.join('・')}</p><p>レベル：{row.level}　目的：{row.purpose}</p></div>
    <p className="whitespace-pre-wrap text-sm text-ink-800">{row.description}</p>
    <div className="text-sm text-ink-600 space-y-1">
      <p>承認済み：{row.applicants}件</p>
      <p className="font-medium">楽器別応募件数（審査待ち・承認済み）</p>
      {(row.instruments.length?row.instruments:['その他']).map(instrument=><p key={instrument}>{instrument}：{row.instrument_counts?.[instrument]??0}件</p>)}
      {row.instruments.length>0&&!row.instruments.includes('その他')&&<p>その他：{row.instrument_counts?.['その他']??0}件</p>}
    </div>
    {owner? <div className="flex flex-wrap gap-2">
      {row.status==='open' && <button disabled={busy} onClick={()=>{setEditing(v=>!v);setEditDescription(row.description);setEditLevel(row.level);setEditPurpose(row.purpose);setEditInstruments([...row.instruments]);setEditRegions([...row.regions]);}} className="px-4 py-2 border border-ink-200 rounded-lg text-sm">{editing?'編集を閉じる':'募集内容を編集'}</button>}
      <button disabled={busy} onClick={()=>void perform(()=>setRecruitmentStatus(row.id,row.status==='open'?'closed':'open',getToken))} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">{row.status==='open'?'募集を終了':'募集を再開'}</button>
      <button disabled={busy} onClick={()=>{if(window.confirm('この募集と応募履歴を削除しますか？'))void perform(async()=>{await deleteRecruitment(row.id,getToken);navigate('community');});}} className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm">募集を削除</button>
     </div>:
     <div>
      {row.my_application==='pending'? <button disabled={busy} onClick={()=>void perform(()=>cancelRecruitmentApplication(row.id,getToken))} className="px-4 py-2 border rounded-lg">応募を取り消す</button>:
       row.my_application==='accepted'?<p className="text-sm text-teal-700">応募が承認されました。メッセージ機能はSTEP13で対応します。</p>:
       row.status==='open'?<div className="space-y-3">
        {row.instruments.length>0?<label className="block text-sm font-medium">応募する楽器（任意）
          <select aria-label="応募する楽器" className="block w-full mt-1 p-2 rounded-lg border border-ink-200" value={applyInstrument} onChange={e=>setApplyInstrument(e.target.value)}>
            <option value="">指定しない</option>
            {row.instruments.map(instrument=><option key={instrument} value={instrument}>{instrument}</option>)}
          </select>
        </label>:<p className="text-sm text-ink-500">募集楽器の指定なし</p>}
        <label className="block text-sm font-medium">応募コメント（主催者のみ閲覧可能・任意）
          <textarea aria-label="応募コメント" maxLength={1000} rows={3} value={applyMessage} onChange={e=>setApplyMessage(e.target.value)}
            className="block w-full mt-1 p-2 rounded-lg border border-ink-200" placeholder="自己紹介や演奏経験、参加可能な日程など"/>
        </label>
        <button disabled={busy} onClick={()=>void perform(async()=>{await applyRecruitment(row.id,getToken,{message:applyMessage,instrument:row.instruments.includes(applyInstrument)?applyInstrument:null});setApplyMessage('');setApplyInstrument('');})}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-lg disabled:opacity-50">応募する</button>
       </div>:<p className="text-sm text-ink-500">現在募集を受け付けていません。</p>}
     </div>}
   </div>
   {owner&&editing&&row.status==='open'&&<section className="bg-white border border-ink-100 rounded-2xl p-5 space-y-3">
      <h2 className="font-semibold">募集を編集</h2>
      <p className="text-xs text-ink-500">曲目は変更せず、募集条件と本文を更新します。</p>
      <label className="block text-sm">楽器（カンマ区切り）<input className="block w-full border border-ink-200 rounded-lg p-2" value={editInstruments.join(',')} onChange={e=>setEditInstruments(e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></label>
      <label className="block text-sm">地域（カンマ区切り）<input className="block w-full border border-ink-200 rounded-lg p-2" value={editRegions.join(',')} onChange={e=>setEditRegions(e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></label>
      <label className="block text-sm">レベル<select className="block w-full border border-ink-200 rounded-lg p-2" value={editLevel} onChange={e=>setEditLevel(e.target.value)}>{['初級','中級','上級','問わない'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="block text-sm">目的<select className="block w-full border border-ink-200 rounded-lg p-2" value={editPurpose} onChange={e=>setEditPurpose(e.target.value)}>{['アンサンブル','発表会','趣味で合わせ','その他'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="block text-sm">募集内容<textarea className="block w-full border border-ink-200 rounded-lg p-2" rows={4} maxLength={2000} value={editDescription} onChange={e=>setEditDescription(e.target.value)}/></label>
      <button disabled={busy} className="px-4 py-2 bg-teal-600 text-white rounded-lg" onClick={()=>void perform(async()=>{await updateRecruitment(row.id,{pieceId:row.piece_id,instruments:editInstruments,regions:editRegions,level:editLevel,purpose:editPurpose,description:editDescription},getToken);setEditing(false);})}>変更を保存</button>
   </section>}
   {owner&&<section className="bg-white border border-ink-100 rounded-2xl p-5 space-y-3"><h2 className="font-semibold">応募者管理（{applicants.length}件）</h2>{applicants.length===0&&<p className="text-sm text-ink-500">応募はまだありません。</p>}
    {applicants.map(a=><div key={a.id} className="flex items-center gap-2 flex-wrap border-b py-2"><button onClick={()=>navigate('userProfile',{id:a.applicant_id})} className="text-sm text-teal-700">{a.display_name}</button><span className="text-xs text-ink-500">{a.status==='pending'?'審査待ち':a.status==='accepted'?'承認済み':'却下済み'}</span>
     <span className="text-xs text-ink-600">{a.instrument??'楽器指定なし'}</span>
     {a.message&&<p className="basis-full text-sm text-ink-700 whitespace-pre-wrap bg-ink-50 rounded-lg p-3">{a.message}</p>}
     {a.status==='pending'&&row.status==='open'&&<><button disabled={busy} onClick={()=>void perform(()=>decideRecruitmentApplicant(row.id,a.id,'accept',getToken))} className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 text-white border border-teal-700 disabled:opacity-50">承認</button><button disabled={busy} onClick={()=>void perform(()=>decideRecruitmentApplicant(row.id,a.id,'reject',getToken))} className="px-4 py-2 text-sm font-semibold rounded-lg border border-ink-300 bg-white text-ink-700 disabled:opacity-50">却下</button></>}
    </div>)}
   </section>}
  </>}
 </div>;
}
