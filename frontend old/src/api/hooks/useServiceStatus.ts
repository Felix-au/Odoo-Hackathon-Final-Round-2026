import { useQuery } from '@tanstack/react-query';
import { checkAllServices, ServiceHealth } from '../status.api';

export function useServiceStatus() {
  return useQuery<ServiceHealth[]>({
    queryKey: ['service-status'],
    queryFn: checkAllServices,
    refetchInterval: 15_000, // Real-time polling every 15 seconds
    staleTime: 10_000,
  });
}
