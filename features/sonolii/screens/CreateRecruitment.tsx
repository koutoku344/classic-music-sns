import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { createRecruitment } from '../lib/recruitmentApi';
import { loadCatalog, type SelectablePiece } from '../lib/practiceApi';
import PiecePicker from '../components/PiecePicker';
import type { ScreenName, Piece } from '../types';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

const instruments = ['Piano','Violin','Cello','Viola','Flute','Clarinet','Oboe','Trumpet','Guitar','その他'];
const regions = ['東京','大阪','神奈川','京都','愛知','兵庫','福岡','オンライン'];
const selectCls = 'w-full px-3 py-2.5 bg-white border border-ink-200 rounded-xl text-sm';
export default function CreateRecruitment({navigate}:{navigate:(s:ScreenName,params?:Record<string,string>)=>void}) {
  const { getToken }=useAuth();
  const [catalog,setCatalog]=useState<SelectablePiece[]>([]);
  const [piece,setPiece]=useState<Piece|null>(null);
  const [selectedInstruments,setSelectedInstruments]=useState<string[]>([]);
  const [selectedRegions,setSelectedRegions]=useState<string[]>([]);
  const [level,setLevel]=useState('問わない');
  const [purpose,setPurpose]=useState('アンサンブル');
  const [description,setDescription]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{let mounted=true;loadCatalog().then(items=>{if(mounted)setCatalog(items);}).catch(()=>{if(mounted)setError('曲マスターを取得できませんでした。');});return()=>{mounted=false;};},[]);
  const toggle=(value:string,items:string[],set:(values:string[])=>void)=>set(items.includes(value)?items.filter(x=>x!==value):[...items,value]);
  async function submit(){
    if(busy)return;
    if(!selectedRegions.length||!description.trim()){
      setError('地域を1つ以上選択し、募集内容を入力してください。');return;
    }
    setBusy(true);setError('');
    try{
      const id=await createRecruitment({pieceId:piece?.id??null,instruments:selectedInstruments,regions:selectedRegions,level,purpose,description},getToken);
      window.dispatchEvent(new Event('sonolii:recruitment-changed'));
      navigate('recruitmentDetail',{id});
    }catch(e){setError(e instanceof Error?e.message:'募集を作成できませんでした。');}
    finally{setBusy(false);}
  }
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
    <button onClick={()=>navigate('community')} className="flex items-center gap-2 text-sm text-ink-600"><ArrowLeft size={18}/> 戻る</button>
    <h1 className="font-serif text-2xl font-bold">アンサンブル募集を作成</h1>
    <div className="bg-white rounded-2xl border border-ink-100 p-5 space-y-5">
      <PiecePicker pieces={catalog} selectedPiece={piece} onSelect={setPiece} label="演奏曲目（任意）" recentPieces={[]} allowFreeInput={false} defaultLibraryMode="catalog" />
      <fieldset><legend className="text-sm font-medium mb-2">募集楽器（任意・未選択なら指定なし）</legend><div className="flex flex-wrap gap-2">{instruments.map(x=><button type="button" key={x} aria-pressed={selectedInstruments.includes(x)} onClick={()=>toggle(x,selectedInstruments,setSelectedInstruments)} className={`px-3 py-2 border rounded-xl text-sm ${selectedInstruments.includes(x)?'bg-teal-100 border-teal-500':'border-ink-200'}`}>{x}</button>)}</div></fieldset>
      <fieldset><legend className="text-sm font-medium mb-2">地域（複数選択可）</legend><div className="flex flex-wrap gap-2">{regions.map(x=><button type="button" key={x} aria-pressed={selectedRegions.includes(x)} onClick={()=>toggle(x,selectedRegions,setSelectedRegions)} className={`px-3 py-2 border rounded-xl text-sm ${selectedRegions.includes(x)?'bg-teal-100 border-teal-500':'border-ink-200'}`}>{x}</button>)}</div></fieldset>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm">レベル<select value={level} onChange={e=>setLevel(e.target.value)} className={selectCls}>{['初級','中級','上級','問わない'].map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm">目的<select value={purpose} onChange={e=>setPurpose(e.target.value)} className={selectCls}>{['アンサンブル','発表会','趣味で合わせ','その他'].map(x=><option key={x}>{x}</option>)}</select></label></div>
      <label className="block text-sm">募集内容（必須）<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000} rows={5} className={selectCls} placeholder="演奏条件・練習頻度・日程など" /></label>
      {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={()=>void submit()} disabled={busy} className="w-full py-3 bg-teal-600 text-white rounded-xl disabled:opacity-60">{busy?'投稿中...':'募集を投稿する'}</button>
    </div>
  </div>;
}
