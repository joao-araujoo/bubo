import React, { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import Button from '../ui/Button';

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export default function PwaStatus() {
  const [installEvent, setInstallEvent] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem('bubo_install_dismissed') === 'true');

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      if (!isStandalone()) setInstallEvent(event);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstalled = () => setInstallEvent(null);

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstallEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem('bubo_install_dismissed', 'true');
    setIsDismissed(true);
  };

  if (!isOnline) {
    return (
      <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-warning)/0.35)] bg-[rgb(var(--bubo-color-surface))] p-3 shadow-[var(--bubo-shadow-lg)] md:bottom-4">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-warning)/0.1)] text-[rgb(var(--bubo-color-warning))]">
          <WifiOff size={19} aria-hidden="true" />
        </span>
        <div>
          <strong className="block text-sm">Você está offline</strong>
          <span className="text-xs leading-5 text-[rgb(var(--bubo-color-text-muted))]">Telas visitadas podem abrir, mas ações precisam de conexão.</span>
        </div>
      </div>
    );
  }

  if (!installEvent || isDismissed || isStandalone()) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-lg rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4 shadow-[var(--bubo-shadow-lg)] md:bottom-4">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-surface-muted))]"
        aria-label="Ocultar convite de instalação"
      >
        <X size={17} aria-hidden="true" />
      </button>
      <div className="flex gap-3 pr-8">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">
          <Download size={20} aria-hidden="true" />
        </span>
        <div>
          <strong className="block">Instale o Bubo</strong>
          <p className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Acesse sua leitura pela tela inicial e tenha uma experiência mais próxima de um aplicativo.</p>
        </div>
      </div>
      <Button className="mt-4 w-full" onClick={install} leftIcon={<Download size={17} aria-hidden="true" />}>
        Instalar aplicativo
      </Button>
    </div>
  );
}
