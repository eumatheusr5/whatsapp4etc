import { useSearchParams } from 'react-router-dom';
import { Smartphone, Activity } from 'lucide-react';
import { cn } from '../lib/format';
import { InstancesListTab } from '../features/instances/InstancesListTab';
import { InstanceHealthTab } from '../features/instances/InstanceHealthTab';

type TabKey = 'lista' | 'saude';
const TABS: Array<{ key: TabKey; label: string; icon: typeof Smartphone }> = [
  { key: 'lista', label: 'Lista', icon: Smartphone },
  { key: 'saude', label: 'Saúde', icon: Activity },
];

export function InstancesPage() {
  const [search, setSearch] = useSearchParams();
  const tab = (search.get('tab') as TabKey) || 'lista';

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Smartphone className="w-6 h-6" />
        <h1 className="text-xl sm:text-2xl font-semibold">Números do WhatsApp</h1>
      </div>

      <div className="flex gap-1 mb-4 border-b border-wa-divider dark:border-wa-divider-dark overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSearch({ tab: key })}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap',
              tab === key
                ? 'border-wa-green-dark text-wa-green-dark dark:text-wa-green font-medium'
                : 'border-transparent text-wa-muted hover:text-wa-text dark:hover:text-wa-text-dark',
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'lista' ? <InstancesListTab /> : <InstanceHealthTab />}
    </div>
  );
}
