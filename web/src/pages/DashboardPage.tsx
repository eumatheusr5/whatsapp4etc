import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Send,
  Inbox,
  Users,
  MessageCircle,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { api } from '../lib/api';
import { formatPhone } from '../lib/format';

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-6 h-6" />
        <h1 className="text-xl sm:text-2xl font-semibold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card icon={Send} label="Enviadas hoje" value={data?.today.sent ?? 0} accent="text-emerald-500" />
        <Card icon={Inbox} label="Recebidas hoje" value={data?.today.received ?? 0} accent="text-blue-500" />
        <Card
          icon={MessageCircle}
          label="Conversas abertas"
          value={data?.openConversations ?? 0}
          accent="text-amber-500"
        />
        <Card
          icon={Users}
          label="Atribuídas a você"
          value={data?.mineConversations ?? 0}
          accent="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-wa-bubble-dark rounded-xl p-3 sm:p-4 border border-wa-divider dark:border-wa-divider-dark">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Mensagens nos últimos 30 dias
            </h3>
          </div>
          {isLoading ? (
            <div className="h-72 animate-pulse bg-wa-divider dark:bg-wa-divider-dark rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="sent"
                  name="Enviadas"
                  stroke="#00a884"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="received"
                  name="Recebidas"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-wa-bubble-dark rounded-xl p-3 sm:p-4 border border-wa-divider dark:border-wa-divider-dark">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Contatos mais ativos
          </h3>
          {topContacts.length === 0 ? (
            <p className="text-sm text-wa-muted">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2">
              {topContacts.map((tc) => (
                <li key={tc.contact.id} className="flex items-center gap-3">
                  {tc.contact.avatar_url ? (
                    <img
                      src={tc.contact.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-xs">
                      {(tc.contact.custom_name || tc.contact.push_name || '?')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {tc.contact.custom_name ||
                        tc.contact.push_name ||
                        formatPhone(tc.contact.phone_number)}
                    </div>
                    <div className="text-xs text-wa-muted truncate">
                      {formatPhone(tc.contact.phone_number)}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-wa-green-dark">{tc.total}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/contatos"
            className="mt-3 block text-center text-xs text-wa-green-dark hover:underline"
          >
            Ver todos os contatos
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="bg-white dark:bg-wa-bubble-dark rounded-xl p-3 sm:p-4 border border-wa-divider dark:border-wa-divider-dark">
      <div className="flex items-center gap-2 text-wa-muted text-xs mb-1">
        <Icon className={'w-4 h-4 ' + accent} /> <span className="truncate">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-semibold">{value}</div>
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
