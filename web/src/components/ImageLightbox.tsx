import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxImage {
  url: string;
  caption?: string | null;
  filename?: string | null;
}

interface Props {
  images: LightboxImage[];
  startIndex?: number;
  onClose: () => void;
}

export function ImageLightbox({ images, startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const current = images[index];

  const go = useCallback(
    (delta: number) => {
      setZoom(1);
      setRotation(0);
      setIndex((i) => {
        const next = i + delta;
        if (next < 0) return images.length - 1;
        if (next >= images.length) return 0;
        return next;
      });
    },
    [images.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 0.5));
      if (e.key.toLowerCase() === 'r') setRotation((r) => (r + 90) % 360);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [go, onClose]);

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.deltaY < 0) setZoom((z) => Math.min(z + 0.15, 4));
    else setZoom((z) => Math.max(z - 0.15, 0.5));
  }

  async function download() {
    if (!current?.url) return;
    try {
      const res = await fetch(current.url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = current.filename || `imagem-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch {
      window.open(current.url, '_blank');
    }
  }

  if (!current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      {/* Topbar */}
      <div className="h-14 px-4 flex items-center justify-between text-white/90">
        <div className="text-sm truncate">
          {images.length > 1 && <span className="opacity-70 mr-2">{index + 1}/{images.length}</span>}
          {current.caption || ''}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
            className="p-2 rounded-lg hover:bg-white/10"
            title="Reduzir (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
            className="p-2 rounded-lg hover:bg-white/10"
            title="Ampliar (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-lg hover:bg-white/10"
            title="Rotacionar (R)"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => void download()}
            className="p-2 rounded-lg hover:bg-white/10"
            title="Baixar"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onWheel={onWheel}
      >
        {images.length > 1 && (
          <button
            onClick={() => go(-1)}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}
        <img
          src={current.url}
          alt={current.caption || 'imagem'}
          className="max-w-[95vw] max-h-[80vh] object-contain transition-transform"
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          draggable={false}
        />
        {images.length > 1 && (
          <button
            onClick={() => go(1)}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Próxima"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="h-20 px-4 flex items-center gap-2 overflow-x-auto bg-black/40">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setIndex(i);
              }}
              className={
                'h-14 w-14 rounded overflow-hidden border-2 shrink-0 ' +
                (i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100')
              }
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
