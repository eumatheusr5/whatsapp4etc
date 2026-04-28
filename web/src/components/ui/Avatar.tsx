import { useMemo } from 'react';
import { cn } from '../../lib/format';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  status?: 'online' | 'offline' | 'busy' | null;
}

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 sm:w-24 sm:h-24 text-2xl',
};

const statusSize = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
};

const palette = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-teal-500',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ src, name, size = 'md', className, status }: AvatarProps) {
  const initials = useMemo(() => getInitials(name), [name]);
  const colorIdx = useMemo(() => (name ? hashString(name) % palette.length : 0), [name]);
  const bgClass = palette[colorIdx];

  return (
    <div className={cn('relative shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name ?? 'Avatar'}
          className={cn('rounded-full object-cover bg-surface-2', sizes[size])}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center text-white font-semibold',
            sizes[size],
            bgClass,
          )}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-surface',
            statusSize[size],
            status === 'online' && 'bg-success',
            status === 'busy' && 'bg-warning',
            status === 'offline' && 'bg-text-subtle',
          )}
        />
      )}
    </div>
  );
}
