import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/format';

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separator?: boolean;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({ trigger, items, align = 'right', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="contents"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[200px] py-1 rounded-lg bg-surface border border-border shadow-pop',
            'animate-scale-in origin-top-right',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((it, idx) => {
            if (it.separator) {
              return <div key={`sep-${idx}`} className="my-1 h-px bg-border" />;
            }
            return (
              <button
                key={it.id}
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  it.onClick?.();
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-sm flex items-center gap-2 text-left transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  it.destructive
                    ? 'text-danger hover:bg-danger-soft'
                    : 'text-text hover:bg-surface-2',
                )}
              >
                {it.icon && <span className="shrink-0">{it.icon}</span>}
                <span className="flex-1 truncate">{it.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
