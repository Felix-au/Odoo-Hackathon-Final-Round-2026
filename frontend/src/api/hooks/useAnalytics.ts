import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '../analytics.api';
import { KPIData, PipelineStageCount, DealHealthAlert } from '../../types/analytics.types';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from 'sonner';

export function useDashboardAnalytics() {
  const token = useAuthStore((s) => s.accessToken) || undefined;
  const queryClient = useQueryClient();

  const kpiQuery = useQuery<KPIData, Error>({
    queryKey: ['analytics-kpis', token],
    queryFn: () => analyticsApi.getKPIs(token),
    retry: false,
    staleTime: 30_000,
  });

  const stagesQuery = useQuery<PipelineStageCount[], Error>({
    queryKey: ['analytics-stages', token],
    queryFn: () => analyticsApi.getPipelineStages(token),
    retry: false,
    staleTime: 30_000,
  });

  const alertsQuery = useQuery<DealHealthAlert[], Error>({
    queryKey: ['deal-health-alerts', token],
    queryFn: () => analyticsApi.getDealHealth(token),
    retry: false,
    staleTime: 30_000,
  });

  const nudgeMutation = useMutation({
    mutationFn: ({ alertId, message }: { alertId: string; message: string }) =>
      analyticsApi.triggerNudge(alertId, 'EMAIL_NUDGE', message, token),
    onSuccess: () => {
      toast.success('Rep nudged via automated email notice');
      queryClient.invalidateQueries({ queryKey: ['deal-health-alerts'] });
    },
    onError: () => {
      toast.error('Failed to trigger nudge');
    },
  });

  const escalateMutation = useMutation({
    mutationFn: ({ alertId, message }: { alertId: string; message: string }) =>
      analyticsApi.triggerEscalate(alertId, message, token),
    onSuccess: () => {
      toast.success('Deal escalated to sales director');
      queryClient.invalidateQueries({ queryKey: ['deal-health-alerts'] });
    },
    onError: () => {
      toast.error('Failed to escalate deal');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ alertId, reason }: { alertId: string; reason?: string }) =>
      analyticsApi.resolveAlert(alertId, reason, token),
    onSuccess: () => {
      toast.success('Deal health alert resolved');
      queryClient.invalidateQueries({ queryKey: ['deal-health-alerts'] });
    },
    onError: () => {
      toast.error('Failed to resolve alert');
    },
  });

  return {
    kpis: kpiQuery.data || null,
    stages: stagesQuery.data || [],
    alerts: alertsQuery.data || [],
    isLoading: kpiQuery.isLoading || stagesQuery.isLoading || alertsQuery.isLoading,
    nudge: nudgeMutation.mutate,
    escalate: escalateMutation.mutate,
    resolve: resolveMutation.mutate,
  };
}
