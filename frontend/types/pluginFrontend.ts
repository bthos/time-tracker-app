// Plugin Frontend API Types

import type { ComponentType } from 'react';

export interface PluginRoute {
  path: string;
  component: ComponentType<any>;
  exact?: boolean;
}

export interface PluginSidebarItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  route: string;
  order?: number;
}

export interface PluginDashboardWidget {
  id: string;
  component: ComponentType<any>;
  order?: number;
  gridColSpan?: number; // 1-4 for grid layout
}

export interface PluginSettingsTab {
  id: string;
  label: string;
  component: ComponentType<any>;
  order?: number;
}

export interface PluginFrontendAPI {
  registerRoute: (route: PluginRoute) => void;
  registerSidebarItem: (item: PluginSidebarItem) => void;
  registerDashboardWidget: (widget: PluginDashboardWidget) => void;
  registerSettingsTab: (tab: PluginSettingsTab) => void;
}

export interface PluginFrontendModule {
  initialize: (api: PluginFrontendAPI) => void;
  cleanup?: () => void;
}
