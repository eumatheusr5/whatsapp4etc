import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/format';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  children: ReactNode;
}

const tones: Record<Tone, { soft: string; dot: string }> = {
  neutral: { soft: 'bg-surface-2 text-text-muted border-border', dot: 'bg-text-subtle' },
  accent: { soft: 'bg-accent-soft text-accent border-accent/20', dot: 'bg-accent' },
  success: { soft: 'bg-success-soft text-success-fg border-success/20', dot: 'bg-success' },
  warning: { soft: 'bg-warning-soft text-warning-fg border-warning/20', dot: 'bg-warning' },
  danger: { soft: 'bg-danger-soft text-danger-fg border-danger/20', dot: 'bg-danger' },
  info: { soft: 'bg-info-soft text-info-fg border-info/20', dot: 'bg-info' },
};

const sizes = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-1',
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
};

export function Badge({ tone = 'neutral', size = 'sm', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        tones[tone].soft,
        sizes[size],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('rounded-full', tones[tone].dot, size === 'xs' ? 'w-1 h-1' : 'w-1.5 h-1.5')} />}
      {children}
    </span>
  );
}

interface CountBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export function CountBadge({ count, max = 99, className }: CountBadgeProps) {
  if (count <= 0) return null;
  const display = count > max ? `${max}+` : String(count);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full',
        'bg-accent text-accent-fg tabular-nums',
        className,
      )}
    >
      {display}
    </span>
  );
}
