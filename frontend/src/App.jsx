import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AchievementsPage from './pages/AchievementsPage';
import AuthPage from './pages/AuthPage';
import DiscoverPage from './pages/DiscoverPage';
import FeedPage from './pages/FeedPage';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import ProfilePage from './pages/ProfilePage';
import { useAuthStore } from './stores/useAuthStore';

function PrivateRoute({ children }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="library" element={<PrivateRoute><LibraryPage /></PrivateRoute>} />
        <Route path="feed" element={<PrivateRoute><FeedPage /></PrivateRoute>} />
        <Route path="discover" element={<PrivateRoute><DiscoverPage /></PrivateRoute>} />
        <Route path="achievements" element={<PrivateRoute><AchievementsPage /></PrivateRoute>} />
        <Route path="profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
