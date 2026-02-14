import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../services/api/categories';
import { useStore } from '../store';
import { useEffect } from 'react';

export function useCategories() {
  const { setCategories } = useStore();

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getCategories(),
  });

  useEffect(() => {
    if (query.data) {
      setCategories(query.data);
    }
  }, [query.data, setCategories]);

  return query;
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category: {
      name: string;
      color: string;
      icon: string;
      is_productive: boolean | null;
      sort_order: number;
      is_system?: boolean;
      is_pinned?: boolean;
    }) => categoriesApi.createCategory(category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedCategories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category: {
      id: number;
      name: string;
      color: string;
      icon: string;
      is_productive: boolean | null;
      sort_order: number;
      is_pinned?: boolean;
    }) => categoriesApi.updateCategory(category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedCategories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => categoriesApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedCategories'] });
    },
  });
}

export function useResetSystemCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => categoriesApi.resetSystemCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedCategories'] });
    },
  });
}

export function usePinnedCategories() {
  const query = useQuery({
    queryKey: ['pinnedCategories'],
    queryFn: () => categoriesApi.getPinnedCategories(),
  });

  return query;
}
