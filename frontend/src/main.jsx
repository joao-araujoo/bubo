import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'rgb(var(--bubo-color-surface))',
                color: 'rgb(var(--bubo-color-text))',
                border: '1px solid rgb(var(--bubo-color-border))',
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
    </ThemeProvider>
  </React.StrictMode>,
);
