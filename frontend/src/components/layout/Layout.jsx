import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';
import Navbar from './Navbar';
import { useAuthStore } from '../../stores/useAuthStore';

export default function Layout() {
  const { token } = useAuthStore();

  return (
    <div className="min-h-screen bg-[rgb(var(--bubo-color-background))] text-[rgb(var(--bubo-color-text))]">
      <Navbar />
      <main className={`mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 ${token ? 'pb-24 md:pb-8' : 'pb-8'}`}>
        <Outlet />
      </main>
      {token && <BottomNavigation />}
    </div>
  );
}
