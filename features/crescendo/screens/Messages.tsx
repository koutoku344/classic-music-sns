import type { ScreenName } from '../types';
import { conversations } from '../data';
import Avatar from '../components/Avatar';
import { Mail, Search as SearchIcon } from 'lucide-react';

interface MessagesProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

export default function Messages({ navigate }: MessagesProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-5">メッセージ</h1>

      <div className="relative mb-4">
        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          placeholder="会話を検索..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      <div className="space-y-2">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => navigate('conversation', { id: conv.id })}
            className="w-full bg-white rounded-xl border border-ink-100 p-4 flex items-center gap-3 hover:shadow-sm transition-shadow text-left animate-slide-up"
          >
            <div className="relative">
              <Avatar user={conv.user} size="md" />
              {conv.unread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-burgundy-500 rounded-full ring-2 ring-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className={`font-medium text-sm ${conv.unread ? 'text-ink-900' : 'text-ink-700'}`}>{conv.user.name}</p>
                <p className="text-xs text-ink-400 flex-shrink-0">{conv.lastUpdated}</p>
              </div>
              <p className={`text-sm truncate ${conv.unread ? 'text-ink-700 font-medium' : 'text-ink-500'}`}>{conv.lastMessage}</p>
            </div>
          </button>
        ))}
      </div>

      {conversations.length === 0 && (
        <div className="text-center py-20">
          <Mail size={40} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-400">まだメッセージがありません</p>
        </div>
      )}
    </div>
  );
}
