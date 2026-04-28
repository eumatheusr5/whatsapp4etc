import { ReactNode, useId } from 'react';
import { cn } from '../../lib/format';

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill' | 'segmented';
  size?: 'sm' | 'md';
  className?: string;
  fullWidth?: boolean;
}

export function Tabs({ items, value, onChange, variant = 'underline', size = 'md', className, fullWidth }: TabsProps) {
  const groupId = useId();

  if (variant === 'pill') {
    return (
      <div role="tablist" className={cn('flex flex-wrap gap-1.5', className)}>
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              role="tab"
              aria-selected={active}
              disabled={it.disabled}
              onClick={() => onChange(it.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full transition-colors',
                size === 'sm' ? 'h-7 px-3 text-xs' : 'h-9 px-4 text-sm',
                active
                  ? 'bg-accent text-accent-fg shadow-soft'
                  : 'text-text-muted hover:bg-surface-2',
                it.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {it.icon}
              {it.label}
              {it.badge}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'segmented') {
    return (
      <div role="tablist" className={cn('inline-flex items-center bg-surface-2 rounded-lg p-1', className)}>
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              role="tab"
              aria-selected={active}
              disabled={it.disabled}
              onClick={() => onChange(it.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md transition-colors font-medium',
                size === 'sm' ? 'h-7 px-3 text-xs' : 'h-9 px-4 text-sm',
                active
                  ? 'bg-surface text-text shadow-soft'
                  : 'text-text-muted hover:text-text',
                it.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {it.icon}
              {it.label}
              {it.badge}
            </button>
          );
        })}
      </div>
    );
  }

  // underline
  return (
    <div role="tablist" className={cn('flex border-b border-border overflow-x-auto scrollbar-none', className)}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={`${groupId}-${it.id}`}
            role="tab"
            aria-selected={active}
            disabled={it.disabled}
            onClick={() => onChange(it.id)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap font-medium transition-colors border-b-2 -mb-px',
              size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
              fullWidth && 'flex-1 justify-center',
              active
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text',
              it.disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {it.icon}
            {it.label}
            {it.badge}
          </button>
        );
      })}
    </div>
  );
}
