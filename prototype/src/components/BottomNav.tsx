import type { ScreenName } from '../types';
import { Home, Calendar, Mic, Plus, Search, User } from 'lucide-react';

interface BottomNavProps {
  current: ScreenName;
  navigate: (s: ScreenName) => void;
}

export default function BottomNav({ current, navigate }: BottomNavProps) {
  const items = [
    { screen: 'community' as ScreenName, icon: Home, label: 'コミュニティ' },
    { screen: 'practice' as ScreenName, icon: Calendar, label: '練習' },
    { screen: 'recording' as ScreenName, icon: Mic, label: '録音', primary: true },
    { screen: 'search' as ScreenName, icon: Search, label: '検索' },
    { screen: 'myPage' as ScreenName, icon: User, label: 'マイページ' },
  ];

  const isActive = (s: ScreenName) => {
    if (s === 'community') return ['community', 'posts', 'postDetail', 'createPost', 'recruitmentDetail', 'createRecruitment'].includes(current);
    if (s === 'practice') return ['practice', 'practiceDetail', 'createPractice'].includes(current);
    if (s === 'search') return ['search'].includes(current);
    if (s === 'myPage') return ['myPage', 'repertoire', 'performanceHistory', 'subscription', 'settings'].includes(current);
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-ink-100 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {items.map(({ screen, icon: Icon, label, primary }) =>
          primary ? (
            <button
              key={screen}
              onClick={() => navigate(screen)}
              className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-md hover:bg-teal-700 transition-colors -mt-4"
            >
              <Icon size={22} />
            </button>
          ) : (
            <button
              key={screen}
              onClick={() => navigate(screen)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                isActive(screen) ? 'text-teal-700' : 'text-ink-400'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        )}
      </div>
    </nav>
  );
}
