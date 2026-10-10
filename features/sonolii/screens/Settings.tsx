import type { ScreenName } from '../types';
import { ArrowLeft, User, FileText, Crown, Shield, HelpCircle, LogOut, ChevronRight } from 'lucide-react';

interface SettingsProps {
  navigate: (s: ScreenName) => void;
}

export default function Settings({ navigate }: SettingsProps) {
  const sections = [
    {
      title: 'アカウント',
      items: [
        { icon: User, label: 'アカウント設定', desc: 'プロフィール・メール・パスワード・通知', screen: 'accountSettings' as ScreenName },
        { icon: Crown, label: 'サブスクリプション管理', desc: 'プランの確認・変更', screen: 'subscription' as ScreenName },
      ],
    },
    {
      title: 'サポート',
      items: [
        { icon: FileText, label: '利用規約', desc: 'サービス利用に関する規約', screen: 'terms' as ScreenName },
        { icon: Shield, label: 'プライバシーポリシー', desc: '個人情報の取り扱い', screen: 'privacy' as ScreenName },
        { icon: HelpCircle, label: 'ヘルプ・お問い合わせ', desc: 'よくある質問・サポート', screen: 'help' as ScreenName },
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('myPage')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> マイページ
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">設定</h1>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2 px-1">{section.title}</h2>
            <div className="bg-white rounded-2xl border border-ink-100 divide-y divide-ink-50 overflow-hidden">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.screen)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-ink-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-ink-50 flex items-center justify-center flex-shrink-0">
                    <item.icon size={18} className="text-ink-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900">{item.label}</p>
                    <p className="text-xs text-ink-400 mt-0.5">{item.desc}</p>
                  </div>
                  <ChevronRight size={18} className="text-ink-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <h2 className="text-xs font-medium text-ink-400 uppercase tracking-wide mb-2 px-1">その他</h2>
          <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
            <button
              onClick={() => navigate('landing')}
              className="w-full flex items-center gap-3 p-4 hover:bg-ink-50 transition-colors text-left text-burgundy-600"
            >
              <div className="w-9 h-9 rounded-lg bg-burgundy-50 flex items-center justify-center flex-shrink-0">
                <LogOut size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">ログアウト</p>
                <p className="text-xs text-ink-400 mt-0.5">アカウントからログアウトします</p>
              </div>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-ink-300 pt-4">Sonolii v1.0.0</p>
      </div>
    </div>
  );
}
