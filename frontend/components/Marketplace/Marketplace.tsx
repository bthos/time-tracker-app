import { useState } from 'react';
import { Package, Download, Settings } from 'lucide-react';
import { usePluginRegistry } from '../../hooks/usePluginRegistry';
import { usePlugins } from '../../hooks/usePlugins';
import PluginCard from './PluginCard';
import PluginDetails from './PluginDetails';
import PluginSearch from './PluginSearch';
import InstalledPlugins from './InstalledPlugins';
import LoadingSpinner from '../Common/LoadingSpinner';
import type { RegistryPlugin } from '../../types/plugin';
import { showSuccess, handleApiError } from '../../utils/toast';

type Tab = 'discover' | 'installed';

export default function Marketplace() {
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [selectedPlugin, setSelectedPlugin] = useState<RegistryPlugin | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const { plugins: registryPlugins, isLoading: isLoadingRegistry, searchPlugins } = usePluginRegistry();
  const { plugins: installedPlugins, installPlugin, refetch: refetchInstalledPlugins, enablePlugin, disablePlugin, uninstallPlugin } = usePlugins();

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
    </div>
  );
}
