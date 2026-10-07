import type { User } from '../types';

interface AvatarProps {
  user: User;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
}

const sizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

export default function Avatar({ user, size = 'md', onClick }: AvatarProps) {
  return (
    <img
      src={user.avatarUrl}
      alt={user.name}
      onClick={onClick}
      className={`${sizes[size]} rounded-full object-cover ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all' : ''} ring-1 ring-ink-200`}
    />
  );
}
