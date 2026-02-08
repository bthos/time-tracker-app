import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export function useDeleteFocusSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.pomodoro.deleteFocusSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focusSessions'] });
      queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['todayTotal'] });
    },
  });
}
