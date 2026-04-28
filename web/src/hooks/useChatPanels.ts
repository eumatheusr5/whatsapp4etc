import { useEffect, useState } from 'react';

/**
 * Detecta breakpoints do layout do chat:
 *  - sm: até 768px → mostra UMA tela por vez (lista OU chat OU detalhes)
 *  - md: 768px–1279px → mostra lista + chat (detalhes em modal)
 *  - lg: ≥1280px → mostra lista + chat + painel de detalhes
 */
export type ChatBreakpoint = 'sm' | 'md' | 'lg';

function getBreakpoint(): ChatBreakpoint {
  if (typeof window === 'undefined') return 'lg';
  const w = window.innerWidth;
  if (w < 768) return 'sm';
  if (w < 1280) return 'md';
  return 'lg';
}

export function useChatBreakpoint(): ChatBreakpoint {
  const [bp, setBp] = useState<ChatBreakpoint>(getBreakpoint);
  useEffect(() => {
    const onResize = () => setBp(getBreakpoint());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return bp;
}
