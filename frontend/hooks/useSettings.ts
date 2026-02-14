import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../services/api/settings';
import { useStore } from '../store';
import { useEffect } from 'react';
import type { Settings } from '../types';

export function useSettings() {
  const { setSettings } = useStore();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  useEffect(() => {
    if (query.data) {
      // Merge backend settings with current frontend-only settings (like darkMode)
      const currentSettings = useStore.getState().settings;
      setSettings({
        ...query.data,
        // Preserve frontend-only settings
        pollingInterval: currentSettings.pollingInterval ?? 5,
        theme: currentSettings.theme ?? 'system',
        darkMode: currentSettings.darkMode ?? false,
        enable_marketplace: (query.data as Settings).enable_marketplace ?? true, // Default to true for new installations
      });
    }
  }, [query.data, setSettings]);

  return query;
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<Settings>) => settingsApi.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
