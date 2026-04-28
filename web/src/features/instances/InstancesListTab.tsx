import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, QrCode, Power, RefreshCw, Trash2, LogOut, Smartphone, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { formatPhone, cn } from '../../lib/format';
import { getInstanceStatus } from '../../lib/labels';
import {
  Card,
  Button,
  Badge,
  Dialog,
  ConfirmDialog,
  Input,
  Field,
  EmptyState,
} from '../../components/ui';

interface Instance {
  id: string;
  name: string;
  phone_number: string | null;
  status: 'disconnected' | 'connecting' | 'qr' | 'connected' | 'banned';
  last_qr: string | null;
  last_connected_at: string | null;
}

export function InstancesListTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showQrFor, setShowQrFor] = useState<string | null>(null);
  const [qrData, setQrData] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ kind: 'logout' | 'remove'; inst: Instance } | null>(null);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [editName, setEditName] = useState('');

  const { data: instances = [], isLoading } = useQuery<Instance[]>({
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
        toast.success('Número conectado');
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
      toast.success('Número criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connect = useMutation({
    mutationFn: (id: string) => api.post(`/instances/${id}/connect`),
    onSuccess: (_, id) => {
      setShowQrFor(id);
      toast('Aguardando QR Code…');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.post(`/instances/${id}/disconnect`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] });
      toast.success('Número desconectado');
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
      toast.success('Número removido');
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/instances/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] });
      setEditing(null);
      toast.success('Nome atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-text-muted">
          {instances.length === 0 ? 'Nenhum número cadastrado.' : `${instances.length} número(s) configurado(s).`}
        </p>
        <Button
          variant="primary"
          iconLeft={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreate(true)}
        >
          Adicionar número
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Carregando…</p>
      ) : instances.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Smartphone className="w-7 h-7" />}
            title="Sem números ainda"
            description="Adicione seu primeiro número do WhatsApp para começar."
            action={
              <Button onClick={() => setShowCreate(true)} iconLeft={<Plus className="w-4 h-4" />}>
                Adicionar número
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {instances.map((inst) => {
            const status = getInstanceStatus(inst.status);
            const qr = qrData[inst.id] || inst.last_qr;
            return (
              <Card key={inst.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', status.dotColor)} />
                      <h3 className="font-semibold text-base text-text truncate">{inst.name}</h3>
                    </div>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {inst.phone_number ? formatPhone(inst.phone_number) : 'Sem número associado'}
                    </p>
                    <div className="mt-2">
                      <Badge tone={status.tone === 'muted' ? 'neutral' : status.tone} size="sm">
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-text-muted shrink-0"
                    onClick={() => {
                      setEditing(inst);
                      setEditName(inst.name);
                    }}
                    title="Renomear"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>

                {showQrFor === inst.id && qr && inst.status === 'qr' && (
                  <div className="my-3 flex flex-col items-center bg-surface-2 rounded-lg p-3 border border-border">
                    <img src={qr} alt="QR Code" className="w-44 h-44 sm:w-48 sm:h-48 bg-white p-2 rounded-md" />
                    <p className="text-xs text-text-muted mt-2 text-center">
                      Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                  {inst.status === 'connected' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      iconLeft={<Power className="w-3.5 h-3.5" />}
                      onClick={() => disconnect.mutate(inst.id)}
                      loading={disconnect.isPending}
                    >
                      Desconectar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      iconLeft={<QrCode className="w-3.5 h-3.5" />}
                      onClick={() => connect.mutate(inst.id)}
                      loading={connect.isPending}
                    >
                      Conectar
                    </Button>
                  )}
                  {inst.status === 'connected' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={() => connect.mutate(inst.id)}
                      title="Reiniciar sessão"
                    >
                      Reiniciar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    iconLeft={<LogOut className="w-3.5 h-3.5" />}
                    onClick={() => setConfirm({ kind: 'logout', inst })}
                    title="Encerrar sessão (apaga credenciais)"
                  >
                    Sair
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-danger ml-auto"
                    onClick={() => setConfirm({ kind: 'remove', inst })}
                    title="Remover número"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        size="sm"
        title="Adicionar número"
        description="Dê um nome para identificar este número (ex: Vendas SP, Suporte)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button form="create-instance-form" type="submit" loading={create.isPending}>
              Criar
            </Button>
          </>
        }
      >
        <form
          id="create-instance-form"
          className="p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value.trim();
            if (name) create.mutate(name);
          }}
        >
          <Field label="Nome do número">
            <Input name="name" autoFocus placeholder="Ex: Vendas SP" />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        size="sm"
        title="Renomear número"
        description="Atualize o nome para identificar melhor este número."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const trimmed = editName.trim();
                if (editing && trimmed && trimmed !== editing.name) {
                  rename.mutate({ id: editing.id, name: trimmed });
                } else {
                  setEditing(null);
                }
              }}
              loading={rename.isPending}
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className="p-4 sm:p-5">
          <Field label="Nome do número">
            <Input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = editName.trim();
                  if (editing && trimmed && trimmed !== editing.name) {
                    rename.mutate({ id: editing.id, name: trimmed });
                  }
                }
              }}
            />
          </Field>
        </div>
      </Dialog>

      {confirm && (
        <ConfirmDialog
          open
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.kind === 'logout') await logout.mutateAsync(confirm.inst.id);
            else await remove.mutateAsync(confirm.inst.id);
            setConfirm(null);
          }}
          title={confirm.kind === 'logout' ? 'Encerrar sessão?' : 'Remover número?'}
          description={
            confirm.kind === 'logout'
              ? `Vai apagar as credenciais de "${confirm.inst.name}". Você precisará escanear o QR novamente para reconectar.`
              : `Vai remover o número "${confirm.inst.name}". As conversas e mensagens são preservadas.`
          }
          confirmLabel={confirm.kind === 'logout' ? 'Encerrar sessão' : 'Remover'}
          tone={confirm.kind === 'logout' ? 'warning' : 'danger'}
        />
      )}
    </>
  );
}
