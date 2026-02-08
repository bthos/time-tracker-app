// Plugin types for frontend

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
  };
  backend?: {
    crate_name: string;
    library_name: string;
    entry_point: string;
  };
  frontend?: {
    entry?: string;
    components?: string[];
  };
  build?: {
    targets: string[];
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
  is_builtin: boolean;
  enabled: boolean;
  frontend_entry?: string;
  frontend_components?: string[];
}

export interface PluginRegistry {
  version?: string;
  last_updated?: string;
  plugins: RegistryPlugin[];
}
