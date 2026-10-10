import type { Trophy, TrophyType, TrophyRank } from '../types';
import { Award, BookOpen, MessageCircle } from 'lucide-react';

export const trophyTypeLabels: Record<TrophyType, string> = {
  expression: '発信',
  exploration: '探求',
  connection: '交流',
};

export const trophyRankLabels: Record<TrophyRank, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};

const rankOrder: Record<TrophyRank, number> = {
  bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4,
};

const trophyTypeIcon: Record<TrophyType, typeof Award> = {
  expression: Award,
  exploration: BookOpen,
  connection: MessageCircle,
};

const rankColors: Record<TrophyRank, { bg: string; border: string; text: string; icon: string; gradient: string }> = {
  bronze: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', icon: 'text-amber-600', gradient: 'from-amber-200 to-amber-400' },
  silver: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-600', icon: 'text-slate-500', gradient: 'from-slate-200 to-slate-400' },
  gold: { bg: 'bg-gold-50', border: 'border-gold-300', text: 'text-gold-700', icon: 'text-gold-600', gradient: 'from-gold-200 to-gold-400' },
  platinum: { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', icon: 'text-cyan-600', gradient: 'from-cyan-200 to-cyan-400' },
  diamond: { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700', icon: 'text-teal-600', gradient: 'from-teal-200 to-teal-500' },
};

export function getTopTrophy(trophies: Trophy[]): Trophy | null {
  if (!trophies || trophies.length === 0) return null;
  const priority: TrophyType[] = ['expression', 'exploration', 'connection'];
  let best: Trophy | null = null;
  for (const t of priority) {
    const trophy = trophies.find((tr) => tr.type === t);
    if (!trophy) continue;
    if (!best || rankOrder[trophy.rank] > rankOrder[best.rank]) {
      best = trophy;
    }
  }
  return best;
}

interface TrophyBadgeProps {
  trophy: Trophy;
  size?: 'xs' | 'sm' | 'md';
  showTooltip?: boolean;
}

export function TrophyBadge({ trophy, size = 'sm', showTooltip = true }: TrophyBadgeProps) {
  const Icon = trophyTypeIcon[trophy.type];
  const colors = rankColors[trophy.rank];
  const sizes = {
    xs: { box: 'w-5 h-5', icon: 12, text: 'text-[10px]' },
    sm: { box: 'w-6 h-6', icon: 14, text: 'text-xs' },
    md: { box: 'w-8 h-8', icon: 16, text: 'text-xs' },
  };
  const s = sizes[size];

  return (
    <span className="relative inline-flex flex-shrink-0 group" title={showTooltip ? `${trophyTypeLabels[trophy.type]} - ${trophyRankLabels[trophy.rank]}` : undefined}>
      <span className={`${s.box} rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center ring-1 ring-white/50 shadow-sm`}>
        <Icon size={s.icon} className="text-white" />
      </span>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-ink-900 text-white text-[10px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {trophyTypeLabels[trophy.type]} - {trophyRankLabels[trophy.rank]}
        </span>
      )}
    </span>
  );
}

interface TrophyCardProps {
  trophy: Trophy;
}

export function TrophyCard({ trophy }: TrophyCardProps) {
  const Icon = trophyTypeIcon[trophy.type];
  const colors = rankColors[trophy.rank];

  return (
    <div className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-4 text-center`}>
      <div className={`mx-auto w-16 h-16 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center ring-2 ring-white/60 shadow-md mb-3`}>
        <Icon size={28} className="text-white" />
      </div>
      <p className="font-serif font-bold text-ink-900 text-sm">{trophyTypeLabels[trophy.type]}</p>
      <p className={`text-xs font-bold ${colors.text} mt-0.5`}>{trophyRankLabels[trophy.rank]} Trophy</p>
      <p className="text-xs text-ink-500 mt-2 leading-relaxed">{trophy.progress}</p>
    </div>
  );
}
