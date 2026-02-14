import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manualEntriesApi } from '../services/api/manualEntries';
import { useStore } from '../store';

export function useManualEntries() {
  const { getDateRange } = useStore();
  const range = getDateRange();

  // Ensure dates are Date objects (defensive check)
  const normalizedRange = {
    start: range.start instanceof Date ? range.start : new Date(range.start),
    end: range.end instanceof Date ? range.end : new Date(range.end),
  };

  return useQuery({
    queryKey: ['manualEntries', normalizedRange.start.getTime(), normalizedRange.end.getTime()],
    queryFn: () => manualEntriesApi.getManualEntries(normalizedRange),
  });
}

export function useCreateManualEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: {
      description: string | null;
      category_id: number | null;
      started_at: number;
      ended_at: number;
    }) => manualEntriesApi.createManualEntry(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manualEntries'] });
      queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['todayTotal'] });
    },
  });
}

export function useUpdateManualEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: {
      id: number;
      description: string | null;
      category_id: number | null;
      started_at: number;
      ended_at: number;
    }) => manualEntriesApi.updateManualEntry(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manualEntries'] });
      queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['todayTotal'] });
    },
  });
}

export function useDeleteManualEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => manualEntriesApi.deleteManualEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manualEntries'] });
      queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['todayTotal'] });
    },
  });
}
