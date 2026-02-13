import { useState, useEffect } from 'react';
import { Package, Settings as SettingsIcon, Plus, Trash2 } from 'lucide-react';
import { usePluginRegistry } from '../../hooks/usePluginRegistry';
import { usePlugins } from '../../hooks/usePlugins';
import { useSettings } from '../../hooks/useSettings';
import { api } from '../../services/api';
import PluginCard from './PluginCard';
import PluginDetails from './PluginDetails';
import PluginSearch from './PluginSearch';
import InstalledPlugins from './InstalledPlugins';
import LoadingSpinner from '../Common/LoadingSpinner';
import Button from '../Common/Button';
import type { RegistryPlugin } from '../../types/plugin';
import { showSuccess, handleApiError } from '../../utils/toast';

type Tab = 'discover' | 'installed';

export default function Marketplace() {
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [selectedPlugin, setSelectedPlugin] = useState<RegistryPlugin | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [showRegistrySettings, setShowRegistrySettings] = useState(false);
  const [registryUrls, setRegistryUrls] = useState<string[]>([]);
  const [newRegistryUrl, setNewRegistryUrl] = useState('');
  const [isSavingRegistryUrls, setIsSavingRegistryUrls] = useState(false);
  const { plugins: registryPlugins, isLoading: isLoadingRegistry, searchPlugins, refetch } = usePluginRegistry();
  const { plugins: installedPlugins, installPlugin, refetch: refetchInstalledPlugins, enablePlugin, disablePlugin, uninstallPlugin } = usePlugins();
  const { data: settings } = useSettings();

  useEffect(() => {
    if (settings) {
      // Use plugin_registry_urls if available, otherwise fallback to plugin_registry_url or default
      if (settings.plugin_registry_urls && settings.plugin_registry_urls.length > 0) {
        setRegistryUrls([...settings.plugin_registry_urls]);
      } else if (settings.plugin_registry_url) {
        setRegistryUrls([settings.plugin_registry_url]);
      } else {
        setRegistryUrls(['https://raw.githubusercontent.com/tmtrckr/plugins-registry/main/registry.json']);
      }
    }
  }, [settings]);

  const handleSearch = (query: string) => {
    searchPlugins(query);
  };

  const handleInstall = async (plugin: RegistryPlugin) => {
    try {
      setInstallingPluginId(plugin.id);
      const success = await installPlugin(plugin.repository);
      if (success) {
        showSuccess(`Plugin "${plugin.name}" installed successfully`);
        setSelectedPlugin(null);
        await refetchInstalledPlugins();
      }
    } catch (error) {
      handleApiError(error, 'Failed to install plugin');
    } finally {
      setInstallingPluginId(null);
    }
  };

  const isInstalled = (plugin: RegistryPlugin) => {
    // Check by ID first (for plugins from registry)
    if (installedPlugins.some((p) => p.id === plugin.id)) {
      return true;
    }
    // Also check by repository URL (in case IDs don't match)
    if (plugin.repository && installedPlugins.some((p) => p.repository_url === plugin.repository)) {
      return true;
    }
    return false;
  };

  const handleAddRegistryUrl = () => {
    if (newRegistryUrl.trim() && !registryUrls.includes(newRegistryUrl.trim())) {
      setRegistryUrls([...registryUrls, newRegistryUrl.trim()]);
      setNewRegistryUrl('');
    }
  };

  const handleRemoveRegistryUrl = (index: number) => {
    setRegistryUrls(registryUrls.filter((_, i) => i !== index));
  };

  const handleSaveRegistryUrls = async () => {
    try {
      setIsSavingRegistryUrls(true);
      const currentSettings = await api.settings.getSettings();
      await api.settings.updateSettings({
        ...currentSettings,
        plugin_registry_urls: registryUrls.length > 0 ? registryUrls : undefined,
        // Clear legacy single URL if using multiple URLs
        plugin_registry_url: registryUrls.length === 1 ? registryUrls[0] : undefined,
      });
      showSuccess('Registry URLs updated successfully');
      setShowRegistrySettings(false);
      // Reload registry with new URLs
      await refetch();
    } catch (error) {
      handleApiError(error, 'Failed to update registry URLs');
    } finally {
      setIsSavingRegistryUrls(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketplace</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Discover and install plugins for TimeTracker
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRegistrySettings(true)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Registry Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('discover')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'discover'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Discover
            </button>
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'installed'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Installed ({installedPlugins.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'discover' && (
          <div className="space-y-6">
            {/* Search */}
            <PluginSearch onSearch={handleSearch} />

            {/* Plugins Grid */}
            {isLoadingRegistry ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : registryPlugins.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No plugins found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {registryPlugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    isInstalled={isInstalled(plugin)}
                    isInstalling={installingPluginId === plugin.id}
                    onInstall={handleInstall}
                    onViewDetails={setSelectedPlugin}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'installed' && (
          <InstalledPlugins 
            plugins={installedPlugins}
            isLoading={false}
            enablePlugin={enablePlugin}
            disablePlugin={disablePlugin}
            uninstallPlugin={async (pluginId: string) => {
              const success = await uninstallPlugin(pluginId);
              if (success) {
                await refetchInstalledPlugins();
              }
              return success;
            }}
          />
        )}
      </div>

      {/* Plugin Details Modal */}
      {selectedPlugin && (
        <PluginDetails
          plugin={selectedPlugin}
          isInstalled={isInstalled(selectedPlugin)}
          isInstalling={installingPluginId === selectedPlugin.id}
          onClose={() => setSelectedPlugin(null)}
          onInstall={handleInstall}
        />
      )}

      {/* Registry Settings Modal */}
      {showRegistrySettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Registry Settings</h2>
                <button
                  onClick={() => setShowRegistrySettings(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plugin Registry URLs
                </label>
                <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                  Add multiple registry URLs to load plugins from different sources. Plugins from all registries will be merged.
                </p>
                
                {/* List of registry URLs */}
                <div className="space-y-2 mb-4">
                  {registryUrls.map((url, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...registryUrls];
                          newUrls[index] = e.target.value;
                          setRegistryUrls(newUrls);
                        }}
                        placeholder="https://raw.githubusercontent.com/user/repo/main/registry.json"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                      <button
                        onClick={() => handleRemoveRegistryUrl(index)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        aria-label="Remove registry"
                        title="Remove registry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Add new registry URL */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newRegistryUrl}
                    onChange={(e) => setNewRegistryUrl(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddRegistryUrl();
                      }
                    }}
                    placeholder="https://raw.githubusercontent.com/user/repo/main/registry.json"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button
                    onClick={handleAddRegistryUrl}
                    disabled={!newRegistryUrl.trim() || registryUrls.includes(newRegistryUrl.trim())}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    aria-label="Add registry"
                    title="Add registry"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {registryUrls.length === 0 && (
                  <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                    No registries configured. Default registry will be used.
                  </p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowRegistrySettings(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveRegistryUrls}
                disabled={isSavingRegistryUrls}
              >
                {isSavingRegistryUrls ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
