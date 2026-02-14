import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { statsApi } from '../services/api/stats';
import { activitiesApi } from '../services/api/activities';
import { trackingApi } from '../services/api/tracking';
import { useStore } from '../store';
import type { TimelineBlock, StatsResponse } from '../types';

// Helper function to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

export function useActivities() {
  // Use selectors to get date range to prevent infinite re-renders
  const dateRangePreset = useStore((state) => state.dateRangePreset);
  const customStartTimestamp = useStore((state) => 
    state.dateRangePreset === 'custom' 
      ? (state.selectedDateRange.start instanceof Date 
          ? state.selectedDateRange.start.getTime() 
          : new Date(state.selectedDateRange.start).getTime())
      : null
  );
  const customEndTimestamp = useStore((state) => 
    state.dateRangePreset === 'custom'
      ? (state.selectedDateRange.end instanceof Date 
          ? state.selectedDateRange.end.getTime() 
          : new Date(state.selectedDateRange.end).getTime())
      : null
  );
  
  // Memoize date range calculation (reuse store helper)
  const normalizedRange = useMemo(
    () => useStore.getState().getDateRange(),
    [dateRangePreset, customStartTimestamp, customEndTimestamp] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const startTime = normalizedRange.start.getTime();
  const endTime = normalizedRange.end.getTime();
  const queryKey = useMemo(() => ['activities', startTime, endTime], [startTime, endTime]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      return await withTimeout(activitiesApi.getActivities(normalizedRange), 10000); // 10 second timeout
    },
    retry: 1,
    retryDelay: 1000,
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

export function useDailyStats(date?: Date) {
  const targetDate = date || new Date();

  return useQuery({
    queryKey: ['dailyStats', targetDate.getTime()],
    queryFn: async () => {
      return await withTimeout(statsApi.getDailyStats(targetDate), 10000); // 10 second timeout
    },
    retry: 1,
    retryDelay: 1000,
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/** Aggregated stats for a date range (multi-day). Uses get_stats backend (SQL aggregation). */
export function useStatsForRange(range: { start: Date; end: Date } | null) {
  const isMultiDay = range && range.start.toDateString() !== range.end.toDateString();
  const startTs = range?.start.getTime() ?? 0;
  const endTs = range?.end.getTime() ?? 0;

  return useQuery<StatsResponse>({
    queryKey: ['statsRange', startTs, endTs],
    queryFn: async () => {
      if (!range) throw new Error('No range');
      return await withTimeout(statsApi.getStats(range), 10000);
    },
    enabled: Boolean(isMultiDay && range),
    retry: 1,
    retryDelay: 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useTimeline(_date?: Date) {
  const { data: activities, isLoading, error } = useActivities();
  const categories = useStore((state) => state.categories);
  
  const timelineData = useMemo(() => {
    if (!activities || activities.length === 0) {
      return [];
    }
    
    // Derive timeline blocks from activities
    return activities.map((activity) => {
      const category = activity.category_id 
        ? categories.find(c => c.id === activity.category_id) || null
        : null;
      
      return {
        start: activity.started_at * 1000, // Convert to milliseconds
        end: (activity.started_at + activity.duration_sec) * 1000,
        app_name: activity.app_name,
        domain: activity.domain,
        category: category,
        is_idle: activity.is_idle,
        is_manual: false,
      } as TimelineBlock;
    });
  }, [activities, categories]);
  
  return {
    data: timelineData,
    isLoading,
    error,
  };
}

export function useUpdateActivityCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, categoryId }: { activityId: number; categoryId: number }) =>
      activitiesApi.updateActivityCategory(activityId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
      queryClient.invalidateQueries({ queryKey: ['statsRange'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['todayTotal'] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => activitiesApi.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
      queryClient.invalidateQueries({ queryKey: ['statsRange'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['todayTotal'] });
    },
  });
}

export function useTodayTotal() {
  return useQuery({
    queryKey: ['todayTotal'],
    queryFn: () => trackingApi.getTodayTotal(),
    refetchInterval: 5000, // Refetch every 5 seconds to keep it updated
    retry: 1,
    retryDelay: 1000,
  });
}
