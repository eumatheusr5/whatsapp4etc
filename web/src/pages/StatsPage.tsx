import { useQuery } from '@tanstack/react-query';
import { BarChart3, MessageCircle, Users, Activity } from 'lucide-react';
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

interface OverviewResponse {
  stats: Array<{
    date: string;
    user_id: string;
    instance_id: string;
    messages_sent: number;
    messages_received: number;
    conversations_handled: number;
  }>;
  openConversations: number;
}

export function StatsPage() {
  const { data, isLoading } = useQuery<OverviewResponse>({
    queryKey: ['stats-overview'],
    queryFn: () => api.get<OverviewResponse>('/stats/overview?days=30'),
  });

  const byDate = aggregate(data?.stats ?? []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6" />
        <h1 className="text-2xl font-semibold">Estatísticas</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card icon={MessageCircle} label="Enviadas hoje" value={(byDate.todaySent || 0).toString()} />
        <Card icon={MessageCircle} label="Recebidas hoje" value={(byDate.todayRecv || 0).toString()} />
        <Card icon={Activity} label="Conversas em aberto" value={(data?.openConversations ?? 0).toString()} />
        <Card icon={Users} label="Atendentes ativos hoje" value={byDate.activeAttendants.toString()} />
      </div>

      <div className="bg-white dark:bg-wa-bubble-dark rounded-xl p-4 border border-wa-divider dark:border-wa-divider-dark">
        <h3 className="font-semibold mb-3">Mensagens nos últimos 30 dias</h3>
        {isLoading ? (
          <div className="h-72 animate-pulse bg-wa-divider dark:bg-wa-divider-dark rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={byDate.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sent" name="Enviadas" stroke="#00a884" strokeWidth={2} />
              <Line type="monotone" dataKey="received" name="Recebidas" stroke="#075e54" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white dark:bg-wa-bubble-dark rounded-xl p-4 border border-wa-divider dark:border-wa-divider-dark">
      <div className="flex items-center gap-2 text-wa-muted text-xs mb-1">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function aggregate(rows: OverviewResponse['stats']) {
  const today = new Date().toISOString().slice(0, 10);
  const map = new Map<string, { date: string; sent: number; received: number }>();
  const attendants = new Set<string>();
  let todaySent = 0;
  let todayRecv = 0;
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, { date: r.date.slice(5), sent: 0, received: 0 });
    const bucket = map.get(r.date)!;
    bucket.sent += r.messages_sent;
    bucket.received += r.messages_received;
    if (r.date === today) {
      todaySent += r.messages_sent;
      todayRecv += r.messages_received;
      attendants.add(r.user_id);
    }
  }
  const series = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { series, todaySent, todayRecv, activeAttendants: attendants.size };
}
