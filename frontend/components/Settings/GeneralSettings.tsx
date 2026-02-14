import React from 'react';
import { Settings as SettingsType } from '../../types';
import Toggle from '../Common/Toggle';
import Button from '../Common/Button';

interface GeneralSettingsProps {
  localSettings: SettingsType;
  onSettingChange: <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => void;
  isEditingRef: React.MutableRefObject<boolean>;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  localSettings,
  onSettingChange,
  isEditingRef,
  onSave,
  isSaving,
}) => {
  return (
    <div className="space-y-6">
      {/* Application Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Application Settings
        </h3>
        
        <div className="space-y-4">
          <Toggle
            checked={localSettings.autoStart ?? false}
            onChange={(checked) => onSettingChange('autoStart', checked)}
            label="Autostart with System"
            description="Launch application on system login"
          />
          
          <Toggle
            checked={('minimizeToTray' in localSettings ? (localSettings as SettingsType & { minimizeToTray?: boolean }).minimizeToTray : undefined) ?? localSettings.minimize_to_tray}
            onChange={(checked) => {
              onSettingChange('minimizeToTray' as keyof SettingsType, checked as SettingsType[keyof SettingsType]);
            }}
            label="Minimize to Tray"
            description="Minimize to system tray when closing window"
          />
          
          <Toggle
            checked={('showNotifications' in localSettings ? (localSettings as SettingsType & { showNotifications?: boolean }).showNotifications : undefined) ?? localSettings.show_notifications}
            onChange={(checked) => {
              onSettingChange('showNotifications' as keyof SettingsType, checked as SettingsType[keyof SettingsType]);
            }}
            label="Show Notifications"
            description="Tracking status notifications"
          />
          
          <Toggle
            checked={localSettings.darkMode ?? false}
            onChange={(checked) => {
              onSettingChange('darkMode', checked);
              const htmlElement = document.documentElement;
              if (checked) {
                htmlElement.classList.add('dark');
              } else {
                htmlElement.classList.remove('dark');
              }
            }}
            label="Dark Theme"
            description="Use dark appearance"
          />
          
          <Toggle
            checked={localSettings.enable_marketplace ?? false}
            onChange={(checked) => onSettingChange('enable_marketplace', checked)}
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
              onChange={(e) => onSettingChange('pollingInterval', Number(e.target.value))}
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
                onSettingChange('idleThreshold', value);
              }}
              min={0}
              step={1}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Time before activity is marked as idle
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
                isEditingRef.current = true;
                const value = e.target.value === '' ? undefined : Number(e.target.value);
                onSettingChange('idlePromptThreshold', value);
              }}
              min={0}
              step={1}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Time before showing idle prompt dialog
            </p>
          </div>
        </div>
      </div>
      
      {/* Display Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Display Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Format
            </label>
            <select
              value={localSettings.date_format || 'YYYY-MM-DD'}
              onChange={(e) => onSettingChange('date_format', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="DD.MM.YYYY">DD.MM.YYYY</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Format
            </label>
            <select
              value={localSettings.time_format || '24h'}
              onChange={(e) => onSettingChange('time_format', e.target.value as '12h' | '24h')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="24h">24-hour</option>
              <option value="12h">12-hour</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Plugin Registry URLs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Plugin Registries
        </h3>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Registry URLs (one per line)
          </label>
          <textarea
            value={localSettings.plugin_registry_urls?.join('\n') || ''}
            onChange={(e) => {
              const urls = e.target.value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
              onSettingChange('plugin_registry_urls', urls.length > 0 ? urls : undefined);
            }}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
            placeholder="https://raw.githubusercontent.com/tmtrckr/plugins-registry/main/registry.json"
          />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            URLs to plugin registries (one per line). Leave empty to use default registry.
          </p>
        </div>
      </div>
      
      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};
