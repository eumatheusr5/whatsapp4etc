import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { formatRelative, cn } from '../lib/format';

interface InstanceWithEvents {
  id: string;
  name: string;
  status: string;
  phone_number: string | null;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
  disconnect_reason: string | null;
}

export function HealthPage() {
  const { data: instances = [] } = useQuery<InstanceWithEvents[]>({
    queryKey: ['instances-health-page'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instances')
        .select('id, name, status, phone_number, last_connected_at, last_disconnected_at, disconnect_reason');
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-6 h-6" />
        <h1 className="text-2xl font-semibold">Saúde dos números</h1>
      </div>

      {instances.length === 0 ? (
        <div className="text-wa-muted">Nenhum número cadastrado.</div>
      ) : (
        <div className="space-y-4">
          {instances.map((inst) => (
            <InstanceHealthCard key={inst.id} inst={inst} />
          ))}
        </div>
      )}
    </div>
  );
}

function InstanceHealthCard({ inst }: { inst: InstanceWithEvents }) {
  const { data: events = [] } = useQuery({
    queryKey: ['health-events', inst.id],
    queryFn: () =>
      api.get<Array<{ id: number; event_type: string; detail: Record<string, unknown>; created_at: string }>>(
        `/instances/${inst.id}/health?limit=20`,
      ),
    refetchInterval: 30_000,
  });

  const Icon =
    inst.status === 'connected'
      ? CheckCircle
      : inst.status === 'banned' || inst.status === 'disconnected'
        ? XCircle
        : AlertTriangle;
  const color =
    inst.status === 'connected'
      ? 'text-emerald-500'
      : inst.status === 'banned'
        ? 'text-red-500'
        : 'text-amber-500';

  return (
    <div className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark overflow-hidden">
      <div className="flex items-center gap-4 p-4 border-b border-wa-divider dark:border-wa-divider-dark">
        <Icon className={cn('w-7 h-7', color)} />
        <div className="flex-1">
          <h3 className="font-semibold">{inst.name}</h3>
          <p className="text-xs text-wa-muted">{inst.phone_number || 'Sem número'}</p>
        </div>
        <span className={cn('text-sm font-medium uppercase', color)}>{inst.status}</span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4 text-sm border-b border-wa-divider dark:border-wa-divider-dark">
        <div>
          <p className="text-xs text-wa-muted">Última conexão</p>
          <p>{inst.last_connected_at ? formatRelative(inst.last_connected_at) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-wa-muted">Última desconexão</p>
          <p>{inst.last_disconnected_at ? formatRelative(inst.last_disconnected_at) : '—'}</p>
        </div>
        {inst.disconnect_reason && (
          <div className="col-span-2">
            <p className="text-xs text-wa-muted">Motivo da desconexão</p>
            <p className="text-amber-600">{inst.disconnect_reason}</p>
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold text-wa-muted mb-2">EVENTOS RECENTES</p>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-wa-muted">Nenhum evento registrado.</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className="text-xs flex items-center gap-2">
                <span className="text-wa-muted shrink-0">
                  {new Date(e.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                </span>
                <span className="font-mono text-wa-green-dark">{e.event_type}</span>
                {e.detail && Object.keys(e.detail).length > 0 && (
                  <span className="text-wa-muted truncate">
                    {JSON.stringify(e.detail).slice(0, 80)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
