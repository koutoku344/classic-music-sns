import type { ScreenName } from '../types';
import { Check, Crown, Music2, Upload, Users, Zap } from 'lucide-react';

interface SubscriptionProps {
  navigate: (s: ScreenName) => void;
}

export default function Subscription({ navigate }: SubscriptionProps) {
  const plans = [
    {
      name: 'Free',
      price: '¥0',
      period: '/月',
      icon: Music2,
      color: 'ink',
      features: [
        { text: '投稿・閲覧', included: true },
        { text: '練習記録', included: true },
        { text: '募集の閲覧・応募', included: true },
        { text: '音声アップロード 3件/月', included: true },
        { text: 'タイムスタンプコメント', included: false },
        { text: '無制限の音声アップロード', included: false },
      ],
    },
    {
      name: 'Premium',
      price: '¥980',
      period: '/月',
      icon: Crown,
      color: 'gold',
      popular: true,
      features: [
        { text: '投稿・閲覧', included: true },
        { text: '練習記録', included: true },
        { text: '募集の閲覧・応募', included: true },
        { text: '無制限の音声アップロード', included: true },
        { text: 'タイムスタンプコメント', included: true },
        { text: '演奏履歴の無制限保存', included: true },
      ],
    },
    {
      name: 'Ensemble',
      price: '¥1,980',
      period: '/月',
      icon: Users,
      color: 'teal',
      features: [
        { text: 'Premiumの全機能', included: true },
        { text: '募集の優先表示', included: true },
        { text: 'アンサンブルグループ機能', included: true },
        { text: '合同練習スケジュール管理', included: true },
        { text: '録音の品質分析', included: true },
        { text: 'サポート優先対応', included: true },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-10">
        <h1 className="font-serif text-3xl font-bold text-ink-900 mb-3">プランを選択</h1>
        <p className="text-ink-500 text-sm">あなたの音楽活動に合わせたプランをお選びください</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isPopular = plan.popular;
          return (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl border-2 p-6 relative animate-slide-up ${
                isPopular ? 'border-gold-400 shadow-lg shadow-gold-100' : 'border-ink-100'
              }`}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gold-500 text-white text-xs font-medium rounded-full shadow-sm">
                  人気
                </span>
              )}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                plan.color === 'gold' ? 'bg-gold-50 text-gold-600' :
                plan.color === 'teal' ? 'bg-teal-50 text-teal-600' :
                'bg-ink-50 text-ink-500'
              }`}>
                <plan.icon size={24} />
              </div>
              <h2 className="font-serif text-xl font-bold text-ink-900 mb-1">{plan.name}</h2>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-bold text-ink-900">{plan.price}</span>
                <span className="text-sm text-ink-400">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((f) => (
                  <li key={f.text} className={`flex items-center gap-2 text-sm ${f.included ? 'text-ink-700' : 'text-ink-300'}`}>
                    {f.included ? (
                      <Check size={16} className={plan.color === 'gold' ? 'text-gold-600' : plan.color === 'teal' ? 'text-teal-600' : 'text-ink-500'} />
                    ) : (
                      <span className="w-4 h-4 flex items-center justify-center text-ink-300">—</span>
                    )}
                    {f.text}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('myPage')}
                className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                  isPopular ? 'bg-gold-500 text-white hover:bg-gold-600' :
                  plan.color === 'teal' ? 'bg-teal-600 text-white hover:bg-teal-700' :
                  'bg-ink-100 text-ink-700 hover:bg-ink-200'
                }`}
              >
                {plan.name === 'Free' ? '現在のプラン' : 'アップグレード'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
