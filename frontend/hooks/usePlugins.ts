import { useState, useEffect } from 'react';
import type { InstalledPlugin } from '../types/plugin';
import { handleApiError } from '../utils/toast';
import { isTauriAvailable } from '../utils/tauri';

const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (!isTauriAvailable()) {
    throw new Error('This feature requires the desktop application. Please use the Tauri desktop app.');
  }
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/tauri');
  return tauriInvoke<T>(cmd, args);
};

export function usePlugins() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!isTauriAvailable()) {
        setError('Plugins require the desktop application.');
        return;
      }
      const result = await invoke<InstalledPlugin[]>('list_installed_plugins');
      setPlugins(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      handleApiError(err, 'Failed to load plugins');
      setError(errorMessage || 'Failed to load plugins');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const installPlugin = async (repositoryUrl: string, version?: string) => {
    try {
      await invoke('install_plugin', { repositoryUrl, version });
      await fetchPlugins();
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to install plugin');
      return false;
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    try {
      await invoke('uninstall_plugin', { pluginId });
      await fetchPlugins();
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to uninstall plugin');
      return false;
    }
  };

  const enablePlugin = async (pluginId: string) => {
    try {
      await invoke('enable_plugin', { pluginId });
      await fetchPlugins();
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to enable plugin');
      return false;
    }
  };

  const disablePlugin = async (pluginId: string) => {
    try {
      await invoke('disable_plugin', { pluginId });
      await fetchPlugins();
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to disable plugin');
      return false;
    }
  };

  const loadPlugin = async (pluginId: string) => {
    try {
      await invoke('load_plugin', { pluginId });
      return true;
    } catch (err) {
      handleApiError(err, 'Failed to load plugin');
      return false;
    }
  };

  return {
    plugins,
    isLoading,
    error,
    refetch: fetchPlugins,
    installPlugin,
    uninstallPlugin,
    enablePlugin,
    disablePlugin,
    loadPlugin,
  };
}
