// Plugin Frontend Loader
// Loads and initializes plugin frontend bundles

import type { PluginFrontendModule, PluginFrontendAPI } from '../types/pluginFrontend';

const loadedPlugins = new Map<string, PluginFrontendModule>();

export interface PluginManifest {
  id: string;
  frontend?: {
    entry?: string;
    components?: string[];
  };
}

/**
 * Load a plugin's frontend bundle
 */
export async function loadPluginFrontend(
  pluginId: string,
  manifest: PluginManifest,
  api: PluginFrontendAPI
): Promise<void> {
  if (loadedPlugins.has(pluginId)) {
    console.warn(`Plugin ${pluginId} frontend already loaded`);
    return;
  }

  if (!manifest.frontend?.entry) {
    console.log(`Plugin ${pluginId} has no frontend entry point`);
    return;
  }

  try {
    // Normalize entry path - remove leading 'frontend/' if present since we add it below
    let entryPath = manifest.frontend.entry || '';
    if (entryPath.startsWith('frontend/')) {
      entryPath = entryPath.substring('frontend/'.length);
    }
    
    // In production, load from plugins/{id}/frontend/bundle.js
    // For now, we'll use dynamic imports from a known location
    // TODO: Update this to load from actual plugin bundle location
    const modulePath = `/plugins/${pluginId}/frontend/${entryPath}`;
    
    // Dynamic import of the plugin module
    const module = await import(/* @vite-ignore */ modulePath);
    
    if (!module.default || typeof module.default.initialize !== 'function') {
      throw new Error(`Plugin ${pluginId} frontend module does not export a valid initialize function`);
    }

    const pluginModule: PluginFrontendModule = module.default;
    
    // Initialize the plugin with the API
    pluginModule.initialize(api);
    
    // Store the loaded plugin
    loadedPlugins.set(pluginId, pluginModule);
    
    console.log(`Loaded plugin frontend: ${pluginId}`);
  } catch (error) {
    console.error(`Failed to load plugin frontend ${pluginId}:`, error);
    // Don't throw - allow app to continue without this plugin's UI
  }
}

/**
 * Unload a plugin's frontend bundle
 */
export function unloadPluginFrontend(pluginId: string): void {
  const pluginModule = loadedPlugins.get(pluginId);
  if (pluginModule?.cleanup) {
    pluginModule.cleanup();
  }
  loadedPlugins.delete(pluginId);
}

/**
 * Get all loaded plugin IDs
 */
export function getLoadedPlugins(): string[] {
  return Array.from(loadedPlugins.keys());
}
