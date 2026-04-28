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
  if (session) return <Navigate to="/inicio" replace />;

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
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-accent to-accent-hover px-4 py-8 safe-bottom safe-top">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-pop-lg p-6 sm:p-8 animate-slide-up border border-border">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-accent text-accent-fg flex items-center justify-center mb-3 shadow-soft">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-text">WhatsApp4etc</h1>
          <p className="text-sm text-text-muted mt-1">Atendimento multi-número</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted">E-mail</label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="h-11 w-full px-3 bg-surface text-text placeholder:text-text-subtle text-sm border border-border rounded-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted">Senha</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="h-11 w-full px-3 bg-surface text-text placeholder:text-text-subtle text-sm border border-border rounded-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent text-accent-fg hover:bg-accent-hover font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
          </button>
        </form>
        <p className="text-xs text-center text-text-subtle mt-6">
          Sistema interno. Cadastros são feitos pelo administrador.
        </p>
      </div>
    </div>
  );
}
