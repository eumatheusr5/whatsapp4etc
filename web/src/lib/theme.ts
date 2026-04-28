import { useEffect } from 'react';
import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useTheme = create<ThemeStore>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'light',
  toggle: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return { theme: next };
    }),
  set: (theme: Theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
}));

export function useThemeBootstrap() {
  const theme = useTheme((s) => s.theme);
  useEffect(() => {
    const cls = document.documentElement.classList;
    if (theme === 'dark') cls.add('dark');
    else cls.remove('dark');
  }, [theme]);
}
