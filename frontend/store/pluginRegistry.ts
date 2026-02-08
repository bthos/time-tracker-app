// Plugin Frontend Registry Store
// Manages plugin frontend registrations (routes, sidebar items, widgets, settings tabs)

import { create } from 'zustand';
import type { PluginRoute, PluginSidebarItem, PluginDashboardWidget, PluginSettingsTab } from '../types/pluginFrontend';

interface PluginRegistryState {
  routes: Map<string, PluginRoute>;
  sidebarItems: Map<string, PluginSidebarItem>;
  dashboardWidgets: Map<string, PluginDashboardWidget>;
  settingsTabs: Map<string, PluginSettingsTab>;
  
  // Actions
  registerRoute: (pluginId: string, route: PluginRoute) => void;
  registerSidebarItem: (pluginId: string, item: PluginSidebarItem) => void;
  registerDashboardWidget: (pluginId: string, widget: PluginDashboardWidget) => void;
  registerSettingsTab: (pluginId: string, tab: PluginSettingsTab) => void;
  
  unregisterPlugin: (pluginId: string) => void;
  
  // Getters
  getRoutes: () => PluginRoute[];
  getSidebarItems: () => PluginSidebarItem[];
  getDashboardWidgets: () => PluginDashboardWidget[];
  getSettingsTabs: () => PluginSettingsTab[];
}

export const usePluginRegistry = create<PluginRegistryState>((set, get) => ({
  routes: new Map(),
  sidebarItems: new Map(),
  dashboardWidgets: new Map(),
  settingsTabs: new Map(),
  
  registerRoute: (pluginId: string, route: PluginRoute) => {
    set((state) => {
      const newRoutes = new Map(state.routes);
      newRoutes.set(`${pluginId}:${route.path}`, route);
      return { routes: newRoutes };
    });
  },
  
  registerSidebarItem: (pluginId: string, item: PluginSidebarItem) => {
    set((state) => {
      const newItems = new Map(state.sidebarItems);
      newItems.set(`${pluginId}:${item.id}`, item);
      return { sidebarItems: newItems };
    });
  },
  
  registerDashboardWidget: (pluginId: string, widget: PluginDashboardWidget) => {
    set((state) => {
      const newWidgets = new Map(state.dashboardWidgets);
      newWidgets.set(`${pluginId}:${widget.id}`, widget);
      return { dashboardWidgets: newWidgets };
    });
  },
  
  registerSettingsTab: (pluginId: string, tab: PluginSettingsTab) => {
    set((state) => {
      const newTabs = new Map(state.settingsTabs);
      newTabs.set(`${pluginId}:${tab.id}`, tab);
      return { settingsTabs: newTabs };
    });
  },
  
  unregisterPlugin: (pluginId: string) => {
    set((state) => {
      const newRoutes = new Map(state.routes);
      const newSidebarItems = new Map(state.sidebarItems);
      const newDashboardWidgets = new Map(state.dashboardWidgets);
      const newSettingsTabs = new Map(state.settingsTabs);
      
      // Remove all registrations for this plugin
      for (const key of newRoutes.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
          newRoutes.delete(key);
        }
      }
      for (const key of newSidebarItems.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
          newSidebarItems.delete(key);
        }
      }
      for (const key of newDashboardWidgets.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
          newDashboardWidgets.delete(key);
        }
      }
      for (const key of newSettingsTabs.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
          newSettingsTabs.delete(key);
        }
      }
      
      return {
        routes: newRoutes,
        sidebarItems: newSidebarItems,
        dashboardWidgets: newDashboardWidgets,
        settingsTabs: newSettingsTabs,
      };
    });
  },
  
  getRoutes: () => {
    return Array.from(get().routes.values());
  },
  
  getSidebarItems: () => {
    return Array.from(get().sidebarItems.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  },
  
  getDashboardWidgets: () => {
    return Array.from(get().dashboardWidgets.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  },
  
  getSettingsTabs: () => {
    return Array.from(get().settingsTabs.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  },
}));
