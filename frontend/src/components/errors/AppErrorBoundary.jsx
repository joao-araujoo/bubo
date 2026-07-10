import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import BuboMark from '../brand/BuboMark';
import Button from '../ui/Button';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      hasError: false,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      error,
      hasError: true,
    };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('Bubo application error:', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[rgb(var(--bubo-color-background))] px-4 py-10 text-[rgb(var(--bubo-color-text))]">
        <section className="w-full max-w-xl rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-6 text-center shadow-[var(--bubo-shadow-lg)] sm:p-8">
          <div className="mx-auto flex w-fit items-center gap-3">
            <BuboMark size={52} />
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(var(--bubo-color-warning)/0.12)] text-[rgb(var(--bubo-color-warning))]">
              <AlertTriangle size={22} aria-hidden="true" />
            </span>
          </div>

          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">
            O Bubo encontrou uma falha
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.025em] sm:text-3xl">
            Esta tela não conseguiu continuar.
          </h1>
          <p className="mx-auto mt-3 max-w-md leading-7 text-[rgb(var(--bubo-color-text-muted))]">
            Seus dados permanecem salvos. Recarregue a aplicação ou volte ao início para retomar a leitura.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button leftIcon={<RefreshCw size={17} />} onClick={this.handleReload}>
              Recarregar
            </Button>
            <Button variant="secondary" leftIcon={<Home size={17} />} onClick={this.handleHome}>
              Voltar ao início
            </Button>
          </div>

          {import.meta.env.DEV && this.state.error?.message && (
            <pre className="mt-6 overflow-x-auto rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3 text-left text-xs text-[rgb(var(--bubo-color-text-muted))]">
              {this.state.error.message}
            </pre>
          )}
        </section>
      </main>
    );
  }
}
