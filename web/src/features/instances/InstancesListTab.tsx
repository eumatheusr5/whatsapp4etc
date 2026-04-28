import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, QrCode, Power, RefreshCw, Trash2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { cn, formatPhone } from '../../lib/format';

interface Instance {
  id: string;
  name: string;
  phone_number: string | null;
  status: 'disconnected' | 'connecting' | 'qr' | 'connected' | 'banned';
  last_qr: string | null;
  last_connected_at: string | null;
}

const STATUS_LABEL: Record<Instance['status'], { label: string; color: string }> = {
  disconnected: { label: 'Desconectado', color: 'bg-gray-400' },
  connecting: { label: 'Conectando', color: 'bg-yellow-400' },
  qr: { label: 'Aguardando QR', color: 'bg-orange-400' },
  connected: { label: 'Conectado', color: 'bg-emerald-500' },
  banned: { label: 'Banido', color: 'bg-red-500' },
};

export function InstancesListTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showQrFor, setShowQrFor] = useState<string | null>(null);
  const [qrData, setQrData] = useState<Record<string, string>>({});

  const { data: instances = [] } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: () => api.get<Instance[]>('/instances'),
    staleTime: 30_000,
  });

  useEffect(() => {
    let cancelled = false;
    let sock: Awaited<ReturnType<typeof getSocket>> | null = null;
    void (async () => {
      sock = await getSocket();
      if (cancelled) return;
      sock.on('instance:qr', (p: { instanceId: string; qr: string }) => {
        setQrData((m) => ({ ...m, [p.instanceId]: p.qr }));
      });
      sock.on('instance:status_changed', () => {
        qc.invalidateQueries({ queryKey: ['instances'] });
      });
      sock.on('instance:connected', () => {
        qc.invalidateQueries({ queryKey: ['instances'] });
        setShowQrFor(null);
        toast.success('Número conectado!');
      });
    })();
    return () => {
      cancelled = true;
      if (sock) {
        sock.off('instance:qr');
        sock.off('instance:status_changed');
        sock.off('instance:connected');
      }
    };
  }, [qc]);

  const create = useMutation({
    mutationFn: (name: string) => api.post<Instance>('/instances', { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] });
      setShowCreate(false);
      toast.success('Instância criada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connect = useMutation({
    mutationFn: (id: string) => api.post(`/instances/${id}/connect`),
    onSuccess: (_, id) => {
      setShowQrFor(id);
      toast('Aguardando QR Code...');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.post(`/instances/${id}/disconnect`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] });
      toast.success('Desconectado');
    },
  });

  const logout = useMutation({
    mutationFn: (id: string) => api.post(`/instances/${id}/logout`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] });
      toast.success('Sessão encerrada');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/instances/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] });
      toast.success('Instância removida');
    },
  });

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Adicionar número
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="bg-white dark:bg-wa-bubble-dark rounded-xl p-10 text-center text-wa-muted border border-wa-divider dark:border-wa-divider-dark">
          Nenhum número cadastrado. Clique em &quot;Adicionar número&quot; para começar.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((inst) => {
            const meta = STATUS_LABEL[inst.status];
            const qr = qrData[inst.id] || inst.last_qr;
            return (
              <div
                key={inst.id}
                className="bg-white dark:bg-wa-bubble-dark rounded-xl p-4 sm:p-5 border border-wa-divider dark:border-wa-divider-dark"
              >
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg truncate">{inst.name}</h3>
                    <p className="text-sm text-wa-muted truncate">
                      {inst.phone_number ? formatPhone(inst.phone_number) : '—'}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                    <span className={cn('w-2 h-2 rounded-full', meta.color)} />
                    {meta.label}
                  </span>
                </div>

                {showQrFor === inst.id && qr && inst.status === 'qr' && (
                  <div className="my-3 flex flex-col items-center bg-wa-panel dark:bg-wa-chat-dark rounded-lg p-3">
                    <img src={qr} alt="QR Code" className="w-44 h-44 sm:w-48 sm:h-48" />
                    <p className="text-xs text-wa-muted mt-2 text-center">
                      Abra o WhatsApp no celular &gt; Aparelhos conectados &gt; Conectar aparelho
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {inst.status === 'connected' ? (
                    <button
                      onClick={() => disconnect.mutate(inst.id)}
                      className="btn-secondary text-xs"
                      disabled={disconnect.isPending}
                    >
                      <Power className="w-3.5 h-3.5" /> Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={() => connect.mutate(inst.id)}
                      className="btn-primary text-xs"
                      disabled={connect.isPending}
                    >
                      <QrCode className="w-3.5 h-3.5" /> Conectar
                    </button>
                  )}
                  {inst.status === 'connected' && (
                    <button
                      onClick={() => connect.mutate(inst.id)}
                      className="btn-secondary text-xs"
                      title="Reiniciar sessão"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Encerrar sessão de "${inst.name}"? Será necessário escanear novo QR.`,
                        )
                      ) {
                        logout.mutate(inst.id);
                      }
                    }}
                    className="btn-secondary text-xs text-amber-600"
                    title="Logout (apaga sessão)"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remover "${inst.name}"? As conversas serão preservadas.`)) {
                        remove.mutate(inst.id);
                      }
                    }}
                    className="btn-secondary text-xs text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateInstanceModal
          onClose={() => setShowCreate(false)}
          onSubmit={(name) => create.mutate(name)}
        />
      )}
    </>
  );
}

function CreateInstanceModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white dark:bg-wa-panel-dark rounded-xl p-6 w-full max-w-md animate-slide-up">
        <h2 className="text-lg font-semibold mb-4">Adicionar número</h2>
        <input
          autoFocus
          className="input mb-4"
          placeholder='Ex: "Vendas SP", "Suporte"'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim())}
            className="btn-primary"
            disabled={!name.trim()}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
