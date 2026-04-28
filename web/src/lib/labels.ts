/**
 * Dicionários de tradução pt-BR para status e eventos do sistema.
 * Centraliza textos amigáveis usados em InstanceHealthTab, InstancesListTab,
 * ConversationView header, widget de saúde no Dashboard etc.
 */

export type InstanceStatus = 'connected' | 'connecting' | 'qr' | 'disconnected' | 'banned';

export interface StatusInfo {
  label: string;
  description: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  dotColor: string; // classe tailwind para a "bolinha"
}

export const INSTANCE_STATUS: Record<string, StatusInfo> = {
  connected: {
    label: 'Conectado',
    description: 'Número online e recebendo mensagens',
    tone: 'success',
    dotColor: 'bg-success',
  },
  connecting: {
    label: 'Conectando…',
    description: 'Estabelecendo conexão com o WhatsApp',
    tone: 'warning',
    dotColor: 'bg-warning',
  },
  qr: {
    label: 'Aguardando leitura do QR',
    description: 'Escaneie o QR Code para conectar este número',
    tone: 'info',
    dotColor: 'bg-info',
  },
  disconnected: {
    label: 'Desconectado',
    description: 'Número não está conectado ao WhatsApp',
    tone: 'muted',
    dotColor: 'bg-text-subtle',
  },
  banned: {
    label: 'Bloqueado pelo WhatsApp',
    description: 'Este número foi bloqueado pela plataforma',
    tone: 'danger',
    dotColor: 'bg-danger',
  },
};

export function getInstanceStatus(status: string | null | undefined): StatusInfo {
  if (!status) return INSTANCE_STATUS.disconnected;
  return INSTANCE_STATUS[status] ?? {
    label: status,
    description: 'Status não reconhecido',
    tone: 'muted',
    dotColor: 'bg-text-subtle',
  };
}

/**
 * Motivos de desconexão (vêm do DisconnectReason do Baileys).
 */
export const DISCONNECT_REASONS: Record<string, string> = {
  manual_logout: 'Você desconectou manualmente',
  logged_out: 'Sessão encerrada pelo aparelho',
  loggedOut: 'Sessão encerrada pelo aparelho',
  connectionLost: 'Conexão perdida (instabilidade de rede)',
  connectionClosed: 'Conexão encerrada pelo servidor',
  connectionReplaced: 'Outro dispositivo assumiu a sessão',
  timedOut: 'Tempo esgotado tentando conectar',
  multideviceMismatch: 'Conflito de dispositivos — leia o QR novamente',
  forbidden: 'Acesso bloqueado pelo WhatsApp (suspeita de uso indevido)',
  restartRequired: 'Reinicialização necessária',
  badSession: 'Sessão inválida — leia o QR novamente',
  unavailableService: 'Serviço do WhatsApp temporariamente indisponível',
  unknown: 'Motivo desconhecido',
};

export function translateDisconnectReason(reason: string | null | undefined): string {
  if (!reason) return 'Motivo não informado';
  return DISCONNECT_REASONS[reason] ?? `Motivo: ${reason}`;
}

/**
 * Tipos de evento de saúde (instance_health_events.event_type).
 */
export const HEALTH_EVENTS: Record<string, { label: string; tone: StatusInfo['tone']; icon: 'check' | 'x' | 'qr' | 'alert' | 'refresh' | 'info' }> = {
  connected: { label: 'Número conectado', tone: 'success', icon: 'check' },
  disconnected: { label: 'Número desconectado', tone: 'muted', icon: 'x' },
  qr_generated: { label: 'QR Code gerado', tone: 'info', icon: 'qr' },
  banned: { label: 'Número bloqueado pelo WhatsApp', tone: 'danger', icon: 'alert' },
  auth_failure: { label: 'Falha na autenticação', tone: 'danger', icon: 'alert' },
  reconnecting: { label: 'Tentando reconectar…', tone: 'warning', icon: 'refresh' },
};

export function getHealthEvent(eventType: string): { label: string; tone: StatusInfo['tone']; icon: 'check' | 'x' | 'qr' | 'alert' | 'refresh' | 'info' } {
  return HEALTH_EVENTS[eventType] ?? { label: eventType, tone: 'muted', icon: 'info' };
}

/**
 * Renderiza o `detail` de um evento de saúde de forma humana.
 */
export function formatHealthEventDetail(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail || Object.keys(detail).length === 0) return null;
  const parts: string[] = [];
  if (typeof detail.reason === 'string') {
    parts.push(translateDisconnectReason(detail.reason));
  }
  if (typeof detail.phone === 'string') {
    parts.push(`Número: ${detail.phone}`);
  }
  if (typeof detail.code === 'number' || typeof detail.code === 'string') {
    parts.push(`Código: ${detail.code}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Status de mensagem (campo `status` em messages).
 */
export const MESSAGE_STATUS: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falhou',
};

export function translateMessageStatus(status: string | null | undefined): string {
  if (!status) return '';
  return MESSAGE_STATUS[status] ?? status;
}

/**
 * Presença do contato (campo `presence` em contacts).
 */
export const PRESENCE: Record<string, string> = {
  available: 'Disponível',
  online: 'Disponível',
  composing: 'Digitando…',
  recording: 'Gravando áudio…',
  paused: 'Pausado',
  unavailable: 'Indisponível',
  offline: 'Indisponível',
};

export function translatePresence(presence: string | null | undefined): string | null {
  if (!presence) return null;
  return PRESENCE[presence] ?? null;
}

/**
 * Papéis de usuário.
 */
export const USER_ROLES: Record<string, string> = {
  admin: 'Administrador',
  attendant: 'Atendente',
  viewer: 'Visualizador',
};

export function translateUserRole(role: string | null | undefined): string {
  if (!role) return '—';
  return USER_ROLES[role] ?? role;
}

/**
 * Tipo de mensagem (campo `type`).
 */
export const MESSAGE_TYPE: Record<string, string> = {
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  ptt: 'Mensagem de voz',
  document: 'Documento',
  sticker: 'Figurinha',
  location: 'Localização',
  contact: 'Contato',
  reaction: 'Reação',
  unknown: 'Mensagem',
};

export function translateMessageType(type: string | null | undefined): string {
  if (!type) return 'Mensagem';
  return MESSAGE_TYPE[type] ?? type;
}
