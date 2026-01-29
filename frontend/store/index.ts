import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Activity, Category, Settings, ManualEntry, DateRange, DateRangePreset, PomodoroStatus } from '../types';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

type SettingsTab = 'general' | 'categories' | 'rules' | 'projects' | 'tasks' | 'goals' | 'about';

interface AppState {
  // UI State
  currentView: 'dashboard' | 'history' | 'settings';
  selectedDateRange: DateRange;
  dateRangePreset: DateRangePreset;
  isTrackingPaused: boolean;
  isThinkingMode: boolean;

  // Data
  activities: Activity[];
  categories: Category[];
  manualEntries: ManualEntry[];
  settings: Settings;

  // Pomodoro counter
  pomodoroWorkSessionsCount: number;
  lastPomodoroCycleDate: string | null;
  consecutiveWorkCount: number; // Count of consecutive work sessions
  consecutiveBreakCount: number; // Count of consecutive break sessions
  
  // Pomodoro status (shared across all components)
  pomodoroStatus: PomodoroStatus | null;

  // Settings navigation
  pendingRuleData: { rule_type: 'app_name' | 'window_title' | 'domain', pattern: string, category_id?: number } | null;
  settingsActiveTab: SettingsTab | null;
  scrollToIdlePromptThreshold: boolean;

  // Actions
  setCurrentView: (view: AppState['currentView']) => void;
  setSelectedDateRange: (range: DateRange) => void;
  setDateRangePreset: (preset: DateRangePreset) => void;
  getDateRange: () => DateRange;
  setIsTrackingPaused: (paused: boolean) => void;
  setIsThinkingMode: (thinking: boolean) => void;
  setActivities: (activities: Activity[]) => void;
  setCategories: (categories: Category[]) => void;
  setManualEntries: (entries: ManualEntry[]) => void;
  setSettings: (settings: Settings) => void;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  incrementPomodoroWorkSessions: () => void;
  resetPomodoroWorkSessions: () => void;
  syncPomodoroCounterFromDB: () => Promise<void>;
  incrementConsecutiveWork: () => void;
  incrementConsecutiveBreak: () => void;
  resetConsecutiveSessions: () => void;
  setPomodoroStatus: (status: PomodoroStatus | null) => void;
  setPendingRuleData: (data: { rule_type: 'app_name' | 'window_title' | 'domain', pattern: string, category_id?: number } | null) => void;
  setSettingsActiveTab: (tab: SettingsTab | null) => void;
  setScrollToIdlePromptThreshold: (scroll: boolean) => void;
}

const defaultSettings: Settings = {
  idle_threshold_minutes: 2,
  idle_prompt_threshold_minutes: 5,
  autostart: false,
  minimize_to_tray: false,
  show_notifications: true,
  date_format: 'YYYY-MM-DD',
  time_format: '24h',
  // Pomodoro settings
  pomodoro_work_duration_minutes: 25,
  pomodoro_short_break_minutes: 5,
  pomodoro_long_break_minutes: 15,
  pomodoro_sessions_until_long_break: 4,
  pomodoro_auto_transition_delay_seconds: 15,
  pomodoro_work_duration_seconds: 1500, // 25 minutes
  pomodoro_short_break_seconds: 300, // 5 minutes
  pomodoro_long_break_seconds: 900, // 15 minutes
  // Legacy properties for compatibility
  idleThreshold: 120, // seconds
  pollingInterval: 5, // seconds
  idlePromptThreshold: 300, // seconds
  autoStart: false,
  startMinimized: false,
  showInTray: true,
  theme: 'system',
  defaultCategory: null,
  shortIdleAsThinking: true,
  darkMode: false,
};

