import type { ScreenName } from '../types';
import { me } from '../data';
import Avatar from '../components/Avatar';
import { ArrowLeft, Mail, Lock, Bell, Music2, MapPin, Save } from 'lucide-react';

interface AccountSettingsProps {
  navigate: (s: ScreenName) => void;
}

export default function AccountSettings({ navigate }: AccountSettingsProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('settings')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 設定
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">アカウント設定</h1>

      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4">プロフィール</h2>
          <div className="flex items-center gap-4 mb-4">
            <Avatar user={me} size="lg" />
            <button className="px-4 py-2 bg-ink-50 text-ink-700 rounded-lg text-sm font-medium hover:bg-ink-100 transition-colors">
              画像を変更
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">表示名</label>
              <input
                type="text"
                defaultValue={me.name}
                className="w-full px-4 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">自己紹介</label>
              <textarea
                defaultValue={me.bio}
                rows={3}
                className="w-full px-4 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">楽器</label>
                <div className="relative">
                  <Music2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <select className="w-full pl-9 pr-3 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                    <option>Piano</option><option>Violin</option><option>Cello</option><option>Flute</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">地域</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <select className="w-full pl-9 pr-3 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                    <option>東京</option><option>大阪</option><option>神奈川</option><option>京都</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4">メール・パスワード</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">メールアドレス</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  defaultValue="user@example.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">新しいパスワード</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="password"
                  placeholder="変更する場合のみ入力"
                  className="w-full pl-9 pr-3 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4">通知設定</h2>
          <div className="space-y-3">
            {[
              { label: '投稿へのいいね・コメント', desc: 'フィードバックの通知' },
              { label: 'フォロー通知', desc: '新しいフォロワーの通知' },
              { label: '募集への応募', desc: '応募があった際の通知' },
              { label: 'メッセージ', desc: '個人チャットの通知' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-800">{item.label}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{item.desc}</p>
                </div>
                <button className={`relative w-12 h-6 rounded-full transition-colors ${i < 3 ? 'bg-teal-600' : 'bg-ink-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${i < 3 ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm flex items-center justify-center gap-2">
          <Save size={18} /> 保存する
        </button>
      </div>
    </div>
  );
}
