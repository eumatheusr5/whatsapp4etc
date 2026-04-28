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
        // Paleta WhatsApp Web (clara e escura)
        wa: {
          green: '#00a884',
          'green-dark': '#008069',
          'green-darker': '#075e54',
          panel: '#f0f2f5',
          'panel-dark': '#202c33',
          chat: '#efeae2',
          'chat-dark': '#0b141a',
          bubble: '#ffffff',
          'bubble-dark': '#202c33',
          'bubble-out': '#d9fdd3',
          'bubble-out-dark': '#005c4b',
          divider: '#e9edef',
          'divider-dark': '#222e35',
          text: '#111b21',
          'text-dark': '#e9edef',
          muted: '#667781',
          'muted-dark': '#8696a0',
        },
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
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'slide-in': 'slide-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
