import { MapPin, Users, Music2, Activity, ChevronRight } from 'lucide-react';
import type { Recruitment } from '../types';
import Avatar from './Avatar';

interface RecruitmentCardProps {
  recruitment: Recruitment;
  onClick?: () => void;
  onUserClick?: () => void;
}

export default function RecruitmentCard({ recruitment, onClick, onUserClick }: RecruitmentCardProps) {
  const statusColor = recruitment.status === 'open'
    ? 'bg-sage-100 text-sage-700 border-sage-300'
    : 'bg-ink-100 text-ink-500 border-ink-200';

  return (
    <article
      onClick={onClick}
      className="bg-white rounded-2xl border border-ink-100 p-4 sm:p-5 hover:shadow-md transition-shadow cursor-pointer animate-slide-up"
    >
      <div className="flex items-center gap-3 mb-3">
        <Avatar user={recruitment.user} size="sm" onClick={onUserClick} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-ink-900 text-sm truncate">{recruitment.user.name}</p>
          <p className="text-xs text-ink-400">{recruitment.createdAt}</p>
        </div>
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusColor}`}>
          {recruitment.status === 'open' ? '募集中' : '募集終了'}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3 text-sm">
        <Music2 size={14} className="text-teal-600" />
        <span className="font-serif text-base text-ink-800">
          <span className="italic text-ink-600">{recruitment.piece.composer}</span> / {recruitment.piece.title}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="flex items-center gap-1 px-2.5 py-1 text-xs bg-ink-50 text-ink-600 rounded-lg">
          <Music2 size={12} /> {recruitment.instrument}
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 text-xs bg-ink-50 text-ink-600 rounded-lg">
          <MapPin size={12} /> {recruitment.region}
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 text-xs bg-ink-50 text-ink-600 rounded-lg">
          <Activity size={12} /> {recruitment.level}
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 text-xs bg-teal-50 text-teal-700 rounded-lg">
          <Users size={12} /> {recruitment.purpose}
        </span>
      </div>

      <p className="text-sm text-ink-600 line-clamp-2 leading-relaxed">{recruitment.description}</p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100">
        <span className="text-xs text-ink-400">応募 {recruitment.applicants}件</span>
        <ChevronRight size={16} className="text-ink-300" />
      </div>
    </article>
  );
}
