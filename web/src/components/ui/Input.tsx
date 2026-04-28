import { forwardRef, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/format';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, iconLeft, iconRight, invalid, ...props },
  ref,
) {
  if (iconLeft || iconRight) {
    return (
      <div className="relative">
        {iconLeft && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'h-10 w-full bg-surface text-text placeholder:text-text-subtle',
            'border border-border rounded-lg outline-none transition-colors',
            'focus:border-accent focus:ring-2 focus:ring-accent/20',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            iconLeft ? 'pl-10' : 'pl-3',
            iconRight ? 'pr-10' : 'pr-3',
            'text-sm',
            invalid && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...props}
        />
        {iconRight && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle">
            {iconRight}
          </span>
        )}
      </div>
    );
  }
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full px-3 bg-surface text-text placeholder:text-text-subtle',
        'border border-border rounded-lg outline-none transition-colors',
        'focus:border-accent focus:ring-2 focus:ring-accent/20',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'text-sm',
        invalid && 'border-danger focus:border-danger focus:ring-danger/20',
        className,
      )}
      {...props}
    />
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-3 py-2 bg-surface text-text placeholder:text-text-subtle',
        'border border-border rounded-lg outline-none transition-colors resize-y',
        'focus:border-accent focus:ring-2 focus:ring-accent/20',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'text-sm',
        invalid && 'border-danger focus:border-danger focus:ring-danger/20',
        className,
      )}
      {...props}
    />
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full pl-3 pr-9 bg-surface text-text',
        'border border-border rounded-lg outline-none transition-colors appearance-none',
        'focus:border-accent focus:ring-2 focus:ring-accent/20',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'text-sm cursor-pointer',
        'bg-no-repeat bg-[length:16px] bg-[position:right_12px_center]',
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')]",
        invalid && 'border-danger focus:border-danger focus:ring-danger/20',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-xs font-medium text-text-muted">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
}

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer', disabled && 'opacity-60 cursor-not-allowed')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-surface-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
      {label && <span className="text-sm text-text">{label}</span>}
    </label>
  );
}
