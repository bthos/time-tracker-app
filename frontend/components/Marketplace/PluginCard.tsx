import { Package, Download, CheckCircle2, XCircle, Star } from 'lucide-react';
import type { RegistryPlugin } from '../../types/plugin';
import Button from '../Common/Button';
import LoadingSpinner from '../Common/LoadingSpinner';

interface PluginCardProps {
  plugin: RegistryPlugin;
  isInstalled?: boolean;
  isInstalling?: boolean;
  onInstall?: (plugin: RegistryPlugin) => void;
  onViewDetails?: (plugin: RegistryPlugin) => void;
}

export default function PluginCard({ plugin, isInstalled, isInstalling = false, onInstall, onViewDetails }: PluginCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {plugin.name}
              {plugin.verified && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">by {plugin.author}</p>
          </div>
        </div>
        {isInstalled && (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
            Installed
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
        {plugin.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {plugin.tags?.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
        <div className="flex items-center gap-4">
          <span>v{plugin.latest_version}</span>
          {plugin.downloads > 0 && (
            <span className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              {plugin.downloads}
            </span>
          )}
        </div>
        {plugin.category && (
          <span className="px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded text-xs">
            {plugin.category}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {onViewDetails && (
          <Button
            variant="secondary"
            onClick={() => onViewDetails(plugin)}
            className="flex-1"
          >
            View Details
          </Button>
        )}
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
              'Install'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
