import type { ScreenName } from '../types';
import { notifications } from '../data';
import Avatar from '../components/Avatar';
import { Bell, Heart, MessageCircle, UserPlus, Users, Mail } from 'lucide-react';

interface NotificationsProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

const notifIcons = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  recruit: Users,
  message: Mail,
};

export default function Notifications({ navigate }: NotificationsProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-5">通知</h1>

      <div className="bg-white rounded-2xl border border-ink-100 divide-y divide-ink-50">
        {notifications.map((n) => {
          const Icon = notifIcons[n.type] || Bell;
          return (
            <div key={n.id} className={`flex items-center gap-3 p-4 ${!n.read ? 'bg-teal-50/40' : ''}`}>
              <div className="relative flex-shrink-0">
                <Avatar user={n.user} size="md" onClick={() => navigate('userProfile', { id: n.user.id })} />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Icon size={12} className={n.type === 'like' ? 'text-burgundy-500' : n.type === 'follow' ? 'text-teal-600' : 'text-ink-500'} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-700">
                  <span className="font-medium text-ink-900">{n.user.name}</span> {n.text}
                </p>
                <p className="text-xs text-ink-400 mt-0.5">{n.createdAt}</p>
              </div>
              {!n.read && <span className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0" />}
            </div>
          );
        })}
        {notifications.length === 0 && (
          <div className="text-center py-16">
            <Bell size={32} className="mx-auto text-ink-300 mb-2" />
            <p className="text-ink-400 text-sm">通知はありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
