import React, { useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import DeepReviewLauncher from '../deepReview/DeepReviewLauncher';
import OnboardingFlow from '../onboarding/OnboardingFlow';
import PwaStatus from '../pwa/PwaStatus';
import BottomNavigation from './BottomNavigation';
import Navbar from './Navbar';
import { useAuthStore } from '../../stores/useAuthStore';

const routeTitles = {
  '/': 'Início',
  '/library': 'Biblioteca',
  '/feed': 'Feed',
  '/discover': 'Descobrir',
  '/clubs': 'Clubes de leitura',
  '/coach': 'AI Reading Coach',
  '/achievements': 'Conquistas',
  '/profile': 'Perfil',
  '/auth': 'Entrar',
};

export default function Layout() {
  const location = useLocation();
  const { refreshProfile, token, user } = useAuthStore();
  const currentTitle = useMemo(() => {
    if (location.pathname.startsWith('/clubs/')) return 'Clube de leitura';
    return routeTitles[location.pathname] || 'Bubo';
  }, [location.pathname]);

  useEffect(() => {
    if (token) refreshProfile().catch(() => {});
  }, [refreshProfile, token]);

  useEffect(() => {
    document.title = `${currentTitle} — Bubo`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentTitle, location.pathname]);

  const needsOnboarding = Boolean(token && user && user.onboardingCompleted !== true);

  return (
    <div className="min-h-screen bg-[rgb(var(--bubo-color-background))] text-[rgb(var(--bubo-color-text))]">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[120] -translate-y-24 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-primary))] px-4 py-2 font-bold text-white shadow-[var(--bubo-shadow-lg)] transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white"
      >
        Ir para o conteúdo principal
      </a>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Página atual: {currentTitle}
      </span>

      <Navbar />
      <main
        id="main-content"
        tabIndex="-1"
        className={`mx-auto w-full max-w-7xl px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8 ${token ? 'pb-24 md:pb-8' : 'pb-8'}`}
      >
        <Outlet />
      </main>

      {token && (
        <>
          <BottomNavigation />
          <DeepReviewLauncher />
          <PwaStatus />
        </>
      )}
      {needsOnboarding && <OnboardingFlow />}
    </div>
  );
}
