import { Package, Trash2, Power, PowerOff } from 'lucide-react';
import type { InstalledPlugin } from '../../types/plugin';
import LoadingSpinner from '../Common/LoadingSpinner';
import { showSuccess } from '../../utils/toast';

interface InstalledPluginsProps {
  plugins: InstalledPlugin[];
  isLoading: boolean;
  enablePlugin: (pluginId: string) => Promise<boolean>;
  disablePlugin: (pluginId: string) => Promise<boolean>;
  uninstallPlugin: (pluginId: string) => Promise<boolean>;
  onUninstall?: () => void;
}

export default function InstalledPlugins({ plugins, isLoading, enablePlugin, disablePlugin, uninstallPlugin, onUninstall }: InstalledPluginsProps) {

  const handleToggle = async (plugin: InstalledPlugin) => {
    if (plugin.enabled) {
      const success = await disablePlugin(plugin.id);
      if (success) {
        showSuccess(`Plugin "${plugin.name}" disabled`);
      }
    } else {
      const success = await enablePlugin(plugin.id);
      if (success) {
        showSuccess(`Plugin "${plugin.name}" enabled`);
      }
    }
  };

  const handleUninstall = async (plugin: InstalledPlugin) => {
    if (window.confirm(`Are you sure you want to uninstall "${plugin.name}"?`)) {
      const success = await uninstallPlugin(plugin.id);
      if (success) {
        showSuccess(`Plugin "${plugin.name}" uninstalled`);
        // Notify parent component to refetch installed plugins list
        onUninstall?.();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (plugins.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No plugins installed</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {plugins.map((plugin) => (
        <div
          key={plugin.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {plugin.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      plugin.enabled
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {plugin.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {plugin.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    {plugin.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>v{plugin.version}</span>
                  {plugin.repository_url && (
                    <a
                      href={plugin.repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      View Repository
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => handleToggle(plugin)}
                className={`p-2 rounded-lg transition-colors ${
                  plugin.enabled
                    ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
              >
                {plugin.enabled ? (
                  <Power className="w-5 h-5" />
                ) : (
                  <PowerOff className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => handleUninstall(plugin)}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Uninstall plugin"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
