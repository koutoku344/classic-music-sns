import type { ScreenName } from '../types';
import { ArrowLeft } from 'lucide-react';

interface PrivacyProps {
  navigate: (s: ScreenName) => void;
}

export default function Privacy({ navigate }: PrivacyProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('settings')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 設定
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">プライバシーポリシー</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-6 space-y-5 text-sm leading-relaxed text-ink-700">
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">1. 収集する情報</h2>
          <p>本サービスは、利用登録時に表示名、メールアドレス、楽器、地域等の情報を収集します。また、投稿された演奏音声、画像、コメント等のコンテンツ情報を保存します。</p>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">2. 情報の利用目的</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>本サービスの提供・運営</li>
            <li>ユーザーサポート</li>
            <li>サービス改善のための分析</li>
            <li>重要なお知らせの送信</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">3. 情報の公開範囲</h2>
          <p>ユーザーが公開設定にした投稿・演奏・プロフィール情報は、他のユーザーに公開されます。非公開設定の演奏音声・画像は、本人のみ閲覧可能です。</p>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">4. 情報の管理</h2>
          <p>本サービスは、ユーザーの個人情報を適切に管理し、不正アクセス、紛失、漏洩等を防止するための合理的な安全対策を実施します。</p>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">5. 第三者提供</h2>
          <p>本サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>サービス運営に必要な外部サービス（決済、ストレージ等）への提供</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-base font-semibold text-ink-900 mb-2">6. アカウント削除</h2>
          <p>ユーザーはいつでもアカウントを削除できます。アカウント削除後、一定期間を経て投稿データおよび個人情報は削除されます。</p>
        </section>
        <p className="text-xs text-ink-400 pt-4 border-t border-ink-100">2026年9月30日 制定</p>
      </div>
    </div>
  );
}
