import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../analytics.api';
import { KPIData, PipelineStageCount, DealHealthAlert } from '../../types/analytics.types';
import { useAuthStore } from '../../stores/auth.store';

export function useDashboardAnalytics() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  const kpiQuery = useQuery<KPIData | null, Error>({
    queryKey: ['analytics-kpis', token],
    queryFn: async () => {
      try {
        return await analyticsApi.getKPIs(token);
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const stagesQuery = useQuery<PipelineStageCount[], Error>({
    queryKey: ['analytics-stages', token],
    queryFn: async () => {
      try {
        return await analyticsApi.getPipelineStages(token);
      } catch {
        return [];
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const alertsQuery = useQuery<DealHealthAlert[], Error>({
    queryKey: ['deal-health-alerts', token],
    queryFn: async () => {
      try {
        return await analyticsApi.getDealHealth(token);
      } catch {
        return [];
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  return {
    kpis: kpiQuery.data || null,
    stages: stagesQuery.data || [],
    alerts: alertsQuery.data || [],
    isLoading: kpiQuery.isLoading || stagesQuery.isLoading || alertsQuery.isLoading,
  };
}
