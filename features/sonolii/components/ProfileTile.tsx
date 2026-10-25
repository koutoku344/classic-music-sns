import { CalendarDays, Music2, Users } from 'lucide-react';
export type ProfileTileKind='performance'|'recruitment'|'practice';
export default function ProfileTile({kind,title,subtitle,onClick}:{kind:ProfileTileKind;title:string;subtitle?:string;onClick:()=>void}){
 const Icon=kind==='recruitment'?Users:kind==='practice'?CalendarDays:Music2;
 const label=kind==='recruitment'?'募集':kind==='practice'?'練習':'演奏';
 return <button type="button" onClick={onClick} aria-label={label+'：'+title}
  className="aspect-square w-full min-w-0 overflow-hidden bg-white border border-ink-100 rounded-xl text-left hover:border-teal-300 focus-visible:outline-teal-600 flex flex-col">
  <div className="flex-1 min-h-0 bg-ink-50 flex flex-col justify-center items-center px-3 gap-2">
   <Icon size={28} className="text-teal-600"/>
   <p className="text-sm font-medium text-ink-800 text-center line-clamp-3 break-words">{title}</p>
  </div>
  <div className="px-3 py-2 shrink-0 flex items-center justify-between gap-2">
   <span className="text-xs text-ink-500">{label}</span>
   {subtitle&&<span className="text-xs text-ink-400 truncate">{subtitle}</span>}
  </div>
 </button>;
}
