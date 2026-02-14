import { useState, useEffect } from 'react';
import { useStore, type View } from './store';
import { useSettings } from './hooks/useSettings';
import { useActivities } from './hooks/useActivities';
import { useCategories } from './hooks/useCategories';
import { usePluginFrontend } from './hooks/usePluginFrontend';
import { useTauriEvents } from './hooks/useTauriEvents';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import History from './components/History/History';
import { Reports } from './components/Reports';
import Settings from './components/Settings/Settings';
import { Marketplace } from './components/Marketplace';
import IdlePrompt from './components/IdlePrompt/IdlePrompt';
import ManualEntryModal from './components/ManualEntry/ManualEntryModal';
import type { ManualEntry } from './types';
import type { PluginRoute } from './types/pluginFrontend';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);
  const [idleDuration, setIdleDuration] = useState(0);
  const [idleStartedAt, setIdleStartedAt] = useState<number>(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ManualEntry | null>(null);

  const { isLoading: settingsLoading } = useSettings();
  const { refetch: refetchActivities } = useActivities();
  const { routes: pluginRoutes } = usePluginFrontend();
  useCategories(); // ensure categories load (used by Layout/Dashboard/History)

  const isTrackingPaused = useStore((state) => state.isTrackingPaused);
  const darkMode = useStore((state) => state.settings.darkMode);

  // Splash: wait only for settings (theme, etc.). Rest of data loads in-place with skeletons.
  useEffect(() => {
    const updateSplashStatus = (window as Window & { updateSplashStatus?: (status: string) => void }).updateSplashStatus;
    const hideSplashScreen = (window as Window & { hideSplashScreen?: () => void }).hideSplashScreen;
    if (!updateSplashStatus || !hideSplashScreen) return;

    if (settingsLoading) {
      updateSplashStatus('Loading settings...');
    } else {
      updateSplashStatus('Ready');
      requestAnimationFrame(() => hideSplashScreen());
    }
  }, [settingsLoading]);

  // Apply dark mode theme on mount and when it changes
  useEffect(() => {
    const htmlElement = document.documentElement;
    if (darkMode) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen for Tauri events
  useTauriEvents({
    onIdleReturn: (durationMinutes, startedAt) => {
      setIdleDuration(durationMinutes);
      setIdleStartedAt(startedAt);
      setShowIdlePrompt(true);
    },
    onActivityUpdate: () => {
      refetchActivities();
    },
    onNavigate: (view) => {
      setCurrentView(view);
    },
    onOpenManualEntry: () => {
      setShowManualEntry(true);
    },
    onStartThinkingMode: () => {
      refetchActivities();
    },
  });

  // Handle keyboard shortcuts
  useKeyboardShortcuts({
    onNewManualEntry: () => {
      setShowManualEntry(true);
    },
    onNavigate: (view) => {
      setCurrentView(view);
    },
  });

  const handleIdleSubmit = async (categoryId: number, comment?: string) => {
    // Update existing idle activity with category and description
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      await invoke('submit_idle_activity', {
        categoryId: categoryId,
        comment: comment || null,
        startedAt: idleStartedAt,
      });
      const { showSuccess } = await import('./utils/toast');
      showSuccess('Idle activity updated');
      refetchActivities();
    } catch (error) {
      const { handleApiError } = await import('./utils/toast');
      handleApiError(error, 'Failed to update idle activity');
    }
    setShowIdlePrompt(false);
  };

  const handleIdleSkip = () => {
    setShowIdlePrompt(false);
  };

  const handleManualEntrySubmit = async (entry: {
    description: string;
    categoryId: number | null;
    startedAt: Date;
    endedAt: Date;
  }) => {
    const { invoke } = await import('@tauri-apps/api/tauri');
    const { showSuccess } = await import('./utils/toast');
    const { handleApiError } = await import('./utils/toast');
    const startedAtSec = Math.floor(entry.startedAt.getTime() / 1000);
    const endedAtSec = Math.floor(entry.endedAt.getTime() / 1000);
    try {
      if (editingEntry) {
        await invoke('update_manual_entry', {
          id: editingEntry.id,
          description: entry.description,
          categoryId: entry.categoryId,
          startedAt: startedAtSec,
          endedAt: endedAtSec,
        });
        showSuccess('Manual entry updated');
      } else {
        await invoke('add_manual_entry', {
          description: entry.description,
          categoryId: entry.categoryId,
          startedAt: startedAtSec,
          endedAt: endedAtSec,
        });
        showSuccess('Manual entry added');
      }
      refetchActivities();
      setShowManualEntry(false);
      setEditingEntry(null);
    } catch (error) {
      handleApiError(error, editingEntry ? 'Failed to update manual entry' : 'Failed to add manual entry');
    }
  };

  // Note: Loading screen is now handled by splash screen, so we don't show a separate loading screen here
  // The splash screen will be hidden once all data is loaded (see useEffect above)

  const renderView = () => {
    // Check for plugin routes first
    const pluginRoute = pluginRoutes.find((route: PluginRoute) => route.path === currentView);
    if (pluginRoute) {
      const Component = pluginRoute.component;
      
      // Validate that Component is actually a valid React component
      // React components are functions or classes, not objects
      if (typeof Component !== 'function') {
        console.error(
          `[Plugin Error] Invalid component type for route "${pluginRoute.path}". ` +
          `Expected a function or class component, but got: ${typeof Component}. ` +
          `Component value:`,
          Component
        );
        
        // Show error UI instead of crashing
        return (
          <div className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">
              Plugin Component Error
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              The plugin route "{pluginRoute.path}" registered an invalid component.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Expected a React component (function or class), but received: {typeof Component}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
              Check the plugin's registerRoute call - it should pass the component directly, not wrapped in an object.
            </p>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Go to Dashboard
            </button>
          </div>
        );
      }
      
      return <Component />;
    }
    
    // Core routes
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'history':
        return <History 
          onEditEntry={(entry) => setEditingEntry(entry)} 
          onNavigateToSettings={() => setCurrentView('settings')}
        />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      case 'marketplace': {
        // Check if marketplace is enabled
        const marketplaceEnabled = useStore.getState().settings.enable_marketplace ?? false;
        if (!marketplaceEnabled) {
          // Redirect to dashboard if marketplace is disabled
          setCurrentView('dashboard');
          return <Dashboard />;
        }
        return <Marketplace />;
      }
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <Layout
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view as View)}
        onAddEntry={() => setShowManualEntry(true)}
        isTrackingPaused={isTrackingPaused}
      >
        {renderView()}
      </Layout>

      {/* Idle Prompt Modal */}
      {showIdlePrompt && (
        <IdlePrompt
          durationMinutes={idleDuration}
          onSubmit={handleIdleSubmit}
          onSkip={handleIdleSkip}
          onNavigateToSettings={() => {
            const { setScrollToIdlePromptThreshold, setSettingsActiveTab } = useStore.getState();
            setSettingsActiveTab('general');
            setScrollToIdlePromptThreshold(true);
            setCurrentView('settings');
            setShowIdlePrompt(false);
          }}
        />
      )}

      {/* Manual Entry Modal */}
      {(showManualEntry || editingEntry) && (
        <ManualEntryModal
          editEntry={editingEntry}
          onSubmit={handleManualEntrySubmit}
          onClose={() => {
            setShowManualEntry(false);
            setEditingEntry(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
