import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Save, Trash2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

interface QuickReply {
  id: string;
  user_id: string | null;
  shortcut: string;
  body: string;
  media_url: string | null;
  created_at: string;
  updated_at: string;
}

export function QuickRepliesTab() {
  const qc = useQueryClient();
  const { data: replies = [], isLoading } = useQuery<QuickReply[]>({
    queryKey: ['quick-replies'],
    queryFn: () => api.get<QuickReply[]>('/quick-replies'),
  });

  const [shortcut, setShortcut] = useState('/');
  const [body, setBody] = useState('');
  const [global, setGlobal] = useState(false);

  const create = useMutation({
    mutationFn: () => api.post('/quick-replies', { shortcut, body, global }),
    onSuccess: () => {
      setShortcut('/');
      setBody('');
      setGlobal(false);
      qc.invalidateQueries({ queryKey: ['quick-replies'] });
      toast.success('Resposta rápida criada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; shortcut: string; body: string }) =>
      api.patch(`/quick-replies/${input.id}`, { shortcut: input.shortcut, body: input.body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-replies'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/quick-replies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-replies'] });
      toast.success('Removida');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <section className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark p-4 sm:p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova resposta rápida
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 mb-3">
          <input
            className="input"
            placeholder="/atalho"
            value={shortcut}
            onChange={(e) => {
              const v = e.target.value.startsWith('/') ? e.target.value : '/' + e.target.value;
              setShortcut(v);
            }}
            maxLength={40}
          />
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder="Mensagem que será enviada..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={global}
              onChange={(e) => setGlobal(e.target.checked)}
            />
            <Globe className="w-4 h-4 text-wa-muted" />
            Disponível para toda equipe (somente admins)
          </label>
          <button
            className="btn-primary text-sm"
            disabled={shortcut.length < 2 || !body.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus className="w-4 h-4" /> Criar
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark">
        <div className="p-4 sm:p-6 border-b border-wa-divider dark:border-wa-divider-dark">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Suas respostas rápidas
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-wa-muted">Carregando...</div>
        ) : replies.length === 0 ? (
          <div className="p-6 text-sm text-wa-muted">
            Nenhuma resposta rápida. Use atalhos como{' '}
            <span className="font-mono">/oi</span> ou{' '}
            <span className="font-mono">/horario</span> para acelerar atendimento.
          </div>
        ) : (
          <ul className="divide-y divide-wa-divider dark:divide-wa-divider-dark">
            {replies.map((r) => (
              <ReplyRow
                key={r.id}
                reply={r}
                onSave={(shortcut, body) => update.mutate({ id: r.id, shortcut, body })}
                onDelete={() => {
                  if (confirm(`Remover atalho ${r.shortcut}?`)) remove.mutate(r.id);
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReplyRow({
  reply,
  onSave,
  onDelete,
}: {
  reply: QuickReply;
  onSave: (shortcut: string, body: string) => void;
  onDelete: () => void;
}) {
  const [shortcut, setShortcut] = useState(reply.shortcut);
  const [body, setBody] = useState(reply.body);
  const dirty = shortcut !== reply.shortcut || body !== reply.body;

  return (
    <li className="p-3 sm:p-4 flex flex-col gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2">
        <input
          className="input font-mono text-sm"
          value={shortcut}
          onChange={(e) => {
            const v = e.target.value.startsWith('/') ? e.target.value : '/' + e.target.value;
            setShortcut(v);
          }}
          maxLength={40}
        />
        <textarea
          className="input min-h-[60px] resize-y text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-wa-muted flex items-center gap-1">
          {reply.user_id === null && (
            <>
              <Globe className="w-3 h-3" /> Global
            </>
          )}
        </span>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" disabled={!dirty} onClick={() => onSave(shortcut, body)}>
            <Save className="w-3.5 h-3.5" /> Salvar
          </button>
          <button className="btn-secondary text-xs text-red-500" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
