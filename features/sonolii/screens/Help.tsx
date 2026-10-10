import type { ScreenName } from '../types';
import { ArrowLeft, ChevronRight, Mail } from 'lucide-react';

interface HelpProps {
  navigate: (s: ScreenName) => void;
}

export default function Help({ navigate }: HelpProps) {
  const faqs = [
    { q: '演奏音声のアップロード上限は？', a: 'Freeプランでは月3件まで、Premiumプランでは無制限にアップロードできます。1ファイルあたり最大50MBです。' },
    { q: '非公開の演奏を後から公開できますか？', a: 'はい、演奏履歴からいつでも公開・非公開の設定を変更できます。' },
    { q: 'アンサンブル募集に応募するには？', a: '募集詳細画面の「応募する」ボタンから応募できます。募集者の承認後にメッセージで連絡が可能になります。' },
    { q: 'アカウントを削除したい', a: '設定 ＞ アカウント設定から削除できます。削除後はデータの復元ができませんのでご注意ください。' },
    { q: 'Premiumプランを解約したい', a: '設定 ＞ サブスクリプション管理からいつでも解約できます。解約後も契約期間終了まではPremium機能がご利用いただけます。' },
    { q: '他のユーザーをブロックできますか？', a: '現在この機能は準備中です。今後のアップデートで提供予定です。' },
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
