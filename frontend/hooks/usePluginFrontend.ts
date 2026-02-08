// Hook for loading and managing plugin frontends

import { useEffect, useCallback } from 'react';
import { usePlugins } from './usePlugins';
import { loadPluginFrontend, unloadPluginFrontend } from '../utils/pluginLoader';
import { usePluginRegistry } from '../store/pluginRegistry';
import type { PluginFrontendAPI } from '../types/pluginFrontend';
import type { InstalledPlugin } from '../types/plugin';

export function usePluginFrontend() {
  const { plugins, isLoading } = usePlugins();
  const registry = usePluginRegistry();
  
  // Create PluginFrontendAPI instance
  const createPluginAPI = useCallback((pluginId: string): PluginFrontendAPI => {
    return {
      registerRoute: (route) => {
        registry.registerRoute(pluginId, route);
      },
      registerSidebarItem: (item) => {
        registry.registerSidebarItem(pluginId, item);
      },
      registerDashboardWidget: (widget) => {
        registry.registerDashboardWidget(pluginId, widget);
      },
      registerSettingsTab: (tab) => {
        registry.registerSettingsTab(pluginId, tab);
      },
    };
  }, [registry]);
  
  // Load plugin frontends when plugins list changes
  useEffect(() => {
    if (isLoading) return;
    
    // Filter to only enabled plugins
    const enabledPlugins = plugins.filter((p: InstalledPlugin) => p.enabled);
    
    // Load each enabled plugin's frontend
    enabledPlugins.forEach(async (plugin: InstalledPlugin) => {
      try {
        // Get plugin manifest (this would come from backend in real implementation)
        // For now, we'll construct it from plugin data
        // #region agent log
        fetch('http://127.0.0.1:7250/ingest/88d94c84-1935-401d-8623-faad62dde354',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePluginFrontend.ts:44',message:'Preparing plugin manifest',data:{pluginId:plugin.id,frontendEntry:plugin.frontend_entry,hasFrontendEntry:!!plugin.frontend_entry},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        const manifest = {
          id: plugin.id,
          frontend: {
            entry: plugin.frontend_entry || `${plugin.id}/index.js`,
            components: plugin.frontend_components || [],
          },
        };
        
        const api = createPluginAPI(plugin.id);
        await loadPluginFrontend(plugin.id, manifest, api);
      } catch (error) {
        console.error(`Failed to load frontend for plugin ${plugin.id}:`, error);
      }
    });
    
    // Cleanup: unload plugins that are no longer enabled
    const enabledIds = new Set(enabledPlugins.map((p: InstalledPlugin) => p.id));
    registry.routes.forEach((_, key) => {
      const pluginId = key.split(':')[0];
      if (!enabledIds.has(pluginId)) {
        unloadPluginFrontend(pluginId);
        registry.unregisterPlugin(pluginId);
      }
    });
  }, [plugins, isLoading, createPluginAPI, registry]);
  
  return {
    isLoading,
    routes: registry.getRoutes(),
    sidebarItems: registry.getSidebarItems(),
    dashboardWidgets: registry.getDashboardWidgets(),
    settingsTabs: registry.getSettingsTabs(),
  };
}
