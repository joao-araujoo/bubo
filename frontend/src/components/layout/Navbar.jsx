import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Rss, Trophy, User, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

function OwlLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="18" fill="#8A2BE2" fillOpacity="0.15" />
      <ellipse cx="18" cy="20" rx="10" ry="11" fill="#8A2BE2" />
      <ellipse cx="18" cy="16" rx="7" ry="7" fill="#9D3DFF" />
      <circle cx="15" cy="15" r="3" fill="#1E1E1E" />
      <circle cx="21" cy="15" r="3" fill="#1E1E1E" />
      <circle cx="15.8" cy="14.2" r="1.2" fill="#00FFFF" />
      <circle cx="21.8" cy="14.2" r="1.2" fill="#00FFFF" />
      <polygon points="17,18 18,16 19,18" fill="#FF9800" />
      <path d="M11 10 Q13 7 15 10" stroke="#8A2BE2" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M21 10 Q23 7 25 10" stroke="#8A2BE2" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="10" cy="22" rx="4" ry="6" fill="#7A1BD2" />
      <ellipse cx="26" cy="22" rx="4" ry="6" fill="#7A1BD2" />
    </svg>
  );
}

const navLinks = [
  { to: '/library', label: 'Library', Icon: BookOpen },
  { to: '/feed', label: 'Feed', Icon: Rss },
  { to: '/achievements', label: 'Achievements', Icon: Trophy }
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#1E1E1E]/90 backdrop-blur-md border-b border-[#BDBDBD]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <OwlLogo />
            <span className="text-xl font-bold gradient-text">Bubo</span>
          </Link>

          {token && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    location.pathname === to
                      ? 'bg-[#8A2BE2]/20 text-[#8A2BE2]'
                      : 'text-[#BDBDBD] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {token ? (
              <>
                <Link to="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#8A2BE2]/30 flex items-center justify-center">
                      <span className="text-sm font-bold text-[#8A2BE2]">
                        {user?.username?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                  <span className="text-sm text-[#BDBDBD] hidden sm:block">{user?.username}</span>
                </Link>
                <button onClick={handleLogout} className="p-2 rounded-xl text-[#BDBDBD] hover:text-white hover:bg-white/5 transition-colors">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <Link to="/auth" className="px-4 py-2 bg-[#8A2BE2] hover:bg-[#9D3DFF] text-white rounded-xl text-sm font-medium transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
