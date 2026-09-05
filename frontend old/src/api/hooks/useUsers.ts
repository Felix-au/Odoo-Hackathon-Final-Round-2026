import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../auth.api';
import { User } from '../../types/api.types';
import { Role } from '../../lib/constants';
import { useAuthStore } from '../../stores/auth.store';

export function useUsers(page = 1, pageSize = 50) {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery<{ data: User[]; total: number }, Error>({
    queryKey: ['users', page, pageSize, token],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return authApi.getUsers(token, page, pageSize);
    },
    enabled: !!token,
    retry: 1,
    staleTime: 15_000,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      if (!token) throw new Error('Not authenticated');
      return authApi.updateUserRole(token, userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
