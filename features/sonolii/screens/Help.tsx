import type { ScreenName } from '../types';
import { ArrowLeft, ChevronRight, Mail } from 'lucide-react';

interface HelpProps {
  navigate: (s: ScreenName) => void;
}

export default function Help({ navigate }: HelpProps) {
  const faqs = [
    { q: '音声ファイルのアップロード上限は？', a: '1ファイルあたり最大200MBです。保存容量の使用状況は「設定 ＞ メディア管理」で確認できます。' },
    { q: '録音した音声はすぐ公開されますか？', a: 'いいえ。録音は非公開で保存されます。共有するには投稿作成画面から音声を添付して投稿してください。' },
    { q: '投稿の公開範囲はどこで設定できますか？', a: '「アカウント設定」でプロフィールの公開範囲を変更できます。公開・フォロワー限定・非公開の設定が投稿の表示範囲に反映されます。' },
    { q: 'アンサンブル募集に応募するには？', a: '募集詳細から応募できます。募集者が承認・却下する仕組みです。メッセージは相手のプロフィールから開始できます。' },
    { q: '練習記録はどこで確認できますか？', a: '「練習」画面で日付別・曲別に確認できます。記録した音声はメディア管理でも確認できます。' },
    { q: 'サブスクリプションは利用できますか？', a: '有料プランは準備中です。料金や提供内容が確定するまで、お支払いの登録は必要ありません。' },
    { q: '困ったときはどうすればいいですか？', a: '画面を再読み込みしても改善しない場合は、操作内容と発生時刻を控えてください。お問い合わせ窓口は準備中です。' },
  ];
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('settings')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 設定
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">ヘルプ・お問い合わせ</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 mb-5">
        <h2 className="font-serif text-base font-semibold text-ink-900 mb-4">よくある質問</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <details key={i} className="group bg-ink-50 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer p-3.5 list-none">
                <span className="text-sm font-medium text-ink-800">{faq.q}</span>
                <ChevronRight size={16} className="text-ink-400 group-open:rotate-90 transition-transform flex-shrink-0" />
              </summary>
              <p className="px-3.5 pb-3.5 text-sm text-ink-600 leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-ink-100 p-5">
        <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">お問い合わせ</h2>
        <p className="text-sm text-ink-600 mb-4">お問い合わせ窓口は現在準備中です。</p>
        <p className="text-sm text-ink-500">お問い合わせ先は公開準備が整い次第ご案内します。</p>
      </div>
    </div>
  );
}
