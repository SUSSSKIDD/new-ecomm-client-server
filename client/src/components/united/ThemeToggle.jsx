import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-full transition-colors duration-200 
        ${theme === 'dark' 
          ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' 
          : 'bg-gray-100 text-slate-700 hover:bg-gray-200'} 
        ${className}`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
