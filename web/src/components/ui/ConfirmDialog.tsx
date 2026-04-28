import { ReactNode, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Input, Field } from './Input';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
  /** Se definido, exige que o usuário digite essa string para liberar o botão. */
  requireText?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'primary',
  requireText,
  loading,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const canConfirm = !requireText || typed.trim() === requireText.trim();

  const handle = async () => {
    if (!canConfirm) return;
    await onConfirm();
    setTyped('');
  };

  const variant = tone === 'danger' ? 'danger' : 'primary';
  const Icon = tone === 'danger' || tone === 'warning' ? AlertTriangle : null;
  const iconClass = tone === 'danger' ? 'text-danger bg-danger-soft' : 'text-warning-fg bg-warning-soft';

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setTyped('');
      }}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => { onClose(); setTyped(''); }} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={handle} loading={loading} disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconClass}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-text">{title}</h3>
            {description && <div className="text-sm text-text-muted mt-1">{description}</div>}
          </div>
        </div>
        {requireText && (
          <div className="mt-4">
            <Field
              label={
                <>
                  Para confirmar, digite <span className="font-mono text-text">{requireText}</span>
                </>
              }
            >
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={requireText}
                autoFocus
              />
            </Field>
          </div>
        )}
      </div>
    </Dialog>
  );
}
