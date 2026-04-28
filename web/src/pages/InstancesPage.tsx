import { Smartphone } from 'lucide-react';
import { InstancesListTab } from '../features/instances/InstancesListTab';

export function InstancesPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">Números</h1>
            <p className="text-sm text-text-muted mt-0.5">
              Gerencie suas conexões de WhatsApp.
            </p>
          </div>
        </div>

        <InstancesListTab />
      </div>
    </div>
  );
}
