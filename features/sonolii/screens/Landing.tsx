import type { ScreenName } from '../types';
import { Music2, Calendar, Users, MessageSquare } from 'lucide-react';

interface LandingProps {
  navigate: (s: ScreenName) => void;
}

export default function Landing({ navigate }: LandingProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <img src="https://images.pexels.com/photos/14719432/pexels-photo-14719432.jpeg?auto=compress&cs=tinysrgb&h=900&w=1600" alt="" className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/60 via-ink-950/80 to-ink-950" />

      <div className="relative max-w-6xl mx-auto px-6 py-16 sm:py-24">
        <nav className="flex items-center justify-between mb-20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center">
              <Music2 size={20} className="text-white" />
            </div>
            <span className="font-serif text-xl font-semibold">Sonolii</span>
          </div>
          <button onClick={() => navigate('auth')} className="text-sm text-ink-200 hover:text-white transition-colors font-medium">
            ログイン
          </button>
        </nav>

        <div className="max-w-2xl animate-slide-up">
          <p className="font-serif text-gold-300 text-lg italic mb-4">クラシック演奏者のためのSNS</p>
          <h1 className="font-serif text-5xl sm:text-7xl font-bold leading-tight mb-6">
            あなたの練習が<br />
            <span className="text-teal-300">音楽</span>になる。
          </h1>
          <p className="text-ink-200 text-lg leading-relaxed mb-10 max-w-xl">
            日々の練習を記録し、演奏を投稿して仲間と語り合う。
            アンサンブルの仲間を見つけ、ともに音楽を深める。
            クラシックを愛するすべての人のためのコミュニティ。
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('auth')}
              className="px-8 py-4 bg-teal-600 text-white rounded-xl text-base font-medium hover:bg-teal-500 transition-colors shadow-lg shadow-teal-600/20"
            >
              始める
            </button>
            <button
              onClick={() => navigate('community')}
              className="px-8 py-4 bg-white/10 backdrop-blur text-white rounded-xl text-base font-medium hover:bg-white/20 transition-colors border border-white/20"
            >
              コミュニティを見る
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-24 max-w-4xl">
          {[
            { icon: Calendar, title: '練習管理', desc: '曲目ごとの練習時間を記録し、成長を可視化' },
            { icon: MessageSquare, title: '演奏投稿', desc: '録音を投稿して、タイムスタンプ付きフィードバック' },
            { icon: Users, title: 'アンサンブル募集', desc: '楽器・地域・レベルで仲間を探せる掲示板' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
              <Icon className="text-teal-300 mb-3" size={24} />
              <h3 className="font-serif text-lg font-semibold mb-2">{title}</h3>
              <p className="text-sm text-ink-300 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
