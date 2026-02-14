// Re-export all API modules
export * from './activities';
export * from './categories';
export * from './rules';
export * from './manualEntries';
export * from './settings';
export * from './stats';
export * from './tracking';
export * from './idle';
export * from './export';
export * from './window';
export * from './domains';
export * from './utils';

// Import individual APIs
import { activitiesApi } from './activities';
import { categoriesApi } from './categories';
import { rulesApi } from './rules';
import { manualEntriesApi } from './manualEntries';
import { settingsApi } from './settings';
import { statsApi } from './stats';
import { trackingApi } from './tracking';
import { idleApi } from './idle';
import { exportApi } from './export';
import { windowApi } from './window';
import { domainsApi } from './domains';

// Combined API object for backward compatibility
export const api: {
  activities: typeof activitiesApi;
  categories: typeof categoriesApi;
  rules: typeof rulesApi;
  manualEntries: typeof manualEntriesApi;
  settings: typeof settingsApi;
  stats: typeof statsApi;
  tracking: typeof trackingApi;
  idle: typeof idleApi;
  export: typeof exportApi;
  window: typeof windowApi;
  domains: typeof domainsApi;
  getRules: typeof rulesApi.getRules;
  createRule: typeof rulesApi.createRule;
  updateRule: typeof rulesApi.updateRule;
  deleteRule: typeof rulesApi.deleteRule;
} = {
  activities: activitiesApi,
  categories: categoriesApi,
  rules: rulesApi,
  manualEntries: manualEntriesApi,
  settings: settingsApi,
  stats: statsApi,
  tracking: trackingApi,
  idle: idleApi,
  export: exportApi,
  window: windowApi,
  domains: domainsApi,
  // Convenience methods for backward compatibility
  getRules: rulesApi.getRules,
  createRule: rulesApi.createRule,
  updateRule: rulesApi.updateRule,
  deleteRule: rulesApi.deleteRule,
};

// Standalone exports for convenience (backward compatibility)
export const getRules = rulesApi.getRules;
export const createRule = rulesApi.createRule;
export const deleteRule = rulesApi.deleteRule;
export const getSettings = settingsApi.getSettings;
export const updateSettings = settingsApi.updateSettings;

export default api;
