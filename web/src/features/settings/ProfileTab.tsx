import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Save, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

interface MeResponse {
  id: string;
  full_name: string;
  role: 'admin' | 'atendente';
  avatar_url: string | null;
  email: string | null;
}

export function ProfileTab() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me-profile'],
    queryFn: () => api.get<MeResponse>('/users/me'),
  });

  const [fullName, setFullName] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');

  useEffect(() => {
    if (me) setFullName(me.full_name);
  }, [me]);

  const saveProfile = useMutation({
    mutationFn: (input: { fullName: string }) => api.patch('/users/me', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-profile'] });
      toast.success('Perfil atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.postForm<{ avatar_url: string }>('/users/me/avatar', fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-profile'] });
      toast.success('Foto atualizada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePwd = useMutation({
    mutationFn: () => api.post('/users/me/password', { newPassword: newPwd }),
    onSuccess: () => {
      setNewPwd('');
      setNewPwd2('');
      toast.success('Senha alterada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (me?.full_name || me?.email || '??').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark p-4 sm:p-6">
        <h2 className="font-semibold mb-4">Foto e dados pessoais</h2>
        <div className="flex items-center gap-4 mb-4">
          {me?.avatar_url ? (
            <img
              src={me.avatar_url}
              alt={me.full_name}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-2xl font-medium">
              {initials}
            </div>
          )}
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar.mutate(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="btn-secondary text-sm"
              disabled={uploadAvatar.isPending}
            >
              <Camera className="w-4 h-4" />
              {uploadAvatar.isPending ? 'Enviando...' : 'Alterar foto'}
            </button>
            <p className="text-xs text-wa-muted mt-1">PNG, JPG ou WebP até 5MB</p>
          </div>
        </div>

        <label className="block text-xs font-medium text-wa-muted mb-1">Nome</label>
        <input
          className="input mb-3"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={120}
        />

        <label className="block text-xs font-medium text-wa-muted mb-1">E-mail</label>
        <input className="input mb-3 opacity-60" value={me?.email ?? ''} disabled />

        <label className="block text-xs font-medium text-wa-muted mb-1">Função</label>
        <input
          className="input mb-4 opacity-60"
          value={me?.role === 'admin' ? 'Administrador' : 'Atendente'}
          disabled
        />

        <button
          className="btn-primary text-sm"
          disabled={saveProfile.isPending || !fullName.trim()}
          onClick={() => saveProfile.mutate({ fullName: fullName.trim() })}
        >
          <Save className="w-4 h-4" /> Salvar alterações
        </button>
      </section>

      <section className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark p-4 sm:p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Alterar senha
        </h2>
        <label className="block text-xs font-medium text-wa-muted mb-1">Nova senha</label>
        <input
          type="password"
          className="input mb-3"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          minLength={6}
        />
        <label className="block text-xs font-medium text-wa-muted mb-1">Confirmar nova senha</label>
        <input
          type="password"
          className="input mb-4"
          value={newPwd2}
          onChange={(e) => setNewPwd2(e.target.value)}
          minLength={6}
        />
        <button
          className="btn-primary text-sm"
          disabled={
            changePwd.isPending ||
            newPwd.length < 6 ||
            newPwd !== newPwd2
          }
          onClick={() => changePwd.mutate()}
        >
          {changePwd.isPending ? 'Alterando...' : 'Alterar senha'}
        </button>
        {newPwd && newPwd2 && newPwd !== newPwd2 && (
          <p className="text-xs text-red-500 mt-2">As senhas não coincidem.</p>
        )}
      </section>
    </div>
  );
}
