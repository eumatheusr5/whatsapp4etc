import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/format';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-surface rounded-xl border border-border shadow-soft',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('p-4 sm:p-5 flex items-start justify-between gap-3', className)}
      {...props}
    />
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function CardTitle({ children, className, description, action }: CardTitleProps) {
  return (
    <div className="flex-1 min-w-0">
      <h3 className={cn('text-base font-semibold text-text leading-tight', className)}>{children}</h3>
      {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-4 sm:px-5 pb-4 sm:pb-5', className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-4 sm:px-5 py-3 border-t border-border flex items-center justify-end gap-2', className)}
      {...props}
    />
  );
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  accent?: 'accent' | 'info' | 'warning' | 'danger' | 'success';
}

const accentClasses: Record<NonNullable<KpiCardProps['accent']>, string> = {
  accent: 'bg-accent-soft text-accent',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  success: 'bg-success-soft text-success-fg',
};

export function KpiCard({ label, value, hint, icon, trend, accent = 'accent' }: KpiCardProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-text-muted font-medium">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-text mt-1 tabular-nums">{value}</p>
          {hint && <p className="text-xs text-text-subtle mt-1.5">{hint}</p>}
          {trend && (
            <p
              className={cn(
                'text-xs mt-2 inline-flex items-center gap-1 font-medium',
                trend.value > 0 ? 'text-success' : trend.value < 0 ? 'text-danger' : 'text-text-muted',
              )}
            >
              <span>{trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '–'}</span>
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-text-subtle">{trend.label}</span>}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0',
              accentClasses[accent],
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
