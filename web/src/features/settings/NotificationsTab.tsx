import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ensurePushSubscription } from '../../lib/notifications';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../../components/ui';

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

function getPermission(): Permission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as Permission;
}

export function NotificationsTab() {
  const [perm, setPerm] = useState<Permission>(getPermission);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const onFocus = () => setPerm(getPermission());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function activate() {
    setActivating(true);
    try {
      await ensurePushSubscription();
      setPerm(getPermission());
      toast.success('Notificações ativadas');
    } catch (err) {
      toast.error('Falha: ' + (err as Error).message);
    } finally {
      setActivating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle description="Receba avisos quando chegar uma nova mensagem.">
          Notificações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-2/50">
            <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-text">Notificações do navegador</h4>
                {perm === 'granted' && (
                  <Badge tone="success" size="xs" dot>
                    Ativadas
                  </Badge>
                )}
                {perm === 'denied' && (
                  <Badge tone="danger" size="xs">Bloqueadas</Badge>
                )}
                {perm === 'unsupported' && (
                  <Badge tone="neutral" size="xs">Não suportado</Badge>
                )}
              </div>
              <p className="text-xs text-text-muted mt-1">
                Receba alertas no desktop ou celular mesmo com a aba em segundo plano.
              </p>
              <div className="mt-3 flex gap-2">
                {perm === 'granted' ? (
                  <Button size="sm" variant="secondary" iconLeft={<CheckCircle2 className="w-4 h-4" />}>
                    Tudo certo
                  </Button>
                ) : perm === 'denied' ? (
                  <Button size="sm" variant="secondary" iconLeft={<BellOff className="w-4 h-4" />} disabled>
                    Bloqueadas — libere nas permissões do navegador
                  </Button>
                ) : perm === 'default' ? (
                  <Button size="sm" onClick={activate} loading={activating} iconLeft={<Bell className="w-4 h-4" />}>
                    Ativar notificações
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled>
                    Não suportado neste navegador
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="text-xs text-text-muted">
            <strong className="text-text">Som:</strong> ao chegar uma nova mensagem com a aba em segundo plano,
            o sistema toca um aviso sonoro discreto e pisca o título da aba.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
