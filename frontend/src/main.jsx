import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1E1E1E', color: '#FFFFFF', border: '1px solid rgba(189,189,189,0.1)' },
            success: { iconTheme: { primary: '#00FFFF', secondary: '#121212' } },
            error: { iconTheme: { primary: '#FF9800', secondary: '#121212' } }
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
