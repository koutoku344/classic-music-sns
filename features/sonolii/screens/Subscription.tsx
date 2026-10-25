import type { ScreenName } from '../types';
import { ArrowLeft, Crown, HardDrive } from 'lucide-react';

export default function Subscription({navigate}:{navigate:(s:ScreenName)=>void}){
 return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
  <button type="button" onClick={()=>navigate('settings')}
   className="inline-flex items-center gap-2 text-sm text-ink-600 mb-5"><ArrowLeft size={18}/>設定へ戻る</button>
  <div className="bg-white rounded-2xl border border-ink-100 p-6 space-y-4">
   <div className="flex items-center gap-3"><Crown className="text-gold-600" size={26}/>
    <h1 className="font-serif text-xl font-semibold text-ink-900">有料プランは準備中です</h1>
   </div>
   <p className="text-sm text-ink-600 leading-relaxed">
    現在、料金や提供機能は確定していません。プランが提供されるまで有料登録や決済はできません。
   </p>
   <button type="button" onClick={()=>navigate('mediaManager')}
    className="w-full flex items-center justify-center gap-2 border border-ink-200 rounded-xl py-3 text-teal-700 text-sm">
    <HardDrive size={17}/>現在の保存容量を確認する
   </button>
  </div>
 </div>;
}
