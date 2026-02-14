import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../store';
import { Settings as SettingsType } from '../../types';
import { settingsApi } from '../../services/api/settings';

export function useSettingsSave() {
  const [isSaving, setIsSaving] = useState(false);
  const isEditingRef = useRef(false);
  const { setSettings } = useStore();
  const queryClient = useQueryClient();

  const saveSettings = async (localSettings: SettingsType) => {
    setIsSaving(true);
    try {
      isEditingRef.current = true;
      
      const idleThresholdSec = localSettings.idleThreshold ?? (localSettings.idle_threshold_minutes ?? 2) * 60;
      const idlePromptThresholdSec = localSettings.idlePromptThreshold ?? (localSettings.idle_prompt_threshold_minutes ?? 5) * 60;
      
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
        plugin_registry_urls: localSettings.plugin_registry_urls,
      };
      
      await settingsApi.updateSettings(backendSettings);
      isEditingRef.current = false;
      
      const updated = await settingsApi.getSettings();
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
        theme: localSettings.theme ?? currentSettings.theme ?? 'system',
        darkMode: localSettings.darkMode ?? currentSettings.darkMode ?? false,
        plugin_registry_urls: updated.plugin_registry_urls,
      };
      
      setSettings(frontendSettings);
      
      const htmlElement = document.documentElement;
      if (frontendSettings.darkMode) {
        htmlElement.classList.add('dark');
      } else {
        htmlElement.classList.remove('dark');
      }
      
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Settings saved successfully');
      
      return frontendSettings;
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to save settings');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    isEditingRef,
    saveSettings,
  };
}
