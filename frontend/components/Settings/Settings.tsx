import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Settings as SettingsType } from '../../types';
import { usePluginFrontend } from '../../hooks/usePluginFrontend';
import { Settings as SettingsIcon, Tag, FileText, Info } from 'lucide-react';
import { ErrorBoundary } from '../Common/ErrorBoundary';
import type { PluginSettingsTab } from '../../types/pluginFrontend';
import { GeneralSettings } from './GeneralSettings';
import { CategoriesSettings } from './CategoriesSettings';
import { RulesSettings } from './RulesSettings';
import { AboutSettings } from './AboutSettings';
import { useSettingsSave } from './useSettingsSave';

interface SettingsProps {
  onClose?: () => void;
}

type SettingsTab = 'general' | 'categories' | 'rules' | 'about' | string;

const Settings: React.FC<SettingsProps> = () => {
  const { settings, pendingRuleData, settingsActiveTab, scrollToIdlePromptThreshold, setSettingsActiveTab, setScrollToIdlePromptThreshold } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { settingsTabs: pluginTabs } = usePluginFrontend();
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const { isSaving, isEditingRef, saveSettings } = useSettingsSave();

  // Sync localSettings with store settings when they change
  useEffect(() => {
    if (!isEditingRef.current) {
      setLocalSettings({
        ...settings,
        idleThreshold: settings.idleThreshold ?? settings.idle_threshold_seconds ?? (settings.idle_threshold_minutes ?? 2) * 60,
        idlePromptThreshold: settings.idlePromptThreshold ?? settings.idle_prompt_threshold_seconds ?? (settings.idle_prompt_threshold_minutes ?? 5) * 60,
      });
    }
  }, [settings, isEditingRef]);

  // Sync activeTab with store on mount
  useEffect(() => {
    if (settingsActiveTab) {
      setActiveTab(settingsActiveTab);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync activeTab changes to store
  useEffect(() => {
    if (activeTab === 'general' || activeTab === 'categories' || activeTab === 'rules' || activeTab === 'about') {
      setSettingsActiveTab(activeTab);
    } else {
      setSettingsActiveTab(null);
    }
  }, [activeTab, setSettingsActiveTab]);

  // Handle scroll to idle prompt threshold
  useEffect(() => {
    if (scrollToIdlePromptThreshold && activeTab === 'general') {
      const timer = setTimeout(() => {
        const element = document.getElementById('idle-prompt-threshold');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const input = element.querySelector('input');
          if (input) {
            input.focus();
            input.style.transition = 'box-shadow 0.3s ease';
            input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';
            setTimeout(() => {
              input.style.boxShadow = '';
            }, 2000);
          }
          setScrollToIdlePromptThreshold(false);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scrollToIdlePromptThreshold, activeTab, setScrollToIdlePromptThreshold]);

  // Handle pendingRuleData - switch to rules tab
  useEffect(() => {
    if (pendingRuleData && activeTab !== 'rules') {
      setActiveTab('rules');
    }
  }, [pendingRuleData, activeTab]);
  
  const handleSettingChange = <K extends keyof SettingsType>(
    key: K,
    value: SettingsType[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSave = async () => {
    const { showInfo } = await import('../../utils/toast');
    
    const idleThresholdInput = localSettings.idleThreshold;
    const idlePromptThresholdInput = localSettings.idlePromptThreshold;
    
    let idleThresholdSec: number;
    if (typeof idleThresholdInput === 'number' && !isNaN(idleThresholdInput) && isFinite(idleThresholdInput)) {
      idleThresholdSec = idleThresholdInput;
      if (idleThresholdSec < 30) {
        showInfo('Idle threshold cannot be less than 30 seconds. Set to 30 seconds.');
        idleThresholdSec = 30;
      }
    } else {
      idleThresholdSec = (localSettings.idle_threshold_minutes ?? 2) * 60;
    }
    
    let idlePromptThresholdSec: number;
    if (typeof idlePromptThresholdInput === 'number' && !isNaN(idlePromptThresholdInput) && isFinite(idlePromptThresholdInput)) {
      idlePromptThresholdSec = idlePromptThresholdInput;
      if (idlePromptThresholdSec < 60) {
        showInfo('Idle prompt threshold cannot be less than 60 seconds. Set to 60 seconds.');
        idlePromptThresholdSec = 60;
      }
    } else {
      idlePromptThresholdSec = (localSettings.idle_prompt_threshold_minutes ?? 5) * 60;
    }
    
    const updatedSettings = {
      ...localSettings,
      idleThreshold: idleThresholdSec,
      idlePromptThreshold: idlePromptThresholdSec,
    };
    
    const frontendSettings = await saveSettings(updatedSettings);
    setLocalSettings({
      ...frontendSettings,
      idleThreshold: frontendSettings.idleThreshold,
      idlePromptThreshold: frontendSettings.idlePromptThreshold,
    });
  };

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'rules', label: 'Rules', icon: FileText },
    { id: 'about', label: 'About', icon: Info },
  ];
  
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
          {pluginTabs.map((tab: PluginSettingsTab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-left transition-all whitespace-nowrap flex-shrink-0 text-sm sm:text-base
                  ${activeTab === tab.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {activeTab === 'general' && (
          <GeneralSettings
            localSettings={localSettings}
            onSettingChange={handleSettingChange}
            isEditingRef={isEditingRef}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
        {activeTab === 'categories' && <CategoriesSettings />}
        {activeTab === 'rules' && <RulesSettings />}
        {activeTab === 'about' && <AboutSettings />}
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
