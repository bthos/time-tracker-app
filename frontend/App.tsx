import { useState, useEffect } from 'react';
import { useStore, type View } from './store';
import { useSettings } from './hooks/useSettings';
import { useActivities } from './hooks/useActivities';
import { useCategories } from './hooks/useCategories';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import History from './components/History/History';
import { Reports } from './components/Reports';
import { Pomodoro } from './components/Pomodoro';
import Settings from './components/Settings/Settings';
import IdlePrompt from './components/IdlePrompt/IdlePrompt';
import ManualEntryModal from './components/ManualEntry/ManualEntryModal';
import { listen } from '@tauri-apps/api/event';
import type { ManualEntry } from './types';

const VALID_VIEWS: View[] = ['dashboard', 'history', 'reports', 'settings', 'pomodoro'];

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);
  const [idleDuration, setIdleDuration] = useState(0);
  const [idleStartedAt, setIdleStartedAt] = useState<number>(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ManualEntry | null>(null);

  const { isLoading: settingsLoading } = useSettings();
  const { isLoading: activitiesLoading, refetch: refetchActivities } = useActivities();
  const { isLoading: categoriesLoading } = useCategories();

  const isTrackingPaused = useStore((state) => state.isTrackingPaused);
  const darkMode = useStore((state) => state.settings.darkMode);

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
  useEffect(() => {
    let unlistenIdleReturn: (() => void) | undefined;
    let unlistenActivityUpdate: (() => void) | undefined;
    let unlistenNavigate: (() => void) | undefined;
    let unlistenOpenManualEntry: (() => void) | undefined;
    let unlistenStartThinkingMode: (() => void) | undefined;
    let unlistenTogglePause: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Listen for idle return events from Tauri backend
        unlistenIdleReturn = await listen<{ duration_minutes: number; started_at: number }>('idle-return', (event) => {
          const store = useStore.getState();
          const settings = store.settings;
          const idleDurationMinutes = event.payload.duration_minutes;
          const idlePromptThresholdMinutes = settings.idle_prompt_threshold_minutes || 5;
          
          // Filter by prompt threshold: only show prompt for periods >= threshold
          if (idleDurationMinutes < idlePromptThresholdMinutes) {
            // Don't show prompt for periods shorter than threshold
            return;
          }
          
          setIdleDuration(idleDurationMinutes);
          setIdleStartedAt(event.payload.started_at);
          setShowIdlePrompt(true);
        });

        // Listen for activity updates
        unlistenActivityUpdate = await listen('activity-updated', () => {
          refetchActivities();
        });

        // Listen for navigation events from tray
        unlistenNavigate = await listen<string>('navigate', (event) => {
          const view = event.payload;
          if (VALID_VIEWS.includes(view as View)) {
            setCurrentView(view as View);
          }
        });

        // Listen for open manual entry event
        unlistenOpenManualEntry = await listen('open-manual-entry', () => {
          setShowManualEntry(true);
        });

        // Listen for start thinking mode event
        unlistenStartThinkingMode = await listen('start-thinking-mode', async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/tauri');
            await invoke('start_thinking_mode');
            const store = useStore.getState();
            store.setIsThinkingMode(true);
            const { showSuccess } = await import('./utils/toast');
            showSuccess('Thinking mode started');
            refetchActivities();
          } catch (error) {
            const { handleApiError } = await import('./utils/toast');
            handleApiError(error, 'Failed to start thinking mode');
          }
        });

        // Listen for toggle pause event
        unlistenTogglePause = await listen('toggle-pause', async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/tauri');
            const store = useStore.getState();
            const isPaused = store.isTrackingPaused;
            if (isPaused) {
              await invoke('resume_tracking');
              store.setIsTrackingPaused(false);
              const { showSuccess } = await import('./utils/toast');
              showSuccess('Tracking resumed');
            } else {
              await invoke('pause_tracking');
              store.setIsTrackingPaused(true);
              const { showSuccess } = await import('./utils/toast');
              showSuccess('Tracking paused');
            }
          } catch (error) {
            const { handleApiError } = await import('./utils/toast');
            handleApiError(error, 'Failed to toggle tracking');
          }
        });
      } catch (error) {
        // Running in browser without Tauri - silently ignore
      }
    };

    setupListeners();

    return () => {
      if (unlistenIdleReturn) unlistenIdleReturn();
      if (unlistenActivityUpdate) unlistenActivityUpdate();
      if (unlistenNavigate) unlistenNavigate();
      if (unlistenOpenManualEntry) unlistenOpenManualEntry();
      if (unlistenStartThinkingMode) unlistenStartThinkingMode();
      if (unlistenTogglePause) unlistenTogglePause();
    };
  }, [refetchActivities]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N for new manual entry
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowManualEntry(true);
      }
      // Ctrl/Cmd + 1-5 for navigation
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const views: View[] = ['dashboard', 'history', 'reports', 'pomodoro', 'settings'];
        setCurrentView(views[parseInt(e.key) - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          project: editingEntry.project ?? null,
          startedAt: startedAtSec,
          endedAt: endedAtSec,
          projectId: editingEntry.project_id ?? null,
          taskId: editingEntry.task_id ?? null,
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

  const isLoading = settingsLoading || activitiesLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300 font-medium">Loading TimeTracker...</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
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
      case 'pomodoro':
        return <Pomodoro />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <Layout
        currentView={currentView}
        onViewChange={setCurrentView}
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
