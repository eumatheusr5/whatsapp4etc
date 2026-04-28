import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Send,
  Inbox,
  MessageCircle,
  TrendingUp,
  UserCog,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { api } from '../lib/api';
import { formatPhone } from '../lib/format';
import { Card, KpiCard, Avatar, Badge, Skeleton, EmptyState, Button } from '../components/ui';
import { InstancesHealthWidget } from '../features/instances/InstancesHealthWidget';

interface OverviewResponse {
  stats: Array<{
    date: string;
    user_id: string | null;
    instance_id: string;
    messages_sent: number;
    messages_received: number;
    conversations_handled: number;
  }>;
  openConversations: number;
  mineConversations: number;
  today: { sent: number; received: number; activeAttendants: number };
}

interface TopContact {
  contact: {
    id: string;
    push_name: string | null;
    custom_name: string | null;
    phone_number: string | null;
    avatar_url: string | null;
  };
  total: number;
}

export function DashboardPage() {
  const { data, isLoading } = useQuery<OverviewResponse>({
    queryKey: ['stats-overview'],
    queryFn: () => api.get<OverviewResponse>('/stats/overview?days=30'),
    staleTime: 60_000,
  });

  const { data: topContacts = [] } = useQuery<TopContact[]>({
    queryKey: ['stats-top-contacts'],
    queryFn: () => api.get<TopContact[]>('/stats/top-contacts?limit=6'),
    staleTime: 5 * 60_000,
  });

  const series = aggregateSeries(data?.stats ?? []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">Início</h1>
            <p className="text-sm text-text-muted mt-0.5">
              Visão geral do atendimento e dos números conectados.
            </p>
          </div>
          <Badge tone="accent" dot>
            Últimos 30 dias
          </Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            label="Enviadas hoje"
            value={isLoading ? '…' : data?.today.sent ?? 0}
            icon={<Send className="w-5 h-5" />}
            accent="accent"
          />
          <KpiCard
            label="Recebidas hoje"
            value={isLoading ? '…' : data?.today.received ?? 0}
            icon={<Inbox className="w-5 h-5" />}
            accent="info"
          />
          <KpiCard
            label="Conversas abertas"
            value={isLoading ? '…' : data?.openConversations ?? 0}
            icon={<MessageCircle className="w-5 h-5" />}
            accent="warning"
          />
          <KpiCard
            label="Atribuídas a você"
            value={isLoading ? '…' : data?.mineConversations ?? 0}
            icon={<UserCog className="w-5 h-5" />}
            accent="success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Gráfico */}
          <Card className="lg:col-span-2 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-text flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  Mensagens por dia
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Últimos 30 dias</p>
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : series.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="w-6 h-6" />}
                title="Sem mensagens ainda"
                description="Quando começar a conversar, os gráficos aparecem aqui."
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={series} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'rgb(var(--text-muted))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'rgb(var(--text-muted))' }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 10,
                      backgroundColor: 'rgb(var(--surface))',
                      border: '1px solid rgb(var(--border))',
                      color: 'rgb(var(--text))',
                    }}
                    labelStyle={{ fontSize: 12, color: 'rgb(var(--text-muted))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    name="Enviadas"
                    stroke="rgb(var(--accent))"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="received"
                    name="Recebidas"
                    stroke="rgb(var(--info))"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Top contatos */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-base font-semibold text-text mb-3">Contatos mais ativos</h3>
            {topContacts.length === 0 ? (
              <p className="text-sm text-text-muted">Sem dados ainda.</p>
            ) : (
              <ul className="space-y-2">
                {topContacts.map((tc) => {
                  const name =
                    tc.contact.custom_name ||
                    tc.contact.push_name ||
                    formatPhone(tc.contact.phone_number) ||
                    'Sem nome';
                  return (
                    <li key={tc.contact.id} className="flex items-center gap-3">
                      <Avatar src={tc.contact.avatar_url} name={name} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{name}</p>
                        <p className="text-xs text-text-subtle truncate">
                          {formatPhone(tc.contact.phone_number)}
                        </p>
                      </div>
                      <Badge tone="accent" size="sm">{tc.total}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to="/contatos" className="mt-4 block">
              <Button variant="secondary" size="sm" fullWidth>
                Ver todos os contatos
              </Button>
            </Link>
          </Card>
        </div>

        {/* Saúde dos Números */}
        <InstancesHealthWidget />
      </div>
    </div>
  );
}

function aggregateSeries(rows: OverviewResponse['stats']) {
  const map = new Map<string, { date: string; sent: number; received: number }>();
  for (const r of rows) {
    const k = r.date;
    if (!map.has(k)) map.set(k, { date: r.date.slice(5), sent: 0, received: 0 });
    const b = map.get(k)!;
    b.sent += r.messages_sent;
    b.received += r.messages_received;
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