const store = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial UI State
      currentView: 'dashboard',
      selectedDateRange: {
        start: startOfDay(new Date()),
        end: endOfDay(new Date()),
      },
      dateRangePreset: 'today',
      isTrackingPaused: false,
      isThinkingMode: false,

      // Initial Data
      activities: [],
      categories: [],
      manualEntries: [],
      settings: defaultSettings,

      // Pomodoro counter
      pomodoroWorkSessionsCount: 0,
      lastPomodoroCycleDate: null,
      consecutiveWorkCount: 0,
      consecutiveBreakCount: 0,
      
      // Pomodoro status (not persisted - runtime only)
      pomodoroStatus: null,

      // Settings navigation (not persisted - runtime only)
      pendingRuleData: null,
      settingsActiveTab: null,

      // Actions
      setCurrentView: (view) => set({ currentView: view }),

      setSelectedDateRange: (range) => set({ 
        selectedDateRange: range,
        dateRangePreset: 'custom',
      }),

      setDateRangePreset: (preset) => {
        const now = new Date();
        let range: DateRange;

        switch (preset) {
          case 'today':
            range = {
              start: startOfDay(now),
              end: endOfDay(now),
            };
            break;
          case 'week':
            range = {
              start: startOfWeek(now, { weekStartsOn: 1 }), // Monday
              end: endOfWeek(now, { weekStartsOn: 1 }),
            };
            break;
          case 'month':
            range = {
              start: startOfMonth(now),
              end: endOfMonth(now),
            };
            break;
          case 'custom':
            range = get().selectedDateRange;
            break;
          default:
            range = {
              start: startOfDay(now),
              end: endOfDay(now),
            };
        }

        set({ 
          dateRangePreset: preset,
          selectedDateRange: range,
        });
      },

      getDateRange: () => {
        const state = get();
        const preset = state.dateRangePreset;
        const now = new Date();

        switch (preset) {
          case 'today':
            return {
              start: startOfDay(now),
              end: endOfDay(now),
            };
          case 'week':
            return {
              start: startOfWeek(now, { weekStartsOn: 1 }),
              end: endOfWeek(now, { weekStartsOn: 1 }),
            };
          case 'month':
            return {
              start: startOfMonth(now),
              end: endOfMonth(now),
            };
          case 'custom': {
            // Ensure dates are Date objects (they might be strings after localStorage deserialization)
            const customRange = state.selectedDateRange;
            return {
              start: customRange.start instanceof Date ? customRange.start : new Date(customRange.start),
              end: customRange.end instanceof Date ? customRange.end : new Date(customRange.end),
            };
          }
          default:
            return {
              start: startOfDay(now),
              end: endOfDay(now),
            };
        }
      },

      setIsTrackingPaused: (paused) => set({ isTrackingPaused: paused }),

      setIsThinkingMode: (thinking) => set({ isThinkingMode: thinking }),

      setActivities: (activities) => set({ activities }),

      setCategories: (categories) => set({ categories }),

      setManualEntries: (entries) => set({ manualEntries: entries }),

      setSettings: (settings) => set({ settings }),

      updateSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        })),

      incrementPomodoroWorkSessions: () =>
        set((state) => ({
          pomodoroWorkSessionsCount: state.pomodoroWorkSessionsCount + 1,
        })),

      resetPomodoroWorkSessions: () =>
        set({
          pomodoroWorkSessionsCount: 0,
          lastPomodoroCycleDate: new Date().toISOString().split('T')[0],
        }),

      incrementConsecutiveWork: () =>
        set((state) => ({
          consecutiveWorkCount: state.consecutiveWorkCount + 1,
        })),

      incrementConsecutiveBreak: () =>
        set((state) => ({
          consecutiveBreakCount: state.consecutiveBreakCount + 1,
        })),

      resetConsecutiveSessions: () =>
        set({
          consecutiveWorkCount: 0,
          consecutiveBreakCount: 0,
        }),

      syncPomodoroCounterFromDB: async () => {
        try {
          const { api } = await import('../services/api');
          const count = await api.pomodoro.getCompletedWorkSessionsCountToday();
          const today = new Date().toISOString().split('T')[0];
          
          set((state) => {
            // Если дата последнего сброса != сегодня, сбросить счетчики
            if (state.lastPomodoroCycleDate !== today) {
              return {
                pomodoroWorkSessionsCount: count,
                lastPomodoroCycleDate: today,
                consecutiveWorkCount: 0,
                consecutiveBreakCount: 0,
              };
            }
            // Использовать значение из БД если оно отличается
            return {
              pomodoroWorkSessionsCount: count,
            };
          });
        } catch (error) {
          // Silently handle error - counter sync failed
        }
      },
      
      setPomodoroStatus: (status) => set({ pomodoroStatus: status }),
      
      setPendingRuleData: (data) => set({ pendingRuleData: data }),
      
      setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
      
      setScrollToIdlePromptThreshold: (scroll) => set({ scrollToIdlePromptThreshold: scroll }),
    }),
    {
      name: 'timetracker-storage',
      partialize: (state) => ({
        settings: state.settings,
        isTrackingPaused: state.isTrackingPaused,
        dateRangePreset: state.dateRangePreset,
        selectedDateRange: state.selectedDateRange,
        pomodoroWorkSessionsCount: state.pomodoroWorkSessionsCount,
        lastPomodoroCycleDate: state.lastPomodoroCycleDate,
        // Don't persist consecutive counters - they should reset on app restart
        // consecutiveWorkCount: state.consecutiveWorkCount,
        // consecutiveBreakCount: state.consecutiveBreakCount,
      }),
      onRehydrateStorage: () => (state) => {
        // Convert date strings back to Date objects after rehydration
        if (state?.selectedDateRange) {
          const range = state.selectedDateRange;
          if (range.start && !(range.start instanceof Date)) {
            state.selectedDateRange = {
              start: new Date(range.start),
              end: range.end && !(range.end instanceof Date) ? new Date(range.end) : range.end,
            };
          } else if (range.end && !(range.end instanceof Date)) {
            state.selectedDateRange = {
              ...range,
              end: new Date(range.end),
            };
          }
        }
      },
    }
  )
);

export const useStore = store;
export type { SettingsTab };
export default store;
