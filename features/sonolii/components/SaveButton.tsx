import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { getSaved, setSaved, type SavedKind } from '../lib/savedApi';
import type { TokenGetter } from '../lib/mediaApi';
export default function SaveButton({kind,id,getToken}:{kind:SavedKind;id:string;getToken:TokenGetter}){
 const [saved,setState]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 useEffect(()=>{let active=true;void getSaved(kind,id,getToken).then(v=>{if(active)setState(v);}).catch(()=>{});return()=>{active=false;};},[kind,id,getToken]);
 async function toggle(){
  if(busy)return;
  setBusy(true);setNotice('');
  try{await setSaved(kind,id,!saved,getToken);setState(!saved);}
  catch{setNotice('保存を更新できませんでした。');}
  finally{setBusy(false);}
 }
 return <span className="inline-flex flex-wrap items-center gap-1">
  <button type="button" aria-label={saved?'保存を解除':'保存する'} aria-pressed={saved} disabled={busy}
   className="inline-flex items-center gap-1 text-xs text-ink-600 p-2 disabled:opacity-50"
   onClick={e=>{e.stopPropagation();void toggle();}}>
   <Bookmark size={16} fill={saved?'currentColor':'none'}/>{saved?'保存済み':'保存'}
  </button>
  {notice&&<span className="text-xs text-ink-500" role="status">{notice}</span>}
 </span>;
}
