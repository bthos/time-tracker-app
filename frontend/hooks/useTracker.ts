import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trackingApi } from '../services/api/tracking';

export function useTrackerStatus() {
  return useQuery({
    queryKey: ['trackerStatus'],
    queryFn: () => trackingApi.getTrackingStatus(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

export function usePauseTracking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => trackingApi.pauseTracking(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackerStatus'] });
    },
  });
}

export function useResumeTracking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => trackingApi.resumeTracking(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackerStatus'] });
    },
  });
}

export function useStartThinkingMode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => trackingApi.startThinkingMode(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useStopThinkingMode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => trackingApi.stopThinkingMode(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
