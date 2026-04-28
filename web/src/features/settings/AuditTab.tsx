import { useQuery } from '@tanstack/react-query';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatRelative } from '../../lib/format';
import { Card, CardHeader, CardTitle, CardContent, Badge, EmptyState, Skeleton } from '../../components/ui';

interface AuditRow {
  id: number;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  user?: { full_name: string } | null;
}

const ACTION_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  'contact.update': { label: 'Atualizou contato', tone: 'info' },
  'contact.delete': { label: 'Excluiu contato', tone: 'danger' },
  'conversation.assign': { label: 'Assumiu conversa', tone: 'success' },
  'conversation.release': { label: 'Liberou conversa', tone: 'neutral' },
  'message.delete': { label: 'Apagou mensagem', tone: 'warning' },
  'instance.create': { label: 'Criou número', tone: 'success' },
  'instance.delete': { label: 'Removeu número', tone: 'danger' },
  'tag.create': { label: 'Criou tag', tone: 'info' },
  'tag.delete': { label: 'Removeu tag', tone: 'warning' },
};

function translateAction(action: string) {
  return ACTION_LABELS[action] ?? { label: action, tone: 'neutral' as const };
}

export function AuditTab() {
  const { data, isLoading } = useQuery<AuditRow[]>({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, user_id, action, entity, entity_id, meta, created_at, user:user_id (full_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle description="Registro das principais ações no sistema (últimos 100 eventos).">
          Auditoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="w-7 h-7" />}
            title="Sem eventos ainda"
            description="As ações dos atendentes vão aparecer aqui."
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((row) => {
              const t = translateAction(row.action);
              return (
                <li key={row.id} className="py-2.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-surface-2 text-text-muted inline-flex items-center justify-center shrink-0">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={t.tone} size="sm">
                        {t.label}
                      </Badge>
                      <span className="text-xs text-text-muted">
                        {row.user?.full_name ?? 'Sistema'}
                      </span>
                    </div>
                    {row.meta && Object.keys(row.meta).length > 0 && (
                      <p className="text-xs text-text-subtle mt-1 truncate">
                        {JSON.stringify(row.meta).slice(0, 160)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-text-subtle shrink-0">
                    {formatRelative(row.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
