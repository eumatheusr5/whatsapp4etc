import { useState } from 'react';
import { Check, CheckCheck, Clock, Smile, Reply, Trash2, Pencil, MoreHorizontal, Smartphone, Languages } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { cn, formatTime } from '../../lib/format';

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
  const [showTranscript, setShowTranscript] = useState(false);

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
      <div className={cn('px-4 py-1', msg.from_me ? 'flex justify-end' : 'flex justify-start')}>
        <div className="text-xs italic bg-wa-bubble dark:bg-wa-bubble-dark text-wa-muted px-3 py-2 rounded-lg">
          🚫 Mensagem apagada
        </div>
      </div>
    );
  }

  const align = msg.from_me ? 'items-end' : 'items-start';
  const bubbleColor = msg.from_me
    ? 'bg-wa-bubble-out dark:bg-wa-bubble-out-dark'
    : 'bg-wa-bubble dark:bg-wa-bubble-dark';

  return (
    <div
      className={cn('px-4 py-1 flex flex-col group', align)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={cn('relative max-w-[78%] md:max-w-[65%]', bubbleColor, 'rounded-lg shadow-sm px-3 py-2')}>
        {msg.forwarded && (
          <div className="text-xs text-wa-muted italic mb-1 flex items-center gap-1">
            ↪ Encaminhada
          </div>
        )}
        {msg.sent_via === 'phone' && (
          <div className="text-[10px] text-wa-muted flex items-center gap-1 mb-1">
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
          {msg.edited_at && <span className="text-[10px] text-wa-muted">editada</span>}
          <span className="text-[10px] text-wa-muted">{formatTime(msg.wa_timestamp)}</span>
          {msg.from_me && <StatusIcon status={msg.status} />}
        </div>

        {msg.reactions?.length > 0 && (
          <div className="absolute -bottom-3 right-2 bg-wa-bubble dark:bg-wa-bubble-dark border border-wa-divider dark:border-wa-divider-dark rounded-full px-2 py-0.5 shadow text-xs flex items-center gap-0.5">
            {Array.from(new Set(msg.reactions.map((r) => r.emoji))).slice(0, 4).join('')}
            {msg.reactions.length > 1 && (
              <span className="text-[10px] text-wa-muted ml-1">{msg.reactions.length}</span>
            )}
          </div>
        )}

        {showActions && (
          <div
            className={cn(
              'absolute top-0 flex items-center gap-1 transition-opacity',
              msg.from_me ? '-left-20' : '-right-20',
            )}
          >
            <ReactionPicker onPick={(e) => react.mutate(e)} />
            {msg.from_me && (
              <button
                onClick={() => {
                  if (confirm('Apagar esta mensagem para todos?')) remove.mutate();
                }}
                className="p-1.5 bg-wa-bubble dark:bg-wa-bubble-dark border border-wa-divider dark:border-wa-divider-dark rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40"
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
        className="p-1.5 bg-wa-bubble dark:bg-wa-bubble-dark border border-wa-divider dark:border-wa-divider-dark rounded-full hover:bg-wa-divider dark:hover:bg-wa-divider-dark"
      >
        <Smile className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-wa-bubble dark:bg-wa-bubble-dark border border-wa-divider dark:border-wa-divider-dark rounded-full px-2 py-1 shadow-lg flex gap-1 animate-fade-in">
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
  if (msg.type === 'text') {
    return <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>;
  }
  if (msg.type === 'image' && msg.media_url) {
    return (
      <div>
        <img
          src={msg.media_url}
          alt="imagem"
          className="rounded max-w-full max-h-80 cursor-pointer object-cover"
          onClick={() => window.open(msg.media_url!, '_blank')}
        />
        {msg.body && <p className="text-sm mt-1 whitespace-pre-wrap break-words">{msg.body}</p>}
      </div>
    );
  }
  if (msg.type === 'video' && msg.media_url) {
    return (
      <div>
        <video src={msg.media_url} controls className="rounded max-w-full max-h-80" />
        {msg.body && <p className="text-sm mt-1 whitespace-pre-wrap break-words">{msg.body}</p>}
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
        className="flex items-center gap-2 text-sm bg-wa-divider dark:bg-wa-divider-dark p-2 rounded hover:underline"
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
  return <span className="text-sm italic text-wa-muted">{msg.type}</span>;
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
    <div className="mt-2 border-t border-wa-divider dark:border-wa-divider-dark pt-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-wa-muted hover:text-wa-text dark:hover:text-wa-text-dark"
      >
        <Languages className="w-3 h-3" />
        {msg.transcript_status === 'pending' || msg.transcript_status === 'processing'
          ? 'Transcrevendo...'
          : msg.transcript_status === 'failed'
            ? 'Falha na transcrição'
            : expanded
              ? 'Ocultar transcrição'
              : 'Ver transcrição'}
      </button>
      {expanded && msg.transcript && (
        <p className="text-xs italic mt-1 text-wa-muted whitespace-pre-wrap">{msg.transcript}</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: MessageRow['status'] }) {
  if (status === 'pending') return <Clock className="w-3 h-3 text-wa-muted" />;
  if (status === 'failed') return <span className="text-red-500 text-xs">!</span>;
  if (status === 'sent') return <Check className="w-3 h-3 text-wa-muted" />;
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-wa-muted" />;
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-blue-500" />;
  return null;
}

void Reply;
void Pencil;
void MoreHorizontal;
