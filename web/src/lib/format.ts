import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return format(d, 'HH:mm', { locale: ptBR });
}

export function formatDay(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatRelative(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
}

/**
 * Formata um número de telefone (com ou sem DDI) no padrão BR compacto:
 *  - 5511941785791 -> "(11) 94178-5791"
 *  - 551141785791  -> "(11) 4178-5791"
 *  - 11941785791   -> "(11) 94178-5791"
 *  - Qualquer outro tamanho cai num fallback internacional legível.
 *
 * Aceita JID completo, com sufixo de device (`:NN`) ou de grupo (`-NN`).
 */
export function formatPhone(jidOrPhone?: string | null): string {
  if (!jidOrPhone) return '';
  const cleaned = jidOrPhone.split('@')[0].replace(/[:\-]\d+$/, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  let local = digits;
  if (digits.length === 13 && digits.startsWith('55')) local = digits.slice(2);
  else if (digits.length === 12 && digits.startsWith('55')) local = digits.slice(2);

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  if (local.length === 9) {
    return `${local.slice(0, 5)}-${local.slice(5)}`;
  }
  if (local.length === 8) {
    return `${local.slice(0, 4)}-${local.slice(4)}`;
  }
  return `+${digits}`;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
