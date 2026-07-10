import React from 'react';
import { Moon, Sun } from 'lucide-react';
import Button from '../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      leftIcon={isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    >
      <span className="sr-only">{isDark ? 'Tema claro' : 'Tema escuro'}</span>
    </Button>
  );
}
