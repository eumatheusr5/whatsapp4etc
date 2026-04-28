import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui';
import { cn } from '../../lib/format';

export function AppearanceTab() {
  const { theme, set } = useTheme();
  const options = [
    { id: 'light', label: 'Claro', icon: Sun, hint: 'Tema claro com bom contraste para uso diurno.' },
    { id: 'dark', label: 'Escuro', icon: Moon, hint: 'Tema escuro para uso prolongado.' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle description="Personalize o visual da interface.">Aparência</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map(({ id, label, icon: Icon, hint }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                onClick={() => set(id)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  active
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border hover:bg-surface-2 text-text',
                )}
              >
                <Icon className="w-5 h-5 mb-2" />
                <p className="font-semibold">{label}</p>
                <p className={cn('text-xs mt-0.5', active ? 'text-accent/80' : 'text-text-muted')}>
                  {hint}
                </p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
