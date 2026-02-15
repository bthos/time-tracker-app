import { FC } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: FC = () => {
  const { theme, toggleTheme } = useTheme();

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4 h-4" />;
      case 'dark':
        return <Moon className="w-4 h-4" />;
      case 'system':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
      default:
        return 'System';
    }
  };

  const getTogglePosition = () => {
    // Container is w-16 (64px), padding p-1 (4px), thumb is w-6 (24px)
    // Available space: 64px - 8px (padding) = 56px
    // Thumb width: 24px
    // Positions: Light (0px), System (16px), Dark (32px)
    switch (theme) {
      case 'light':
        return 'translate-x-0';
      case 'dark':
        return 'translate-x-[32px]'; // 56px - 24px = 32px
      case 'system':
        return 'translate-x-[16px]'; // (56px - 24px) / 2 = 16px
      default:
        return 'translate-x-[16px]';
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative w-16 h-8 rounded-full bg-gray-200 dark:bg-gray-700 p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      aria-label={`Toggle theme (current: ${getLabel()})`}
      title={`Current: ${getLabel()}`}
    >
      {/* Background icons - always visible */}
      <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
        <Sun className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <Monitor className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <Moon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
      </div>
      {/* Thumb slider */}
      <div
        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white dark:bg-gray-800 shadow-md transform transition-transform duration-200 ease-in-out flex items-center justify-center z-10 ${getTogglePosition()}`}
      >
        <div className="text-gray-700 dark:text-gray-300 flex items-center justify-center">
          {getIcon()}
        </div>
      </div>
    </button>
  );
};

export default ThemeToggle;
