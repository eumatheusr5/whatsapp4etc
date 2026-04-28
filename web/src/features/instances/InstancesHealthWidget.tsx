import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { formatPhone, formatRelative, cn } from '../../lib/format';
import { Card, Badge, EmptyState } from '../../components/ui';
import {
  getInstanceStatus,
  translateDisconnectReason,
  getHealthEvent,
  formatHealthEventDetail,
} from '../../lib/labels';

interface InstanceRow {
  id: string;
  name: string;
  status: string;
  phone_number: string | null;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
  disconnect_reason: string | null;
}

export function InstancesHealthWidget() {
  const { data: instances = [], isLoading } = useQuery<InstanceRow[]>({
    queryKey: ['instances-health-widget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instances')
        .select(
          'id, name, status, phone_number, last_connected_at, last_disconnected_at, disconnect_reason',
        )
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  return (
    <Card>
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            Saúde dos números
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Status, eventos recentes e motivos de desconexão.
          </p>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {isLoading ? (
          <p className="text-sm text-text-muted">Carregando…</p>
        ) : instances.length === 0 ? (
          <EmptyState
            title="Nenhum número cadastrado"
            description="Adicione um número em Números para começar."
          />
        ) : (
          <ul className="space-y-2">
            {instances.map((inst) => (
              <InstanceRow key={inst.id} inst={inst} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function InstanceRow({ inst }: { inst: InstanceRow }) {
  const [open, setOpen] = useState(false);
  const status = getInstanceStatus(inst.status);

  return (
    <li className="border border-border rounded-lg overflow-hidden bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-surface-2 text-left"
      >
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', status.dotColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-text truncate">{inst.name}</span>
            <Badge tone={status.tone === 'muted' ? 'neutral' : status.tone} size="xs">
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-text-muted truncate">
            {formatPhone(inst.phone_number) || status.description}
          </p>
        </div>
        <ChevronDown
          className={cn('w-4 h-4 text-text-subtle transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && <InstanceDetail inst={inst} />}
    </li>
  );
}

function InstanceDetail({ inst }: { inst: InstanceRow }) {
  const { data: events = [] } = useQuery({
    queryKey: ['health-events', inst.id],
    queryFn: () =>
      api.get<
        Array<{ id: number; event_type: string; detail: Record<string, unknown>; created_at: string }>
      >(`/instances/${inst.id}/health?limit=10`),
    refetchInterval: 30_000,
  });

  return (
    <div className="border-t border-border bg-surface-2/40 px-3 py-3 space-y-3">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-text-subtle">Última conexão</p>
          <p className="text-text font-medium">
            {inst.last_connected_at ? formatRelative(inst.last_connected_at) : '—'}
          </p>
        </div>
        <div>
          <p className="text-text-subtle">Última desconexão</p>
          <p className="text-text font-medium">
            {inst.last_disconnected_at ? formatRelative(inst.last_disconnected_at) : '—'}
          </p>
        </div>
        {inst.disconnect_reason && (
          <div className="col-span-2">
            <p className="text-text-subtle">Motivo</p>
            <p className="text-warning-fg font-medium">
              {translateDisconnectReason(inst.disconnect_reason)}
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wide text-text-subtle font-semibold mb-1.5">
          Eventos recentes
        </p>
        {events.length === 0 ? (
          <p className="text-xs text-text-subtle">Nenhum evento registrado ainda.</p>
        ) : (
          <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {events.map((e) => {
              const meta = getHealthEvent(e.event_type);
              const detail = formatHealthEventDetail(e.detail);
              return (
                <li key={e.id} className="text-xs flex items-start gap-2">
                  <span className="text-text-subtle shrink-0 tabular-nums">
                    {new Date(e.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <Badge tone={meta.tone === 'muted' ? 'neutral' : meta.tone} size="xs">
                    {meta.label}
                  </Badge>
                  {detail && <span className="text-text-muted truncate">{detail}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
