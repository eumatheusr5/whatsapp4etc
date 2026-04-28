import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';

export function LoginPage() {
  const { session, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/conversas" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || 'Falha no login');
      return;
    }
    toast.success('Bem-vindo!');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-wa-green-dark to-wa-green-darker px-4">
      <div className="w-full max-w-md bg-white dark:bg-wa-panel-dark rounded-2xl shadow-2xl p-8 animate-slide-up">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-wa-green-dark text-white flex items-center justify-center mb-3">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold">WhatsApp4etc</h1>
          <p className="text-sm text-wa-muted mt-1">Atendimento multi-número</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
          </button>
        </form>
        <p className="text-xs text-center text-wa-muted mt-6">
          Sistema interno. Cadastros são feitos pelo administrador.
        </p>
      </div>
    </div>
  );
}
