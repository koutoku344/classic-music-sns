import { useState } from 'react';
import { Share2 } from 'lucide-react';

export default function ShareButton({ path, label }: { path: string; label: string }) {
 const [message,setMessage]=useState('');
 async function share(){
  const url=new URL(path,window.location.origin).toString();
  setMessage('');
  try{
   if(navigator.share){
    await navigator.share({title:label,url});
   }else{
    await navigator.clipboard.writeText(url);
    setMessage('リンクをコピーしました');
   }
  }catch(error){
   if(error instanceof Error&&error.name==='AbortError')return;
   setMessage('共有できませんでした。リンクをコピーしてお試しください。');
  }
 }
 return <span className="inline-flex flex-wrap items-center gap-2">
  <button type="button" aria-label={label+'を共有'} onClick={e=>{e.stopPropagation();void share();}}
   className="inline-flex items-center gap-1.5 text-ink-600 hover:text-teal-700 rounded-md px-2 py-1.5 text-xs">
   <Share2 size={16}/>共有
  </button>
  {message&&<span role="status" className="text-xs text-ink-500">{message}</span>}
 </span>;
}
