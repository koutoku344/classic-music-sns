import { useState } from 'react';
import type { ScreenName } from '../types';
import { Home, Music2, Calendar, Users, Search, Bell, Mail, User, Settings, LogOut, X } from 'lucide-react';

interface HeaderProps {
  current: ScreenName;
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
  unreadNotifications: number;
  unreadMessages: number;
}

const navItems: { screen: ScreenName; label: string; icon: typeof Home }[] = [
  { screen: 'posts', label: '投稿', icon: Home },
  { screen: 'practice', label: '練習', icon: Calendar },
  { screen: 'recruitment', label: '募集', icon: Users },
  { screen: 'search', label: '検索', icon: Search },
  { screen: 'messages', label: 'メッセージ', icon: Mail },
];

export default function Header({ current, navigate, unreadNotifications, unreadMessages }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (s: ScreenName) => {
    if (s === 'posts') return ['posts', 'postDetail', 'createPost'].includes(current);
    if (s === 'practice') return ['practice', 'practiceDetail', 'createPractice'].includes(current);
    if (s === 'recruitment') return ['recruitment', 'recruitmentDetail', 'createRecruitment'].includes(current);
    if (s === 'search') return ['search'].includes(current);
    if (s === 'messages') return ['messages', 'conversation'].includes(current);
    return false;
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('posts')} className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center shadow-sm group-hover:shadow transition-shadow">
              <Music2 size={20} className="text-white" />
            </div>
            <span className="font-serif text-xl font-semibold text-ink-900 hidden sm:block">Crescendo</span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ screen, label, icon: Icon }) => (
              <button
                key={screen}
                onClick={() => navigate(screen)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(screen) ? 'bg-teal-50 text-teal-700' : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                <Icon size={18} />
                {label}
                {screen === 'messages' && unreadMessages > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-burgundy-500 rounded-full" />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('notifications')}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                current === 'notifications' ? 'bg-teal-50 text-teal-700' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-burgundy-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => navigate('myPage')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                ['myPage', 'repertoire', 'performanceHistory', 'subscription', 'settings'].includes(current) ? 'bg-teal-50 text-teal-700' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              <User size={20} />
            </button>
            <button
              onClick={() => navigate('settings')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                current === 'settings' ? 'bg-teal-50 text-teal-700' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center text-ink-600 hover:bg-ink-50"
            >
              <div className="flex flex-col gap-1">
                <span className="w-5 h-0.5 bg-ink-600" />
                <span className="w-5 h-0.5 bg-ink-600" />
                <span className="w-5 h-0.5 bg-ink-600" />
              </div>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm animate-fade-in" />
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-xl p-4 animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(false)} className="w-10 h-10 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-lg mb-4">
              <X size={20} />
            </button>
            {navItems.map(({ screen, label, icon: Icon }) => (
              <button
                key={screen}
                onClick={() => { navigate(screen); setMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(screen) ? 'bg-teal-50 text-teal-700' : 'text-ink-700 hover:bg-ink-50'
                }`}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
            <div className="border-t border-ink-100 my-2" />
            <button
              onClick={() => { navigate('notifications'); setMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                current === 'notifications' ? 'bg-teal-50 text-teal-700' : 'text-ink-700 hover:bg-ink-50'
              }`}
            >
              <Bell size={20} />
              通知
            </button>
            <button
              onClick={() => { navigate('myPage'); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <User size={20} />
              マイページ
            </button>
            <button
              onClick={() => { navigate('settings'); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <Settings size={20} />
              設定
            </button>
          </div>
        </div>
      )}
    </>
  );
}
