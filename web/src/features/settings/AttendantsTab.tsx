import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Save, ShieldCheck, ShieldOff, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

interface Attendant {
  id: string;
  email: string | null;
  full_name: string;
  role: 'admin' | 'atendente';
  avatar_url: string | null;
  is_active: boolean;
  is_online: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export function AttendantsTab({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery<Attendant[]>({
    queryKey: ['users-list'],
    queryFn: () => api.get<Attendant[]>('/users'),
  });

  const [showCreate, setShowCreate] = useState(false);

  const create = useMutation({
    mutationFn: (input: { email: string; password: string; fullName: string; role: 'admin' | 'atendente' }) =>
      api.post('/users', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-list'] });
      setShowCreate(false);
      toast.success('Atendente criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; fullName?: string; role?: 'admin' | 'atendente'; isActive?: boolean }) =>
      api.patch(`/users/${input.id}`, {
        fullName: input.fullName,
        role: input.role,
        isActive: input.isActive,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-list'] });
      toast.success('Atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <UserPlus className="w-4 h-4" /> Novo atendente
        </button>
      </div>

      <section className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-wa-muted">Carregando...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-wa-muted">Nenhum atendente cadastrado.</div>
        ) : (
          <ul className="divide-y divide-wa-divider dark:divide-wa-divider-dark">
            {list.map((u) => (
              <AttendantRow
                key={u.id}
                user={u}
                isMe={u.id === currentUserId}
                onUpdate={(input) => update.mutate({ id: u.id, ...input })}
              />
            ))}
          </ul>
        )}
      </section>

      {showCreate && (
        <CreateAttendantModal
          onClose={() => setShowCreate(false)}
          onSubmit={(input) => create.mutate(input)}
          submitting={create.isPending}
        />
      )}
    </div>
  );
}

function AttendantRow({
  user,
  isMe,
  onUpdate,
}: {
  user: Attendant;
  isMe: boolean;
  onUpdate: (input: { fullName?: string; role?: 'admin' | 'atendente'; isActive?: boolean }) => void;
}) {
  const [name, setName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const dirty = name !== user.full_name || role !== user.role;

  const initials = (user.full_name || user.email || '?').slice(0, 2).toUpperCase();

  return (
    <li className="p-3 sm:p-4 flex flex-wrap items-center gap-3">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.full_name} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-sm">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-[180px]">
        <input
          className="input text-sm mb-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        <div className="text-xs text-wa-muted truncate">{user.email}</div>
      </div>
      <select
        className="input max-w-[140px] text-sm"
        value={role}
        onChange={(e) => setRole(e.target.value as 'admin' | 'atendente')}
        disabled={isMe}
        title={isMe ? 'Você não pode alterar sua própria função' : undefined}
      >
        <option value="atendente">Atendente</option>
        <option value="admin">Admin</option>
      </select>
      <span
        className={
          'text-xs px-2 py-1 rounded-full whitespace-nowrap ' +
          (user.is_active
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300')
        }
      >
        {user.is_active ? (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Ativo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <ShieldOff className="w-3 h-3" /> Inativo
          </span>
        )}
      </span>
      <div className="flex gap-1">
        <button
          className="btn-secondary text-xs"
          disabled={!dirty}
          onClick={() => onUpdate({ fullName: name.trim(), role })}
        >
          <Save className="w-3.5 h-3.5" />
        </button>
        {!isMe && (
          <button
            className={
              'btn-secondary text-xs ' + (user.is_active ? 'text-red-500' : 'text-emerald-600')
            }
            onClick={() => {
              const action = user.is_active ? 'desativar' : 'reativar';
              if (confirm(`${action[0].toUpperCase() + action.slice(1)} ${user.full_name}?`)) {
                onUpdate({ isActive: !user.is_active });
              }
            }}
            title={user.is_active ? 'Desativar' : 'Reativar'}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

function CreateAttendantModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (input: { email: string; password: string; fullName: string; role: 'admin' | 'atendente' }) => void;
  submitting: boolean;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'atendente'>('atendente');

  const valid = fullName.trim().length >= 2 && email.includes('@') && password.length >= 6;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white dark:bg-wa-panel-dark rounded-xl p-5 sm:p-6 w-full max-w-md animate-slide-up space-y-3">
        <h2 className="text-lg font-semibold">Novo atendente</h2>
        <input
          className="input"
          placeholder="Nome completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="input"
          placeholder="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder="Senha (mín. 6 caracteres)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'atendente')}
        >
          <option value="atendente">Atendente</option>
          <option value="admin">Administrador</option>
        </select>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!valid || submitting}
            onClick={() => onSubmit({ fullName: fullName.trim(), email: email.trim(), password, role })}
          >
            {submitting ? 'Criando...' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}
