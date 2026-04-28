import { useEffect, useRef, useState } from 'react';
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  StopCircle,
  Image as ImageIcon,
  FileText,
  Video,
  Sticker as StickerIcon,
} from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import toast from 'react-hot-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/format';

interface QuickReply {
  id: string;
  shortcut: string;
  body: string;
  user_id: string | null;
}

interface ComposerProps {
  conversationId: string;
  locked: boolean;
  assignedToOther: string | null;
  instanceStatus: string;
}

export function Composer({ conversationId, locked, assignedToOther, instanceStatus }: ComposerProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingTimer = useRef<number | null>(null);
  const { theme } = useTheme();

  const offline = instanceStatus !== 'connected';

  const { data: quickReplies = [] } = useQuery<QuickReply[]>({
    queryKey: ['quick-replies'],
    queryFn: async () => {
      const { data } = await supabase.from('quick_replies').select('*').order('shortcut');
      return (data ?? []) as QuickReply[];
    },
  });

  const sendText = useMutation({
    mutationFn: (body: string) =>
      api.post(`/messages/text`, { conversationId, body }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMedia = useMutation({
    mutationFn: async ({
      file,
      type,
      caption,
    }: {
      file: Blob;
      type: 'image' | 'video' | 'document' | 'audio' | 'ptt' | 'sticker';
      caption?: string;
    }) => {
      const fd = new FormData();
      fd.append('conversationId', conversationId);
      fd.append('type', type);
      if (caption) fd.append('caption', caption);
      const filename = (file as File).name || `arquivo`;
      fd.append('fileName', filename);
      fd.append('file', file, filename);
      return api.postForm('/messages/media', fd);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleTypingChange(value: string) {
    setText(value);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    void api.post(`/conversations/${conversationId}/typing`, { state: 'composing' }).catch(() => undefined);
    typingTimer.current = window.setTimeout(() => {
      void api.post(`/conversations/${conversationId}/typing`, { state: 'paused' }).catch(() => undefined);
    }, 2500);
  }

  function trySendText() {
    const value = text.trim();
    if (!value) return;

    if (value.startsWith('/')) {
      const qr = quickReplies.find((q) => q.shortcut === value.split(' ')[0]);
      if (qr) {
        const remainder = value.slice(qr.shortcut.length).trim();
        const finalBody = remainder ? `${qr.body}\n${remainder}` : qr.body;
        sendText.mutate(finalBody);
        setText('');
        return;
      }
    }
    sendText.mutate(value);
    setText('');
  }

  function handleFile(type: 'image' | 'video' | 'document', file: File) {
    sendMedia.mutate({ file, type, caption: text.trim() || undefined });
    setText('');
    setShowAttach(false);
  }

  function handleSticker(file: File) {
    sendMedia.mutate({ file, type: 'sticker' });
    setShowAttach(false);
  }

  async function startRecording() {
    if (!navigator.mediaDevices) {
      toast.error('Microfone não disponível');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        sendMedia.mutate({ file: blob, type: 'ptt' });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error('Permissão de microfone negada');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, []);

  if (locked) {
    return (
      <div className="bg-surface border-t border-border p-4 text-center text-sm text-text-muted safe-bottom">
        Esta conversa está em atendimento por <strong className="text-text">{assignedToOther}</strong>. Aguarde a liberação para responder.
      </div>
    );
  }

  return (
    <div className="bg-surface border-t border-border relative safe-bottom">
      {offline && (
        <div className="bg-warning-soft text-warning-fg text-xs px-4 py-1.5 text-center">
          Número desconectado. Mensagens enviadas serão enfileiradas até reconectar.
        </div>
      )}
      <div className="p-2.5 sm:p-3 flex items-end gap-1.5 sm:gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((x) => !x)}
            className="w-10 h-10 rounded-full text-text-muted hover:bg-surface-2 inline-flex items-center justify-center"
            aria-label="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-2 z-30 max-w-[92vw]">
              <EmojiPicker
                onEmojiClick={(e) => setText((t) => t + e.emoji)}
                emojiStyle={EmojiStyle.NATIVE}
                theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                width={Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 24 : 320)}
                height={380}
              />
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAttach((x) => !x)}
            className="w-10 h-10 rounded-full text-text-muted hover:bg-surface-2 inline-flex items-center justify-center"
            aria-label="Anexar"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          {showAttach && (
            <div className="absolute bottom-full left-0 mb-2 bg-surface border border-border rounded-xl shadow-pop overflow-hidden z-30 w-48">
              <AttachItem
                icon={ImageIcon}
                label="Imagem"
                onClick={() => fileInputRef.current?.click()}
              />
              <AttachItem
                icon={Video}
                label="Vídeo"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'video/*';
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f) handleFile('video', f);
                  };
                  input.click();
                }}
              />
              <AttachItem
                icon={FileText}
                label="Documento"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f) handleFile('document', f);
                  };
                  input.click();
                }}
              />
              <AttachItem
                icon={StickerIcon}
                label="Figurinha"
                onClick={() => stickerInputRef.current?.click()}
              />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile('image', f);
              e.target.value = '';
            }}
          />
          <input
            ref={stickerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleSticker(f);
              e.target.value = '';
            }}
          />
        </div>

        <div className="flex-1 relative">
          <textarea
            placeholder='Mensagem ou "/" para respostas rápidas'
            value={text}
            onChange={(e) => {
              handleTypingChange(e.target.value);
              setShowQuickReplies(e.target.value.startsWith('/'));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                trySendText();
              }
            }}
            rows={1}
            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-2xl outline-none text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          {showQuickReplies && (
            <QuickReplyDropdown
              filter={text}
              replies={quickReplies}
              onPick={(r) => {
                setText(r.body);
                setShowQuickReplies(false);
              }}
            />
          )}
        </div>

        {text.trim() ? (
          <button
            onClick={trySendText}
            className="w-10 h-10 rounded-full bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center justify-center shrink-0"
            aria-label="Enviar"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={recording ? stopRecording : startRecording}
            className={cn(
              'w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0',
              recording
                ? 'bg-danger text-danger-fg animate-pulse'
                : 'text-text-muted hover:bg-surface-2',
            )}
            aria-label={recording ? 'Parar gravação' : 'Gravar áudio'}
          >
            {recording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function AttachItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 w-full text-sm hover:bg-surface-2 text-text"
    >
      <Icon className="w-4 h-4 text-text-muted" /> {label}
    </button>
  );
}

function QuickReplyDropdown({
  filter,
  replies,
  onPick,
}: {
  filter: string;
  replies: QuickReply[];
  onPick: (r: QuickReply) => void;
}) {
  const matched = replies.filter((r) => r.shortcut.startsWith(filter)).slice(0, 6);
  if (matched.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 mb-2 bg-surface border border-border rounded-xl shadow-pop overflow-hidden z-30 w-full max-w-md">
      {matched.map((r) => (
        <button
          key={r.id}
          onClick={() => onPick(r)}
          className="block text-left w-full px-3 py-2 hover:bg-surface-2"
        >
          <div className="text-xs font-mono text-accent">{r.shortcut}</div>
          <div className="text-sm text-text truncate">{r.body}</div>
        </button>
      ))}
    </div>
  );
}
