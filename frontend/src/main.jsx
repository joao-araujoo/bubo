import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import AppErrorBoundary from './components/errors/AppErrorBoundary';
import { ThemeProvider } from './theme/ThemeProvider';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <Toaster
              position="top-center"
              containerStyle={{ top: 'max(1rem, env(safe-area-inset-top))' }}
              toastOptions={{
                duration: 4200,
                style: {
                  maxWidth: 'min(28rem, calc(100vw - 2rem))',
                  background: 'rgb(var(--bubo-color-surface))',
                  color: 'rgb(var(--bubo-color-text))',
                  border: '1px solid rgb(var(--bubo-color-border))',
                  boxShadow: 'var(--bubo-shadow-lg)',
                },
                success: {
                  iconTheme: {
                    primary: 'rgb(var(--bubo-color-accent))',
                    secondary: 'rgb(var(--bubo-color-surface))',
                  },
                },
                error: {
                  iconTheme: {
                    primary: 'rgb(var(--bubo-color-danger))',
                    secondary: 'rgb(var(--bubo-color-surface))',
                  },
                },
              }}
            />
          </BrowserRouter>
        </QueryClientProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A aplicação continua funcional sem suporte offline.
    });
  });
}
