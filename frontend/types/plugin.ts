// Plugin types for frontend

export interface PluginDependency {
  plugin_id: string;
  version?: string;  // Optional version constraint (e.g., ">=1.0.0", "1.2.3")
}

export interface ExposedTable {
  table_name: string;
  allowed_plugins: string[];  // Empty = no access, ["*"] = all plugins, ["plugin1", "plugin2"] = specific plugins only
  description?: string;
}

export interface PluginManifest {
  plugin: {
    name: string;
    display_name?: string;
    version: string;
    author: string;
    description: string;
    repository: string;
    license?: string;
    api_version?: string;
    min_core_version?: string;
    max_core_version?: string;
    dependencies?: PluginDependency[];
    exposed_tables?: ExposedTable[];
  };
  backend?: {
    library_name: string;
  };
  frontend?: {
    entry?: string;
    components?: string[];
  };
}

export interface RegistryPlugin {
  id: string;
  name: string;
  author: string;
  repository: string;
  latest_version: string;
  description: string;
  category?: string;
  verified: boolean;
  downloads: number;
  tags?: string[];
  license?: string;
  min_core_version?: string;
  max_core_version?: string;
  api_version?: string;
}

export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  repository_url?: string;
  manifest_path?: string;
  enabled: boolean;
  frontend_entry?: string;
  frontend_components?: string[];
  author?: string;
}

export interface PluginRegistry {
  version?: string;
  last_updated?: string;
  plugins: RegistryPlugin[];
}
