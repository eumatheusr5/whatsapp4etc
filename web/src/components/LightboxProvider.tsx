import { createContext, useCallback, useContext, useState } from 'react';
import { ImageLightbox, LightboxImage } from './ImageLightbox';

interface OpenArgs {
  images: LightboxImage[];
  startIndex?: number;
}

interface Ctx {
  open: (args: OpenArgs) => void;
}

const LightboxContext = createContext<Ctx>({ open: () => undefined });

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OpenArgs | null>(null);

  const open = useCallback((args: OpenArgs) => {
    setState(args);
  }, []);

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {state && (
        <ImageLightbox
          images={state.images}
          startIndex={state.startIndex ?? 0}
          onClose={() => setState(null)}
        />
      )}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  return useContext(LightboxContext);
}
