import { useEffect, useState } from 'react';
import { Check, CheckCheck, Clock, Smile, Reply, Trash2, Pencil, MoreHorizontal, Smartphone, Languages } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { cn, formatTime } from '../../lib/format';
import { useLightbox } from '../../components/LightboxProvider';
import { FormattedText } from '../../components/ui';

export interface MessageRow {
  id: string;
  conversation_id: string;
  wa_message_id: string;
  from_me: boolean;
  type:
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'ptt'
    | 'document'
    | 'sticker'
    | 'location'
    | 'contact'
    | 'reaction'
    | 'system';
  body: string | null;
  media_url: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_duration_seconds: number | null;
  media_width: number | null;
  media_height: number | null;
  reply_to_message_id: string | null;
  forwarded: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  edited_at: string | null;
  deleted_at: string | null;
  reactions: Array<{ jid: string; emoji: string; ts: number }>;
  sent_via: 'dashboard' | 'phone' | 'outbox' | null;
  transcript: string | null;
  transcript_status: 'pending' | 'processing' | 'done' | 'failed' | 'skipped';
  wa_timestamp: string;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageBubble({ msg, contactJid }: { msg: MessageRow; contactJid: string }) {
  const [showActions, setShowActions] = useState(false);
  // Transcricao comeca expandida quando ja estah pronta (UX: usuario ve o
  // texto direto em vez de precisar clicar para abrir).
  const [showTranscript, setShowTranscript] = useState(msg.transcript_status === 'done');
  // Quando a transcricao chega depois (status muda para 'done' via socket),
  // expande automaticamente.
  useEffect(() => {
    if (msg.transcript_status === 'done') setShowTranscript(true);
  }, [msg.transcript_status]);

  void contactJid;

  const react = useMutation({
    mutationFn: (emoji: string) => api.post(`/messages/${msg.id}/react`, { emoji }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/messages/${msg.id}`),
    onSuccess: () => toast.success('Mensagem apagada'),
    onError: (e: Error) => toast.error(e.message),
  });

  if (msg.deleted_at) {
    return (
      <div className={cn('px-3 sm:px-4 py-0.5', msg.from_me ? 'flex justify-end' : 'flex justify-start')}>
        <div className="text-xs italic bg-surface text-text-subtle px-3 py-2 rounded-lg border border-border">
          Mensagem apagada
        </div>
      </div>
    );
  }

  const align = msg.from_me ? 'items-end' : 'items-start';
  const bubbleColor = msg.from_me
    ? 'bg-bubble-out text-text'
    : 'bg-bubble-in text-text border border-border';

  return (
    <div
      className={cn('px-2 sm:px-4 py-0.5 flex flex-col group', align)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={cn('relative max-w-[85%] sm:max-w-[78%] md:max-w-[65%]', bubbleColor, 'rounded-2xl shadow-soft px-3 py-2')}>
        {msg.forwarded && (
          <div className="text-xs text-text-muted italic mb-1 flex items-center gap-1">
            ↪ Encaminhada
          </div>
        )}
        {msg.sent_via === 'phone' && (
          <div className="text-[10px] text-text-muted flex items-center gap-1 mb-1">
            <Smartphone className="w-3 h-3" /> Enviado pelo celular
          </div>
        )}

        <MessageContent msg={msg} />

        {(msg.type === 'audio' || msg.type === 'ptt') && (
          <TranscriptBox
            msg={msg}
            expanded={showTranscript}
            onToggle={() => setShowTranscript((x) => !x)}
          />
        )}

        <div className="flex items-center justify-end gap-1 mt-1">
          {msg.edited_at && <span className="text-[10px] text-text-subtle">editada</span>}
          <span className="text-[10px] text-text-subtle">{formatTime(msg.wa_timestamp)}</span>
          {msg.from_me && <StatusIcon status={msg.status} />}
        </div>

        {msg.reactions?.length > 0 && (
          <div className="absolute -bottom-3 right-2 bg-surface border border-border rounded-full px-2 py-0.5 shadow-soft text-xs flex items-center gap-0.5">
            {Array.from(new Set(msg.reactions.map((r) => r.emoji))).slice(0, 4).join('')}
            {msg.reactions.length > 1 && (
              <span className="text-[10px] text-text-muted ml-1">{msg.reactions.length}</span>
            )}
          </div>
        )}

        {showActions && (
          <div
            className={cn(
              'absolute top-0 hidden sm:flex items-center gap-1 transition-opacity',
              msg.from_me ? '-left-16' : '-right-16',
            )}
          >
            <ReactionPicker onPick={(e) => react.mutate(e)} />
            {msg.from_me && (
              <button
                onClick={() => {
                  if (confirm('Apagar esta mensagem para todos?')) remove.mutate();
                }}
                className="p-1.5 bg-surface border border-border rounded-full text-danger hover:bg-danger-soft"
                title="Apagar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReactionPicker({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((x) => !x)}
        className="p-1.5 bg-surface border border-border rounded-full hover:bg-surface-2 text-text-muted"
      >
        <Smile className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-surface border border-border rounded-full px-2 py-1 shadow-pop flex gap-1 animate-fade-in">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="hover:scale-125 transition-transform text-lg"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageContent({ msg }: { msg: MessageRow }) {
  const lightbox = useLightbox();
  if (msg.type === 'text') {
    return (
      <p className="text-sm break-words">
        <FormattedText text={msg.body} />
      </p>
    );
  }
  if (msg.type === 'image' && msg.media_url) {
    return (
      <div>
        <img
          src={msg.media_url}
          alt={msg.body || 'imagem'}
          className="rounded max-w-full max-h-80 cursor-zoom-in object-cover"
          onClick={() =>
            lightbox.open({
              images: [{ url: msg.media_url!, caption: msg.body }],
            })
          }
        />
        {msg.body && (
          <p className="text-sm mt-1 break-words">
            <FormattedText text={msg.body} />
          </p>
        )}
      </div>
    );
  }
  if (msg.type === 'video' && msg.media_url) {
    return (
      <div>
        <video src={msg.media_url} controls className="rounded max-w-full max-h-80" />
        {msg.body && (
          <p className="text-sm mt-1 break-words">
            <FormattedText text={msg.body} />
          </p>
        )}
      </div>
    );
  }
  if ((msg.type === 'audio' || msg.type === 'ptt') && msg.media_url) {
    return <audio src={msg.media_url} controls className="max-w-full" />;
  }
  if (msg.type === 'document' && msg.media_url) {
    return (
      <a
        href={msg.media_url}
        target="_blank"
        rel="noopener"
        className="flex items-center gap-2 text-sm bg-surface-2 p-2 rounded-lg hover:underline text-text"
      >
        📎 {msg.body || 'documento'}
      </a>
    );
  }
  if (msg.type === 'sticker' && msg.media_url) {
    return <img src={msg.media_url} alt="sticker" className="w-32 h-32 object-contain" />;
  }
  if (msg.type === 'location' && msg.body) {
    try {
      const loc = JSON.parse(msg.body) as { lat: number; lng: number; name?: string };
      return (
        <a
          href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
          target="_blank"
          rel="noopener"
          className="text-sm underline"
        >
          📍 {loc.name || `${loc.lat}, ${loc.lng}`}
        </a>
      );
    } catch {
      return <span>📍 Localização</span>;
    }
  }
  return <span className="text-sm italic text-text-muted">{msg.type}</span>;
}

function TranscriptBox({
  msg,
  expanded,
  onToggle,
}: {
  msg: MessageRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (msg.transcript_status === 'skipped') return null;
  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text"
      >
        <Languages className="w-3 h-3" />
        {msg.transcript_status === 'pending' || msg.transcript_status === 'processing'
          ? 'Transcrevendo…'
          : msg.transcript_status === 'failed'
            ? 'Falha na transcrição'
            : expanded
              ? 'Ocultar transcrição'
              : 'Ver transcrição'}
      </button>
      {expanded && msg.transcript && (
        <p className="text-xs italic mt-1 text-text-muted whitespace-pre-wrap">{msg.transcript}</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: MessageRow['status'] }) {
  if (status === 'pending') return <Clock className="w-3 h-3 text-text-subtle" />;
  if (status === 'failed') return <span className="text-danger text-xs">!</span>;
  if (status === 'sent') return <Check className="w-3 h-3 text-text-subtle" />;
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-text-subtle" />;
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-info" />;
  return null;
}

void Reply;
void Pencil;
void MoreHorizontal;
