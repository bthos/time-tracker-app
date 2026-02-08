import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../store';
import { Settings as SettingsType, Rule } from '../../types';
import Button from '../Common/Button';
import Toggle from '../Common/Toggle';
import { api } from '../../services/api';
import { useRules } from '../../hooks/useRules';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useResetSystemCategory } from '../../hooks/useCategories';
import { useProjects } from '../../hooks/useProjects';
import { useTasks } from '../../hooks/useTasks';
import { usePluginFrontend } from '../../hooks/usePluginFrontend';
import { Category } from '../../types';
import { Check, X, Trash2, Edit2, RotateCcw, Settings as SettingsIcon, Tag, FileText, Info, Folder, CheckSquare, Target } from 'lucide-react';
import { Projects } from '../Projects';
import { Tasks } from '../Tasks';
import { Goals } from '../Goals';
import { ErrorBoundary } from '../Common/ErrorBoundary';
import type { PluginSettingsTab } from '../../types/pluginFrontend';

interface SettingsProps {
  onClose?: () => void;
}

type SettingsTab = 'general' | 'categories' | 'rules' | 'projects' | 'tasks' | 'goals' | 'about' | string;

const Settings: React.FC<SettingsProps> = () => {
  const { settings, setSettings, categories, pendingRuleData, settingsActiveTab, scrollToIdlePromptThreshold, setPendingRuleData, setSettingsActiveTab, setScrollToIdlePromptThreshold } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { settingsTabs: pluginTabs } = usePluginFrontend();
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [isSaving, setIsSaving] = useState(false);

  const { rules, isLoading: rulesLoading, createRule, updateRule, deleteRule } = useRules();
  const { data: categoriesData = [] } = useCategories();
  const { projects } = useProjects(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const { tasks } = useTasks(selectedProjectId || undefined, false);
  const { tasks: editingTasks } = useTasks(editingProjectId || undefined, false);
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const resetSystemCategoryMutation = useResetSystemCategory();
  const queryClient = useQueryClient();
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [isReapplyingRules, setIsReapplyingRules] = useState(false);
  const [newCategory, setNewCategory] = useState<Partial<Category> | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [newRule, setNewRule] = useState<Partial<Rule>>({
    rule_type: 'app_name',
    pattern: '',
    category_id: undefined,
    priority: 0,
  });

  // Sync localSettings with store settings when they change
  // Convert backend format (minutes) to frontend format (seconds) for input fields
  // Use ref to track if user is editing to prevent overwriting
  const isEditingRef = useRef(false);
  
  useEffect(() => {
    // Only sync if user is not currently editing
    if (!isEditingRef.current) {
      setLocalSettings({
        ...settings,
        // Use exact seconds if available, otherwise calculate from minutes
        idleThreshold: settings.idleThreshold ?? settings.idle_threshold_seconds ?? (settings.idle_threshold_minutes ?? 2) * 60,
        idlePromptThreshold: settings.idlePromptThreshold ?? settings.idle_prompt_threshold_seconds ?? (settings.idle_prompt_threshold_minutes ?? 5) * 60,
      });
    }
  }, [settings]);

  // Update category_id when categories are loaded
  useEffect(() => {
    if (categoriesData.length > 0 && !newRule.category_id) {
      setNewRule(prev => ({
        ...prev,
        category_id: categoriesData[0].id,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesData.length]);

  // Sync activeTab with store on mount
  useEffect(() => {
    if (settingsActiveTab) {
      setActiveTab(settingsActiveTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Sync activeTab changes to store
  useEffect(() => {
    setSettingsActiveTab(activeTab);
  }, [activeTab, setSettingsActiveTab]);

  // Handle scroll to idle prompt threshold
  useEffect(() => {
    if (scrollToIdlePromptThreshold && activeTab === 'general') {
      // Wait for DOM to be ready and tab to be active
      const timer = setTimeout(() => {
        const element = document.getElementById('idle-prompt-threshold');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the input field briefly
          const input = element.querySelector('input');
          if (input) {
            input.focus();
            input.style.transition = 'box-shadow 0.3s ease';
            input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';
            setTimeout(() => {
              input.style.boxShadow = '';
            }, 2000);
          }
          // Reset the flag
          setScrollToIdlePromptThreshold(false);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scrollToIdlePromptThreshold, activeTab, setScrollToIdlePromptThreshold]);

  // Handle pendingRuleData - prefill form for creating new rule
  useEffect(() => {
    if (pendingRuleData && activeTab === 'rules') {
      // Предзаполнить форму создания нового правила
      setNewRule({
        rule_type: pendingRuleData.rule_type,
        pattern: pendingRuleData.pattern,
        category_id: pendingRuleData.category_id || categoriesData[0]?.id || undefined,
        priority: 0,
      });
      
      // Показать форму создания (не редактирования)
      setShowNewRuleForm(true);
      setEditingRuleId(null);
      
      // Очистить pendingRuleData
      setPendingRuleData(null);
      setSettingsActiveTab(null);
    }
  }, [pendingRuleData, activeTab, categoriesData, setPendingRuleData, setSettingsActiveTab]);
  
  const handleSettingChange = <K extends keyof SettingsType>(
    key: K,
    value: SettingsType[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert frontend format to backend format
      const { showInfo } = await import('../../utils/toast');
      
      // Get values from localSettings, use fallback if not set
      // Use the value from localSettings if it exists and is a valid number
      const idleThresholdInput = localSettings.idleThreshold;
      const idlePromptThresholdInput = localSettings.idlePromptThreshold;
      
      let idleThresholdSec: number;
      if (typeof idleThresholdInput === 'number' && !isNaN(idleThresholdInput) && isFinite(idleThresholdInput)) {
        idleThresholdSec = idleThresholdInput;
        // Validate minimum
        if (idleThresholdSec < 30) {
          showInfo('Idle threshold cannot be less than 30 seconds. Set to 30 seconds.');
          idleThresholdSec = 30;
        }
      } else {
        // Use fallback from backend format
        idleThresholdSec = (localSettings.idle_threshold_minutes ?? 2) * 60;
      }
      
      let idlePromptThresholdSec: number;
      if (typeof idlePromptThresholdInput === 'number' && !isNaN(idlePromptThresholdInput) && isFinite(idlePromptThresholdInput)) {
        idlePromptThresholdSec = idlePromptThresholdInput;
        // Validate minimum
        if (idlePromptThresholdSec < 60) {
          showInfo('Idle prompt threshold cannot be less than 60 seconds. Set to 60 seconds.');
          idlePromptThresholdSec = 60;
        }
      } else {
        // Use fallback from backend format
        const fallbackValue = (localSettings.idle_prompt_threshold_minutes ?? 5) * 60;
        idlePromptThresholdSec = fallbackValue;
      }
      
      // Pomodoro settings - convert minutes to seconds
      const pomodoroWorkMinutes = localSettings.pomodoro_work_duration_minutes ?? 25;
      const pomodoroShortBreakMinutes = localSettings.pomodoro_short_break_minutes ?? 5;
      const pomodoroLongBreakMinutes = localSettings.pomodoro_long_break_minutes ?? 15;
      const pomodoroSessionsUntilLongBreak = localSettings.pomodoro_sessions_until_long_break ?? 4;
      const pomodoroAutoTransitionDelay = localSettings.pomodoro_auto_transition_delay_seconds ?? 30;
      
      // Validate and convert to seconds
      const pomodoroWorkSec = Math.max(60, pomodoroWorkMinutes * 60);
      const pomodoroShortBreakSec = Math.max(60, pomodoroShortBreakMinutes * 60);
      const pomodoroLongBreakSec = Math.max(60, pomodoroLongBreakMinutes * 60);
      const pomodoroSessions = Math.max(1, Math.min(10, pomodoroSessionsUntilLongBreak));
      const pomodoroAutoTransitionDelaySec = Math.max(0, Math.min(300, pomodoroAutoTransitionDelay));
      
      // Send exact seconds to preserve precision, backend will calculate minutes from seconds
      const backendSettings = {
        idle_threshold_minutes: Math.max(0.5, Math.floor(idleThresholdSec / 60)),
        idle_prompt_threshold_minutes: Math.max(1, Math.floor(idlePromptThresholdSec / 60)),
        idle_threshold_seconds: idleThresholdSec,
        idle_prompt_threshold_seconds: idlePromptThresholdSec,
        autostart: localSettings.autoStart ?? localSettings.autostart ?? false,
        minimize_to_tray: ('minimizeToTray' in localSettings ? (localSettings as SettingsType & { minimizeToTray?: boolean }).minimizeToTray : undefined) ?? localSettings.minimize_to_tray ?? false,
        show_notifications: ('showNotifications' in localSettings ? (localSettings as SettingsType & { showNotifications?: boolean }).showNotifications : undefined) ?? localSettings.show_notifications ?? true,
        enable_marketplace: localSettings.enable_marketplace ?? false,
        date_format: localSettings.date_format || 'YYYY-MM-DD',
        time_format: localSettings.time_format || '24h',
        pomodoro_work_duration_minutes: Math.floor(pomodoroWorkSec / 60),
        pomodoro_short_break_minutes: Math.floor(pomodoroShortBreakSec / 60),
        pomodoro_long_break_minutes: Math.floor(pomodoroLongBreakSec / 60),
        pomodoro_sessions_until_long_break: pomodoroSessions,
        pomodoro_auto_transition_delay_seconds: pomodoroAutoTransitionDelaySec,
        pomodoro_work_duration_seconds: pomodoroWorkSec,
        pomodoro_short_break_seconds: pomodoroShortBreakSec,
        pomodoro_long_break_seconds: pomodoroLongBreakSec,
      };
      await api.settings.updateSettings(backendSettings);
      // Reset editing flag before fetching updated settings
      isEditingRef.current = false;
      // Fetch updated settings from backend
      const updated = await api.settings.getSettings();
      // Convert backend format back to frontend format
      // Use exact seconds if available, otherwise calculate from minutes
      // Preserve frontend-only settings like darkMode from current settings
      const currentSettings = useStore.getState().settings;
      const frontendSettings: SettingsType = {
        ...updated,
        idleThreshold: updated.idle_threshold_seconds ?? (updated.idle_threshold_minutes * 60),
        idlePromptThreshold: updated.idle_prompt_threshold_seconds ?? (updated.idle_prompt_threshold_minutes * 60),
        autoStart: updated.autostart,
        minimize_to_tray: updated.minimize_to_tray,
        show_notifications: updated.show_notifications,
        enable_marketplace: updated.enable_marketplace ?? false,
        pollingInterval: localSettings.pollingInterval ?? currentSettings.pollingInterval ?? 5,
        startMinimized: localSettings.startMinimized ?? currentSettings.startMinimized ?? false,
        showInTray: localSettings.showInTray ?? currentSettings.showInTray ?? true,
        theme: localSettings.theme ?? currentSettings.theme ?? 'system',
        defaultCategory: localSettings.defaultCategory ?? currentSettings.defaultCategory ?? null,
        shortIdleAsThinking: localSettings.shortIdleAsThinking ?? currentSettings.shortIdleAsThinking ?? true,
        darkMode: localSettings.darkMode ?? currentSettings.darkMode ?? false,
        autoCategorizationEnabled: localSettings.autoCategorizationEnabled ?? currentSettings.autoCategorizationEnabled ?? true,
        pomodoro_work_duration_minutes: updated.pomodoro_work_duration_minutes,
        pomodoro_short_break_minutes: updated.pomodoro_short_break_minutes,
        pomodoro_long_break_minutes: updated.pomodoro_long_break_minutes,
        pomodoro_sessions_until_long_break: updated.pomodoro_sessions_until_long_break,
        pomodoro_auto_transition_delay_seconds: updated.pomodoro_auto_transition_delay_seconds,
        pomodoro_work_duration_seconds: updated.pomodoro_work_duration_seconds,
        pomodoro_short_break_seconds: updated.pomodoro_short_break_seconds,
        pomodoro_long_break_seconds: updated.pomodoro_long_break_seconds,
      };
      setSettings(frontendSettings);
      
      // Update localSettings with saved values to reflect what was actually saved
      setLocalSettings({
        ...frontendSettings,
        idleThreshold: frontendSettings.idleThreshold,
        idlePromptThreshold: frontendSettings.idlePromptThreshold,
      });
      
      // Apply dark mode immediately after saving
      const htmlElement = document.documentElement;
      if (frontendSettings.darkMode) {
        htmlElement.classList.add('dark');
      } else {
        htmlElement.classList.remove('dark');
      }
      
      // Invalidate settings query to update Sidebar and other components
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Settings saved successfully');
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };
  
  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'rules', label: 'Rules', icon: FileText },
    { id: 'projects', label: 'Projects', icon: Folder },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'about', label: 'About', icon: Info },
  ];
  
  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* Application Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Application Settings
        </h3>
        
        <div className="space-y-4">
          <Toggle
            checked={localSettings.autoStart ?? false}
            onChange={(checked) => handleSettingChange('autoStart', checked)}
            label="Autostart with System"
            description="Launch application on system login"
          />
          
          <Toggle
            checked={('minimizeToTray' in localSettings ? (localSettings as SettingsType & { minimizeToTray?: boolean }).minimizeToTray : undefined) ?? localSettings.minimize_to_tray}
            onChange={(checked) => {
              const newSettings = { ...localSettings, minimizeToTray: checked, minimize_to_tray: checked };
              setLocalSettings(newSettings);
            }}
            label="Minimize to Tray"
            description="Minimize to system tray when closing window"
          />
          
          <Toggle
            checked={('showNotifications' in localSettings ? (localSettings as SettingsType & { showNotifications?: boolean }).showNotifications : undefined) ?? localSettings.show_notifications}
            onChange={(checked) => {
              const newSettings = { ...localSettings, showNotifications: checked, show_notifications: checked };
              setLocalSettings(newSettings);
            }}
            label="Show Notifications"
            description="Tracking status notifications"
          />
          
          <Toggle
            checked={localSettings.darkMode ?? false}
            onChange={(checked) => {
              const newDarkMode = checked;
              handleSettingChange('darkMode', newDarkMode);
              // Apply theme immediately
              const htmlElement = document.documentElement;
              if (newDarkMode) {
                htmlElement.classList.add('dark');
              } else {
                htmlElement.classList.remove('dark');
              }
              // Update store immediately for instant feedback
              setSettings({ ...localSettings, darkMode: newDarkMode });
            }}
            label="Dark Theme"
            description="Use dark appearance"
          />
          
          <Toggle
            checked={localSettings.enable_marketplace ?? false}
            onChange={(checked) => {
              handleSettingChange('enable_marketplace', checked);
              // Update store immediately for instant feedback in Sidebar
              setSettings({ ...localSettings, enable_marketplace: checked });
            }}
            label="Marketplace"
            description="Show plugin marketplace in navigation"
          />
        </div>
      </div>
      
      {/* Tracking Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tracking Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Polling Interval (seconds)
            </label>
            <input
              type="number"
              value={localSettings.pollingInterval}
              onChange={(e) => handleSettingChange('pollingInterval', Number(e.target.value))}
              min={1}
              max={60}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              How often to check the active window
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Idle Threshold (seconds)
            </label>
            <input
              type="number"
              value={localSettings.idleThreshold ?? ''}
              onChange={(e) => {
                isEditingRef.current = true;
                const value = e.target.value === '' ? undefined : Number(e.target.value);
                handleSettingChange('idleThreshold', value);
              }}
              onBlur={() => {
                // Reset editing flag after a short delay to allow save to complete
                setTimeout(() => {
                  isEditingRef.current = false;
                }, 100);
              }}
              min={30}
              max={3600}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Time without activity to determine as "idle"
            </p>
          </div>
          
          <div id="idle-prompt-threshold">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Idle Prompt Threshold (seconds)
            </label>
            <input
              type="number"
              value={localSettings.idlePromptThreshold ?? ''}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : Number(e.target.value);
                handleSettingChange('idlePromptThreshold', value);
              }}
              min={60}
              max={3600}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Ask what you were doing when idle longer than specified time
            </p>
          </div>
        </div>
      </div>
      
      {/* Pomodoro Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Pomodoro Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Work Duration (minutes)
            </label>
            <input
              type="number"
              value={localSettings.pomodoro_work_duration_minutes ?? 25}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : Number(e.target.value);
                handleSettingChange('pomodoro_work_duration_minutes', value);
              }}
              min={1}
              max={120}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Duration of a work session. Classic Pomodoro technique uses 25 minutes.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Short Break Duration (minutes)
            </label>
            <input
              type="number"
              value={localSettings.pomodoro_short_break_minutes ?? 5}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : Number(e.target.value);
                handleSettingChange('pomodoro_short_break_minutes', value);
              }}
              min={1}
              max={60}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Duration of a short break between work sessions. Classic Pomodoro technique uses 5 minutes.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Long Break Duration (minutes)
            </label>
            <input
              type="number"
              value={localSettings.pomodoro_long_break_minutes ?? 15}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : Number(e.target.value);
                handleSettingChange('pomodoro_long_break_minutes', value);
              }}
              min={1}
              max={120}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Duration of a long break after several work sessions. Classic Pomodoro technique uses 15 minutes.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sessions Until Long Break
            </label>
            <input
              type="number"
              value={localSettings.pomodoro_sessions_until_long_break ?? 4}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : Number(e.target.value);
                handleSettingChange('pomodoro_sessions_until_long_break', value);
              }}
              min={1}
              max={10}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Number of work sessions before taking a long break. Classic Pomodoro technique uses 4 sessions.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Auto Transition Delay (seconds)
            </label>
            <input
              type="number"
              value={localSettings.pomodoro_auto_transition_delay_seconds ?? 15}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : Number(e.target.value);
                handleSettingChange('pomodoro_auto_transition_delay_seconds', value);
              }}
              min={0}
              max={300}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Delay before automatically starting the next session after completion. Set to 0 to disable auto-transition.
            </p>
          </div>
        </div>
      </div>
      
      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
  
  const handleCreateCategory = async () => {
    if (!newCategory || !newCategory.name?.trim()) {
      const { showError } = await import('../../utils/toast');
      showError('Please enter a category name');
      return;
    }

    try {
      await createCategoryMutation.mutateAsync({
        name: newCategory.name.trim(),
        color: newCategory.color || '#888888',
        icon: newCategory.icon || '📁',
        is_productive: newCategory.is_productive !== undefined ? newCategory.is_productive : true,
        is_billable: newCategory.is_billable !== undefined ? newCategory.is_billable : false,
        hourly_rate: newCategory.hourly_rate ?? null,
        sort_order: categories.length,
        is_pinned: newCategory.is_pinned ?? false,
        project_id: newCategory.project_id ?? null,
        task_id: newCategory.task_id ?? null,
      });
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Category created successfully');
      setNewCategory(null);
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to create category');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingProjectId(category.project_id || null);
    setEditingCategory({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      is_productive: category.is_productive,
      is_billable: category.is_billable,
      hourly_rate: category.hourly_rate,
      sort_order: category.sort_order,
      is_pinned: category.is_pinned ?? false,
      project_id: category.project_id ?? null,
      task_id: category.task_id ?? null,
    });
    setSelectedProjectId(null); // Clear new category project selection
    setNewCategory(null); // Close creation form if open
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.name?.trim() || !editingCategoryId) {
      const { showError } = await import('../../utils/toast');
      showError('Please enter a category name');
      return;
    }

    try {
      await updateCategoryMutation.mutateAsync({
        id: editingCategoryId,
        name: editingCategory.name.trim(),
        color: editingCategory.color || '#888888',
        icon: editingCategory.icon || '📁',
        is_productive: editingCategory.is_productive !== undefined 
          ? editingCategory.is_productive 
          : null,
        is_billable: editingCategory.is_billable !== undefined 
          ? editingCategory.is_billable 
          : null,
        hourly_rate: editingCategory.hourly_rate ?? null,
        sort_order: editingCategory.sort_order ?? 0,
        is_pinned: editingCategory.is_pinned ?? false,
        project_id: editingCategory.project_id ?? null,
        task_id: editingCategory.task_id ?? null,
      });
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Category updated successfully');
      setEditingCategoryId(null);
      setEditingCategory(null);
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCategoryMutation.mutateAsync(id);
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Category deleted successfully');
      setEditingCategoryId(null);
      setEditingCategory(null);
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to delete category');
    }
  };

  const renderCategoriesSettings = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Organize and manage your activity categories
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => {
              setNewCategory({ name: '', color: '#888888', icon: '📁', is_productive: true, is_billable: false, hourly_rate: null, is_pinned: false, project_id: null, task_id: null });
              setSelectedProjectId(null);
              setEditingCategoryId(null);
              setEditingCategory(null);
            }}
          >
            + New Category
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Categories
          </h3>
        </div>
        
        {/* New Category Form */}
        {newCategory && (
          <div className="mb-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Icon
                </label>
                <input
                  type="text"
                  value={newCategory.icon || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  maxLength={2}
                  placeholder="📁"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newCategory.name || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newCategory.color || '#888888'}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newCategory.color || '#888888'}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="#888888"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Productivity Status
                </label>
                <select
                  value={newCategory.is_productive === true ? 'productive' : newCategory.is_productive === false ? 'unproductive' : 'neutral'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewCategory({
                      ...newCategory,
                      is_productive: value === 'productive' ? true : value === 'unproductive' ? false : null
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="productive">✓ Productive</option>
                  <option value="unproductive">✗ Unproductive</option>
                  <option value="neutral">— Neutral</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Project (optional)
                </label>
                <select
                  value={newCategory.project_id || ''}
                  onChange={(e) => {
                    const projectId = e.target.value ? parseInt(e.target.value) : null;
                    setSelectedProjectId(projectId);
                    setNewCategory({ ...newCategory, project_id: projectId, task_id: null });
                  }}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">None</option>
                  {projects.filter(p => !p.is_archived).map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Task (optional)
                </label>
                <select
                  value={newCategory.task_id || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, task_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={!newCategory.project_id}
                >
                  <option value="">None</option>
                  {newCategory.project_id && tasks?.filter(t => !t.is_archived).map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Toggle
                  checked={newCategory.is_billable === true}
                  onChange={(checked) => {
                    setNewCategory({ 
                      ...newCategory, 
                      is_billable: checked,
                      hourly_rate: checked ? newCategory.hourly_rate : null
                    });
                  }}
                  label="Billable"
                  description="Enable billing for this category"
                />
                {newCategory.is_billable === true && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hourly Rate
                    </label>
                    <input
                      type="number"
                      value={newCategory.hourly_rate || ''}
                      onChange={(e) => setNewCategory({ ...newCategory, hourly_rate: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                )}
              </div>
              <div>
                <Toggle
                  checked={newCategory.is_pinned === true}
                  onChange={(checked) => {
                    setNewCategory({ 
                      ...newCategory, 
                      is_pinned: checked
                    });
                  }}
                  label="Pinned"
                  description="Show in quick selection forms"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button 
                variant="success"
                size="sm" 
                onClick={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
              >
                {createCategoryMutation.isPending ? (
                  'Creating...'
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Create
                  </>
                )}
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => setNewCategory(null)}
              >
                ✕ Cancel
              </Button>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category.id}>
              {editingCategoryId === category.id && editingCategory ? (
                // Edit Form
                <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Icon
                      </label>
                      <input
                        type="text"
                        value={editingCategory.icon || ''}
                        onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        maxLength={2}
                        placeholder="📁"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={editingCategory.name || ''}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="Category name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editingCategory.color || '#888888'}
                          onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editingCategory.color || '#888888'}
                          onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                          className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          placeholder="#888888"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Productivity Status
                      </label>
                      <select
                        value={editingCategory.is_productive === true ? 'productive' : editingCategory.is_productive === false ? 'unproductive' : 'neutral'}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEditingCategory({
                            ...editingCategory,
                            is_productive: value === 'productive' ? true : value === 'unproductive' ? false : null
                          });
                        }}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="productive">✓ Productive</option>
                        <option value="unproductive">✗ Unproductive</option>
                        <option value="neutral">— Neutral</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Default Project (optional)
                      </label>
                      <select
                        value={editingCategory.project_id || ''}
                        onChange={(e) => {
                          const projectId = e.target.value ? parseInt(e.target.value) : null;
                          setEditingProjectId(projectId);
                          setEditingCategory({ ...editingCategory, project_id: projectId, task_id: null });
                        }}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">None</option>
                        {projects.filter(p => !p.is_archived).map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Default Task (optional)
                      </label>
                      <select
                        value={editingCategory.task_id || ''}
                        onChange={(e) => setEditingCategory({ ...editingCategory, task_id: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        disabled={!editingProjectId && !editingCategory.project_id}
                      >
                        <option value="">None</option>
                        {(editingProjectId || editingCategory.project_id) && editingTasks?.filter(t => !t.is_archived).map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Toggle
                        checked={editingCategory.is_billable === true}
                        onChange={(checked) => {
                          setEditingCategory({ 
                            ...editingCategory, 
                            is_billable: checked,
                            hourly_rate: checked ? editingCategory.hourly_rate : null
                          });
                        }}
                        label="Billable"
                        description="Enable billing for this category"
                      />
                      {editingCategory.is_billable === true && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Hourly Rate
                          </label>
                          <input
                            type="number"
                            value={editingCategory.hourly_rate || ''}
                            onChange={(e) => setEditingCategory({ ...editingCategory, hourly_rate: e.target.value ? parseFloat(e.target.value) : null })}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <Toggle
                        checked={editingCategory.is_pinned === true}
                        onChange={(checked) => {
                          setEditingCategory({ 
                            ...editingCategory, 
                            is_pinned: checked
                          });
                        }}
                        label="Pinned"
                        description="Show in quick selection forms"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex gap-2">
                      <Button 
                        variant="success"
                        size="sm" 
                        onClick={handleUpdateCategory}
                        disabled={updateCategoryMutation.isPending}
                      >
                        {updateCategoryMutation.isPending ? (
                          'Saving...'
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => {
                          setEditingCategoryId(null);
                          setEditingCategory(null);
                          setEditingProjectId(null);
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                    {category.is_system ? (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={async () => {
                          if (editingCategoryId && confirm('Reset category to default settings?')) {
                            try {
                              const resetCategory = await resetSystemCategoryMutation.mutateAsync(editingCategoryId);
                              const { showSuccess } = await import('../../utils/toast');
                              showSuccess('Category reset to default settings');
                              // Update editing category with reset values
                              setEditingCategory(resetCategory);
                            } catch (error) {
                              const { handleApiError } = await import('../../utils/toast');
                              handleApiError(error, 'Failed to reset category');
                            }
                          }
                        }}
                        disabled={resetSystemCategoryMutation.isPending || updateCategoryMutation.isPending}
                      >
                        {resetSystemCategoryMutation.isPending ? (
                          'Resetting...'
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reset
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="danger" 
                        onClick={() => {
                          if (editingCategoryId && confirm('Delete category? Records will be marked as "Uncategorized"')) {
                            handleDeleteCategory(editingCategoryId);
                          }
                        }}
                        disabled={updateCategoryMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                // Category Display
                <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: category.color + '20' }}
                  >
                    {category.icon}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {category.is_productive === true && '✓ Productive'}
                      {category.is_productive === false && '✗ Unproductive'}
                      {category.is_productive === null && '— Neutral'}
                    </p>
                  </div>
                  
                  <div
                    className="w-6 h-6 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: category.color }}
                  />
                  
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => handleEditCategory(category)}
                    title="Edit category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  
  const handleCreateRule = async () => {
    if (isCreatingRule) return; // Prevent double clicks
    
    try {
      setIsCreatingRule(true);
      
      // Validate required fields
      if (!newRule.pattern || !newRule.pattern.trim()) {
        const { showError } = await import('../../utils/toast');
        showError('Please enter a pattern');
        return;
      }
      
      if (!newRule.category_id) {
        const { showError } = await import('../../utils/toast');
        showError('Please select a category');
        return;
      }

      // Ensure priority is a valid number
      const priority = newRule.priority !== undefined && !isNaN(newRule.priority) 
        ? newRule.priority 
        : 0;

      const ruleToCreate: Omit<Rule, 'id'> = {
        rule_type: newRule.rule_type || 'app_name',
        pattern: newRule.pattern.trim(),
        category_id: newRule.category_id,
        priority: priority,
      };

      await createRule(ruleToCreate);
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Rule created successfully');
      
      setNewRule({
        rule_type: 'app_name',
        pattern: '',
        category_id: categoriesData[0]?.id || 1,
        priority: 0,
      });
      setShowNewRuleForm(false);
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to create rule');
    } finally {
      setIsCreatingRule(false);
    }
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setNewRule({
      rule_type: rule.rule_type,
      pattern: rule.pattern,
      category_id: rule.category_id,
      priority: rule.priority,
    });
    setShowNewRuleForm(true); // Show form when editing
  };

  const handleUpdateRule = async () => {
    if (isCreatingRule || !editingRuleId) return;
    
    try {
      setIsCreatingRule(true);
      
      // Validate required fields
      if (!newRule.pattern || !newRule.pattern.trim()) {
        const { showError } = await import('../../utils/toast');
        showError('Please enter a pattern');
        return;
      }
      
      if (!newRule.category_id) {
        const { showError } = await import('../../utils/toast');
        showError('Please select a category');
        return;
      }

      // Ensure priority is a valid number
      const priority = newRule.priority !== undefined && !isNaN(newRule.priority) 
        ? newRule.priority 
        : 0;

      const ruleToUpdate: Rule = {
        id: editingRuleId,
        rule_type: newRule.rule_type || 'app_name',
        pattern: newRule.pattern.trim(),
        category_id: newRule.category_id,
        priority: priority,
      };

      await updateRule(ruleToUpdate);
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Rule updated successfully');
      
      setNewRule({
        rule_type: 'app_name',
        pattern: '',
        category_id: categoriesData[0]?.id || 1,
        priority: 0,
      });
      setShowNewRuleForm(false);
      setEditingRuleId(null);
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to update rule');
    } finally {
      setIsCreatingRule(false);
    }
  };

  const handleCancelEdit = () => {
    setShowNewRuleForm(false);
    setEditingRuleId(null);
    setNewRule({
      rule_type: 'app_name',
      pattern: '',
      category_id: categoriesData[0]?.id || 1,
      priority: 0,
    });
  };

  const handleDeleteRule = async (id: number) => {
    await deleteRule(id);
    setEditingRuleId(null);
    setShowNewRuleForm(false);
    setNewRule({
      rule_type: 'app_name',
      pattern: '',
      category_id: categoriesData[0]?.id || 1,
      priority: 0,
    });
  };

  const handleReapplyRules = async () => {
    if (confirm('Reapply rules to all existing records? This will update categories for all activities.')) {
      try {
        setIsReapplyingRules(true);
        await api.activities.reapplyCategorizationRules();
        const { showSuccess } = await import('../../utils/toast');
        showSuccess('Rules successfully applied to all records');
        // Refresh activities and stats
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
        queryClient.invalidateQueries({ queryKey: ['timeline'] });
        queryClient.invalidateQueries({ queryKey: ['todayTotal'] });
      } catch (error) {
        const { handleApiError } = await import('../../utils/toast');
        handleApiError(error, 'Failed to reapply rules');
      } finally {
        setIsReapplyingRules(false);
      }
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'app_name': return '📱 Application';
      case 'window_title': return '🪟 Window Title';
      case 'domain': return '🌐 Domain';
      default: return type;
    }
  };

  const renderRulesSettings = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rules</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure automatic categorization rules for your activities
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleReapplyRules}
            disabled={isReapplyingRules}
          >
            {isReapplyingRules ? (
              'Applying...'
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-1" />
                Apply to Existing
              </>
            )}
          </Button>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => {
              setShowNewRuleForm(true);
              setEditingRuleId(null);
            }}
          >
            + New Rule
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm">
        
        {/* New Rule Form */}
        {showNewRuleForm && !editingRuleId && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              New Rule
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Type
                </label>
                <select
                  value={newRule.rule_type}
                  onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value as Rule['rule_type'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="app_name">By Application Name</option>
                  <option value="window_title">By Window Title</option>
                  <option value="domain">By Domain</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={newRule.category_id || categoriesData[0]?.id || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value)) {
                      setNewRule({ ...newRule, category_id: value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {categoriesData.length === 0 ? (
                    <option value="">Loading categories...</option>
                  ) : (
                    categoriesData.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pattern (supports * for any characters)
                </label>
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  placeholder={
                    newRule.rule_type === 'app_name' ? 'Example: *Code*, Slack, Chrome' :
                    newRule.rule_type === 'window_title' ? 'Example: *jira*, *github*' :
                    'Example: youtube.com, *.google.com'
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority (higher = more important)
                </label>
                <input
                  type="number"
                  value={newRule.priority ?? 0}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setNewRule({ ...newRule, priority: isNaN(value) ? 0 : value });
                  }}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button 
                variant="success"
                onClick={handleCreateRule} 
                size="sm"
                disabled={isCreatingRule}
              >
                {isCreatingRule ? (
                  'Creating...'
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Create
                  </>
                )}
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleCancelEdit} 
                size="sm"
                disabled={isCreatingRule}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {rulesLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-600 dark:text-gray-400">
              No rules. Add rules for automatic categorization.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const category = categoriesData.find(c => c.id === rule.category_id);
              return (
                <div key={rule.id}>
                  {editingRuleId === rule.id ? (
                    // Edit Form - Inline
                    <div className="p-3 sm:p-4 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                        Edit Rule
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Rule Type
                          </label>
                          <select
                            value={newRule.rule_type}
                            onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value as Rule['rule_type'] })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="app_name">By Application Name</option>
                            <option value="window_title">By Window Title</option>
                            <option value="domain">By Domain</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Category
                          </label>
                          <select
                            value={newRule.category_id || ''}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              if (!isNaN(value)) {
                                setNewRule({ ...newRule, category_id: value });
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {categoriesData.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Pattern (supports * for any characters)
                          </label>
                          <input
                            type="text"
                            value={newRule.pattern}
                            onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                            placeholder={
                              newRule.rule_type === 'app_name' ? 'Example: *Code*, Slack, Chrome' :
                              newRule.rule_type === 'window_title' ? 'Example: *jira*, *github*' :
                              'Example: youtube.com, *.google.com'
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Priority (higher = more important)
                          </label>
                          <input
                            type="number"
                            value={newRule.priority ?? 0}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              setNewRule({ ...newRule, priority: isNaN(value) ? 0 : value });
                            }}
                            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-4">
                        <div className="flex gap-2">
                          <Button 
                            variant="success"
                            onClick={handleUpdateRule} 
                            size="sm"
                            disabled={isCreatingRule}
                          >
                            {isCreatingRule ? (
                              'Saving...'
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="secondary" 
                            onClick={handleCancelEdit} 
                            size="sm"
                            disabled={isCreatingRule}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                        <Button 
                          variant="danger" 
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete rule?')) {
                              handleDeleteRule(editingRuleId!);
                            }
                          }}
                          disabled={isCreatingRule}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Rule Display
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex-1 w-full sm:w-auto">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {getRuleTypeLabel(rule.rule_type)}
                          </span>
                          <code className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-all">
                            {rule.pattern}
                          </code>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                          → {category?.icon} {category?.name || 'Unknown category'}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start gap-2 sm:gap-4">
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          Priority: {rule.priority}
                        </span>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleEditRule(rule)}
                            title="Edit rule"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
  
  const renderAbout = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm text-center">
        <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">⏱️</div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Time Tracker
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
          Version {import.meta.env.VITE_APP_VERSION || 'Stable Release'}
        </p>
        <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 max-w-md mx-auto px-4">
          Desktop application for automatic time tracking with smart idle time handling.
        </p>
        
        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Technologies
          </h3>
          <div className="flex flex-wrap justify-center gap-2 px-4">
            {['Tauri', 'React', 'TypeScript', 'Rust', 'SQLite', 'Tailwind CSS'].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
        
        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200 dark:border-gray-700 px-4">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            © 2026 Time Tracker. All rights reserved.
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 mt-2">
            Special thanks to Anastasiya Murenka, Aliaksei Berkau, and Andrei Zhytkevich for the ideas.
          </p>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Sidebar */}
      <div className="w-full lg:w-56 bg-white dark:bg-gray-800 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex-shrink-0">
        <nav className="flex lg:flex-col gap-1 sm:gap-2 overflow-x-auto lg:overflow-x-visible">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`
                  flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-left transition-all whitespace-nowrap flex-shrink-0 text-sm sm:text-base
                  ${activeTab === tab.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {activeTab === 'general' && renderGeneralSettings()}
        {activeTab === 'categories' && renderCategoriesSettings()}
        {activeTab === 'rules' && renderRulesSettings()}
        {activeTab === 'projects' && (
          <div className="-m-4 sm:-m-6">
            <Projects />
          </div>
        )}
        {activeTab === 'tasks' && (
          <div className="-m-4 sm:-m-6">
            <Tasks />
          </div>
        )}
        {activeTab === 'goals' && (
          <div className="-m-4 sm:-m-6">
            <Goals />
          </div>
        )}
        {activeTab === 'about' && renderAbout()}
        {/* Plugin settings tabs */}
        {pluginTabs.map((tab: PluginSettingsTab) => {
          if (activeTab === tab.id) {
            const TabComponent = tab.component;
            return (
              <ErrorBoundary key={tab.id}>
                <div className="-m-4 sm:-m-6">
                  <TabComponent />
                </div>
              </ErrorBoundary>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default Settings;
