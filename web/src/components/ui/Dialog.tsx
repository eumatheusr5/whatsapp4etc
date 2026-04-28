import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/format';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  closeOnOverlay?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export function Dialog({
  open,
  onClose,
  children,
  size = 'md',
  className,
  title,
  description,
  footer,
  closeOnOverlay = true,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative bg-surface text-text rounded-t-2xl sm:rounded-2xl shadow-pop-lg',
          'w-full sm:w-auto animate-slide-up sm:animate-scale-in',
          'max-h-[92dvh] flex flex-col overflow-hidden',
          sizes[size],
          className,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border">
            <div className="min-w-0">
              {title && <h2 className="text-base sm:text-lg font-semibold text-text">{title}</h2>}
              {description && <p className="text-sm text-text-muted mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="shrink-0 w-8 h-8 rounded-md text-text-muted hover:bg-surface-2 inline-flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
        {footer && (
          <div className="px-4 sm:px-5 py-3 border-t border-border flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 bg-surface-2/50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
