import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

interface InstanceRow {
  id: string;
  name: string;
  status: string;
}

export function useInstancesHealth() {
  const { data } = useQuery<InstanceRow[]>({
    queryKey: ['instances-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instances')
        .select('id, name, status');
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const [forceRefresh, setForceRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let sock: Awaited<ReturnType<typeof getSocket>> | null = null;
    void (async () => {
      sock = await getSocket();
      if (cancelled) return;
      sock.on('instance:status_changed', () => setForceRefresh((x) => x + 1));
    })();
    return () => {
      cancelled = true;
      sock?.off('instance:status_changed');
    };
  }, []);

  void forceRefresh;
  const issues = (data ?? []).filter(
    (i) => i.status === 'disconnected' || i.status === 'banned' || i.status === 'qr',
  );
  if (issues.length === 0) return { hasIssue: false, message: '' };

  const banned = issues.filter((i) => i.status === 'banned');
  if (banned.length > 0) {
    return {
      hasIssue: true,
      message: `Atenção: ${banned.map((i) => i.name).join(', ')} ${
        banned.length === 1 ? 'foi' : 'foram'
      } banido(s) do WhatsApp.`,
    };
  }

  const names = issues.map((i) => i.name).join(', ');
  return {
    hasIssue: true,
    message: `${issues.length} número(s) com problema: ${names}`,
  };
}
