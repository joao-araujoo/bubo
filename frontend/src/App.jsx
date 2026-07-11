import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Skeleton from './components/ui/Skeleton';
import { useAuthStore } from './stores/useAuthStore';

const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const BookDetailPage = lazy(() => import('./pages/BookDetailPage'));
const ClubDetailPage = lazy(() => import('./pages/ClubDetailPage'));
const ClubsPage = lazy(() => import('./pages/ClubsPage'));
const CoachPage = lazy(() => import('./pages/CoachPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function PrivateRoute({ children }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/auth" replace />;
}

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8" aria-label="Carregando página">
      <Skeleton className="h-40 w-full rounded-[1.5rem]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="library" element={<PrivateRoute><LibraryPage /></PrivateRoute>} />
          <Route path="library/:id" element={<PrivateRoute><BookDetailPage /></PrivateRoute>} />
          <Route path="feed" element={<PrivateRoute><FeedPage /></PrivateRoute>} />
          <Route path="discover" element={<PrivateRoute><DiscoverPage /></PrivateRoute>} />
          <Route path="clubs" element={<PrivateRoute><ClubsPage /></PrivateRoute>} />
          <Route path="clubs/:id" element={<PrivateRoute><ClubDetailPage /></PrivateRoute>} />
          <Route path="coach" element={<PrivateRoute><CoachPage /></PrivateRoute>} />
          <Route path="achievements" element={<PrivateRoute><AchievementsPage /></PrivateRoute>} />
          <Route path="profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
