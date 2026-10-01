import type { ScreenName } from '../types';
import { ArrowLeft } from 'lucide-react';

interface TermsProps {
  navigate: (s: ScreenName) => void;
}

export default function Terms({ navigate }: TermsProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('settings')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 設定
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">利用規約</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-6 space-y-5 text-sm leading-relaxed text-ink-700">
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">第1条（目的）</h2>
          <p>本利用規約（以下「本規約」）は、Crescendo（以下「本サービス」）の利用条件を定めるものです。ユーザーは、本サービスを利用することにより、本規約に同意したものとみなされます。</p>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">第2条（利用登録）</h2>
          <p>本サービスの利用を希望する者は、本規約に同意の上、所定の登録手続きを行うものとします。登録情報は正確かつ最新の情報を提供するものとします。</p>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">第3条（禁止事項）</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>他のユーザーへの誹謗中傷、嫌がらせ</li>
            <li>著作権等の知的財産権を侵害する行為</li>
            <li>虚偽の情報を投稿する行為</li>
            <li>本サービスの運営を妨害する行為</li>
            <li>公序良俗に反する行為</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">第4条（投稿内容）</h2>
          <p>ユーザーが投稿した演奏音声、画像、コメント等の内容について、ユーザー自身が責任を負うものとします。本サービスは、投稿内容の適法性等について監視する義務を負いません。</p>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">第5条（料金・プラン）</h2>
          <p>本サービスはFreeプランおよびPremiumプランを提供します。Premiumプランは月額制であり、料金および提供機能は別途定めるとおりとします。</p>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">第6条（サービスの変更・停止）</h2>
          <p>本サービスは、事前通知なくサービス内容の変更、一時停止、終了を行うことができるものとします。</p>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">第7条（免責事項）</h2>
          <p>本サービスは、サービスの提供に関してユーザーに生じた損害について、一切の責任を負わないものとします。ただし、故意または重大な過失による場合はこの限りではありません。</p>
        </section>
        <p className="text-xs text-ink-400 pt-4 border-t border-ink-100">2026年9月30日 制定</p>
      </div>
    </div>
  );
}
