import { 
  LayoutDashboard, 
  History, 
  Settings as SettingsIcon, 
  Timer,
  FileText,
  Package,
  X
} from 'lucide-react';
import { useStore } from '../../store';
import type { Settings } from '../../types';
import { formatDuration } from '../../utils';
import { useTodayTotal } from '../../hooks';
import { useSettings } from '../../hooks/useSettings';
import { usePluginFrontend } from '../../hooks/usePluginFrontend';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onClose?: () => void;
}

const coreNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'history', label: 'History', icon: History },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'marketplace', label: 'Marketplace', icon: Package },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const;

export default function Sidebar({ currentView, onNavigate, onClose }: SidebarProps) {
  const isTrackingPaused = useStore((state) => state.isTrackingPaused);
  const isThinkingMode = useStore((state) => state.isThinkingMode);
  const { data: todayTotal = 0, isLoading: isLoadingTodayTotal } = useTodayTotal();
  // Use settings from store for immediate updates, fallback to useSettings query
  const storeSettings = useStore((state) => state.settings);
  const querySettingsResult = useSettings();
  const querySettings = querySettingsResult.data;
  const enableMarketplace = storeSettings.enable_marketplace ?? (querySettings as Settings | undefined)?.enable_marketplace ?? false;
  const { sidebarItems: pluginSidebarItems } = usePluginFrontend();
  
  // Combine core nav items with plugin sidebar items
  const navItems = [
    ...coreNavItems.map(item => ({
      ...item,
      order: item.id === 'dashboard' ? 0 : item.id === 'history' ? 1 : item.id === 'reports' ? 2 : item.id === 'marketplace' ? 4 : 5,
    })),
    ...pluginSidebarItems.map(item => ({
      id: item.route,
      label: item.label,
      icon: item.icon,
      order: item.order ?? 100,
    })),
  ].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center">
          <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
            <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <span className="ml-3 text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">TimeTracker</span>
        </div>
        {/* Close button for mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Today's Summary */}
      <div className="p-4 sm:p-5 mx-3 sm:mx-4 mt-3 sm:mt-4 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10 rounded-xl border border-primary-200/50 dark:border-primary-800/30 shadow-sm">
        <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold uppercase tracking-wide mb-2">Today</p>
        <p className="text-2xl sm:text-3xl font-bold text-primary-900 dark:text-primary-100 mb-2 sm:mb-3">
          {isLoadingTodayTotal ? '...' : formatDuration(todayTotal)}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
              isThinkingMode
                ? 'bg-[#00BCD4] shadow-sm shadow-[#00BCD4]/50'
                : !isTrackingPaused
                ? 'bg-green-500 shadow-sm shadow-green-500/50'
                : 'bg-gray-400'
            }`}
          />
          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
            {isThinkingMode ? 'Thinking' : isTrackingPaused ? 'Paused' : 'Tracking'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 sm:p-4 overflow-y-auto">
        <ul className="space-y-1 sm:space-y-2">
          {navItems.filter((item) => {
            // Hide marketplace if disabled in settings
            if (item.id === 'marketplace' && !enableMarketplace) {
              return false;
            }
            return true;
          }).map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onNavigate(item.id);
                    onClose?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:translate-x-1'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Левая часть - иконка и текст */}
                  <div className="flex items-center flex-1 min-w-0">
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                      isActive 
                        ? 'text-primary-600 dark:text-primary-400' 
                        : ''
                    }`} />
                    <span className="ml-2 sm:ml-3 truncate">
                      {item.label}
                    </span>
                  </div>
                  
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

    </aside>
  );
}
