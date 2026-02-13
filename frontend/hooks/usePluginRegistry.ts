import { useState, useEffect } from 'react';
import type { RegistryPlugin, PluginManifest } from '../types/plugin';
import { handleApiError } from '../utils/toast';
import { isTauriAvailable } from '../utils/tauri';

const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (!isTauriAvailable()) {
    throw new Error('This feature requires the desktop application. Please use the Tauri desktop app.');
  }
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/tauri');
  return tauriInvoke<T>(cmd, args);
};

export function usePluginRegistry() {
  const [plugins, setPlugins] = useState<RegistryPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistry = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!isTauriAvailable()) {
        setError('Plugin registry requires the desktop application.');
        return;
      }
      const result = await invoke<RegistryPlugin[]>('get_plugin_registry');
      setPlugins(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      handleApiError(err, 'Failed to load plugin registry');
      setError(errorMessage || 'Failed to load plugin registry');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistry();
  }, []);

  const searchPlugins = async (query: string) => {
    try {
      setIsLoading(true);
      setError(null);
      if (query.trim()) {
        const result = await invoke<RegistryPlugin[]>('search_plugins', { query });
        setPlugins(result);
      } else {
        // Reset to full registry
        await fetchRegistry();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      handleApiError(err, 'Failed to search plugins');
      setError(errorMessage || 'Failed to search plugins');
    } finally {
      setIsLoading(false);
    }
  };

  const getPluginInfo = async (repositoryUrl: string): Promise<PluginManifest | null> => {
    try {
      const result = await invoke<PluginManifest>('get_plugin_info', { repositoryUrl });
      return result;
    } catch (err) {
      handleApiError(err, 'Failed to get plugin info');
      return null;
    }
  };

  const discoverPlugin = async (repositoryUrl: string): Promise<RegistryPlugin | null> => {
    try {
      const result = await invoke<RegistryPlugin>('discover_plugin', { repositoryUrl });
      return result;
    } catch (err) {
      handleApiError(err, 'Failed to discover plugin');
      return null;
    }
  };

  return {
    plugins,
    isLoading,
    error,
    refetch: fetchRegistry,
    searchPlugins,
    getPluginInfo,
    discoverPlugin,
  };
}
