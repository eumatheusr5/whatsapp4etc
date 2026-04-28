import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { initSentry } from './lib/sentry';
import { LightboxProvider } from './components/LightboxProvider';

initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LightboxProvider>
          <App />
        </LightboxProvider>
        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 3500,
            className:
              '!bg-surface !text-text !border !border-border !shadow-pop !rounded-xl',
            style: { fontSize: '0.875rem', padding: '10px 14px' },
            success: {
              iconTheme: { primary: 'rgb(var(--success))', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: 'rgb(var(--danger))', secondary: '#fff' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
