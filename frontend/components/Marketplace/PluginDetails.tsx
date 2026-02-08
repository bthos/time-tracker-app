import { X, Download, CheckCircle2, ExternalLink, Code, User, Calendar } from 'lucide-react';
import type { RegistryPlugin } from '../../types/plugin';
import Button from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';

interface PluginDetailsProps {
  plugin: RegistryPlugin;
  isInstalled?: boolean;
  isInstalling?: boolean;
  onClose: () => void;
  onInstall?: (plugin: RegistryPlugin) => void;
}

export default function PluginDetails({ plugin, isInstalled, isInstalling, onClose, onInstall }: PluginDetailsProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {plugin.name}
            {plugin.verified && (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-gray-600 dark:text-gray-300">{plugin.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <User className="w-4 h-4" />
                Author
              </div>
              <p className="text-gray-900 dark:text-white font-medium">{plugin.author}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Code className="w-4 h-4" />
                Version
              </div>
              <p className="text-gray-900 dark:text-white font-medium">v{plugin.latest_version}</p>
            </div>
            {plugin.license && (
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                  License
                </div>
                <p className="text-gray-900 dark:text-white font-medium">{plugin.license}</p>
              </div>
            )}
            {plugin.category && (
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Category
                </div>
                <p className="text-gray-900 dark:text-white font-medium">{plugin.category}</p>
              </div>
            )}
          </div>

          {plugin.tags && plugin.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {plugin.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(plugin.min_core_version || plugin.max_core_version) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Compatibility</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {plugin.min_core_version && (
                  <p>Minimum version: {plugin.min_core_version}</p>
                )}
                {plugin.max_core_version && (
                  <p>Maximum version: {plugin.max_core_version}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={plugin.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" />
                View Repository
              </Button>
            </a>
            {onInstall && !isInstalled && (
              <Button
                onClick={() => onInstall(plugin)}
                disabled={isInstalling}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {isInstalling ? (
                  <>
                    <LoadingSpinner size="sm" className="text-white" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Install Plugin
                  </>
                )}
              </Button>
            )}
            {isInstalled && (
              <div className="flex-1 flex items-center justify-center px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg">
                Installed
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
