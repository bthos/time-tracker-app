import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rulesApi } from '../services/api/rules';

export const useRules = () => {
  const queryClient = useQueryClient();

  const {
    data: rules = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['rules'],
    queryFn: rulesApi.getRules,
  });

  const createMutation = useMutation({
    mutationFn: rulesApi.createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: rulesApi.deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: rulesApi.updateRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  return {
    rules,
    isLoading,
    error,
    createRule: createMutation.mutateAsync,
    updateRule: updateMutation.mutateAsync,
    deleteRule: deleteMutation.mutateAsync,
  };
};
