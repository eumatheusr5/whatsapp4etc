/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Tokens semânticos via CSS vars (configurados em index.css)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        'text-subtle': 'rgb(var(--text-subtle) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
          fg: 'rgb(var(--danger-fg) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft: 'rgb(var(--warning-soft) / <alpha-value>)',
          fg: 'rgb(var(--warning-fg) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          soft: 'rgb(var(--success-soft) / <alpha-value>)',
          fg: 'rgb(var(--success-fg) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          soft: 'rgb(var(--info-soft) / <alpha-value>)',
          fg: 'rgb(var(--info-fg) / <alpha-value>)',
        },
        // Bubble do chat
        'bubble-in': 'rgb(var(--bubble-in) / <alpha-value>)',
        'bubble-out': 'rgb(var(--bubble-out) / <alpha-value>)',
        // Shims de compatibilidade com classes antigas (wa-*)
        'wa-green': 'rgb(var(--accent) / <alpha-value>)',
        'wa-green-dark': 'rgb(var(--accent) / <alpha-value>)',
        'wa-green-darker': 'rgb(var(--accent-hover) / <alpha-value>)',
        'wa-panel': 'rgb(var(--surface) / <alpha-value>)',
        'wa-panel-dark': 'rgb(var(--surface) / <alpha-value>)',
        'wa-bubble': 'rgb(var(--surface) / <alpha-value>)',
        'wa-bubble-dark': 'rgb(var(--surface) / <alpha-value>)',
        'wa-bubble-out': 'rgb(var(--bubble-out) / <alpha-value>)',
        'wa-bubble-out-dark': 'rgb(var(--bubble-out) / <alpha-value>)',
        'wa-divider': 'rgb(var(--border) / <alpha-value>)',
        'wa-divider-dark': 'rgb(var(--border) / <alpha-value>)',
        'wa-text': 'rgb(var(--text) / <alpha-value>)',
        'wa-text-dark': 'rgb(var(--text) / <alpha-value>)',
        'wa-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        'wa-chat': 'rgb(var(--bg) / <alpha-value>)',
        'wa-chat-dark': 'rgb(var(--bg) / <alpha-value>)',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 4px 12px -2px rgb(0 0 0 / 0.06)',
        pop: '0 8px 24px -4px rgb(0 0 0 / 0.10), 0 2px 6px -1px rgb(0 0 0 / 0.06)',
        'pop-lg': '0 24px 48px -12px rgb(0 0 0 / 0.18), 0 6px 16px -2px rgb(0 0 0 / 0.08)',
        ring: '0 0 0 3px rgb(var(--accent) / 0.15)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'scale-in': 'scale-in 150ms ease-out',
        shimmer: 'shimmer 1.6s infinite linear',
      },
    },
  },
  plugins: [],
};
