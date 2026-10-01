import { useState } from 'react';
import type { ScreenName } from '../types';
import { Music2, Mail, Lock, ArrowRight } from 'lucide-react';

interface AuthProps {
  navigate: (s: ScreenName) => void;
}

export default function Auth({ navigate }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block w-1/2 relative">
        <img src="https://images.pexels.com/photos/19541583/pexels-photo-19541583.jpeg?auto=compress&cs=tinysrgb&h=1200&w=900" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-ink-950/60" />
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <p className="font-serif text-3xl text-white italic leading-relaxed mb-4">
            "音楽は魂の言葉であり、<br />言葉では表現できないものを語る"
          </p>
          <p className="text-ink-300 text-sm">— Henry Wadsworth Longfellow</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-ink-50">
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex items-center gap-2 mb-10 justify-center">
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
              <Music2 size={22} className="text-white" />
            </div>
            <span className="font-serif text-2xl font-semibold text-ink-900">Crescendo</span>
          </div>

          <div className="bg-white rounded-2xl border border-ink-100 p-8 shadow-sm">
            <div className="flex gap-1 mb-6 bg-ink-50 rounded-xl p-1">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === 'login' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
              >
                ログイン
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${mode === 'register' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
              >
                新規登録
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); navigate('posts'); }} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">ユーザー名</label>
                  <input
                    type="text"
                    placeholder="表示名を入力"
                    className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">メールアドレス</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">パスワード</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="password"
                    placeholder="6文字以上"
                    className="w-full pl-10 pr-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">楽器</label>
                  <select className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                    <option>Piano</option>
                    <option>Violin</option>
                    <option>Cello</option>
                    <option>Flute</option>
                    <option>その他</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {mode === 'login' ? 'ログイン' : '登録する'}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-ink-400 mt-6">
            ログインすることで利用規約とプライバシーポリシーに同意します
          </p>
        </div>
      </div>
    </div>
  );
}
