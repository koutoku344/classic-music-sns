import { MapPin, Users, Music2, Activity, ChevronRight } from 'lucide-react';
import type { RecruitmentRow } from '../lib/recruitmentApi';

export default function RecruitmentCard({ recruitment:r, onClick, onUserClick }: {
  recruitment:RecruitmentRow;onClick?:()=>void;onUserClick?:()=>void;
}) {
 return <article role="link" tabIndex={0} onClick={onClick} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onClick?.();}}}
 className="bg-white rounded-2xl border border-ink-100 p-4 sm:p-5 hover:shadow-md transition-shadow cursor-pointer animate-slide-up">
  <div className="flex items-center gap-3 mb-3">
    <div className="flex-1 min-w-0">
      <button type="button" onClick={e=>{e.stopPropagation();onUserClick?.();}} className="font-medium text-ink-900 text-sm truncate hover:text-teal-700">{r.display_name}</button>
      <p className="text-xs text-ink-400">{new Date(r.created_at).toLocaleDateString('ja-JP')}</p>
    </div>
    <span className={`px-2.5 py-1 text-xs rounded-full border ${r.status==='open'?'bg-sage-100 text-sage-700 border-sage-300':'bg-ink-100 text-ink-500 border-ink-200'}`}>{r.status==='open'?'募集中':'募集終了'}</span>
  </div>
  <div className="flex items-center gap-2 mb-3 text-sm"><Music2 size={14} className="text-teal-600"/><span className="font-serif text-ink-800">{r.piece_title?`${r.composer_name ?? ''} / ${r.piece_title}`:'演奏曲目は相談'}</span></div>
  <div className="flex flex-wrap gap-2 mb-3 text-xs text-ink-600">
    <span className="flex items-center gap-1 px-2.5 py-1 bg-ink-50 rounded-lg"><Music2 size={12}/>{r.instruments.length?r.instruments.join('・'):'募集楽器の指定なし'}</span>
    <span className="flex items-center gap-1 px-2.5 py-1 bg-ink-50 rounded-lg"><MapPin size={12}/>{r.regions.join('・')}</span>
    <span className="flex items-center gap-1 px-2.5 py-1 bg-ink-50 rounded-lg"><Activity size={12}/>{r.level}</span>
    <span className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 rounded-lg"><Users size={12}/>{r.purpose}</span>
  </div>
  <p className="text-sm text-ink-600 line-clamp-2">{r.description}</p>
  <div className="mt-3 pt-3 border-t border-ink-100 space-y-2">
    <div className="flex items-center justify-between"><span className="text-xs text-ink-400">承認済み {r.applicants}件</span><ChevronRight size={16} className="text-ink-300"/></div>
    <div className="flex gap-x-3 gap-y-1 flex-wrap text-xs text-ink-600" aria-label="楽器別応募件数">
      {(r.instruments.length?r.instruments:['その他']).map(instrument=><span key={instrument}>{instrument}：{r.instrument_counts?.[instrument]??0}件</span>)}
      {r.instruments.length>0&&<span>その他：{r.instrument_counts?.['その他']??0}件</span>}
    </div>
  </div>
 </article>;
}
