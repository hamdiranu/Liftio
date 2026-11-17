import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useUserId } from '@/features/auth/store';
import { useProfile } from '@/features/profile/hooks';
import { usePersonalRecords, useWorkoutsInRange } from '@/features/workouts/hooks';
import { queryKeys } from '@/lib/query';
import { nowIso } from '@/services/db';
import { useSettings } from '@/store/settings';
import type { ChatMessage } from '@/types';
import { buildCoachContext, minimalContext } from './context';
import { newMessageId } from './engine';
import { addMessage, createConversation, deleteConversation, listConversations, listMessages } from './repository';
import { getCoachProvider } from './service';

export function useCoachContext() {
  const workouts = useWorkoutsInRange('90d');
  const profile = useProfile();
  const records = usePersonalRecords();
  const share = useSettings((s) => s.privacy.sendWorkoutDataToCoach);
  const ctx = useMemo(() => {
    if (!workouts.data || !profile.data) return null;
    const full = buildCoachContext(workouts.data, profile.data, records.data ?? []);
    return share ? full : minimalContext(full);
  }, [workouts.data, profile.data, records.data, share]);
  return {
    ctx,
    isLoading: workouts.isLoading || profile.isLoading,
    error: workouts.error ?? profile.error,
    refetch: () => {
      void workouts.refetch();
      void profile.refetch();
    },
  };
}

export function useCoachInsights() {
  const userId = useUserId();
  const { ctx, isLoading, error } = useCoachContext();
  const provider = getCoachProvider();
  const query = useQuery({
    queryKey: [...queryKeys.insights(userId), provider.id, ctx?.sessionsLast7, ctx?.volumeLast7Kg, ctx?.profile.goals.join(',')],
    queryFn: () => provider.insights(ctx!),
    enabled: Boolean(ctx),
    staleTime: 10 * 60 * 1000,
  });
  return { ...query, isLoading: isLoading || query.isLoading, error: error ?? query.error, ctx };
}

export function useRecommendedWorkout(split?: string) {
  const userId = useUserId();
  const { ctx } = useCoachContext();
  const provider = getCoachProvider();
  return useQuery({
    queryKey: [...queryKeys.insights(userId), 'plan', provider.id, split ?? 'auto', ctx?.sessionsLast7, ctx?.profile.preferredDurationMinutes, ctx?.profile.goals.join(',')],
    queryFn: () => provider.plan(ctx!, split),
    enabled: Boolean(ctx),
    staleTime: 10 * 60 * 1000,
  });
}

export function useConversations() {
  const userId = useUserId();
  return useQuery({ queryKey: queryKeys.conversations(userId), queryFn: () => listConversations(userId) });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.messages(conversationId ?? 'none'),
    queryFn: () => listMessages(conversationId!),
    enabled: Boolean(conversationId),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: () => createConversation(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations(userId) }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: (id: string) => deleteConversation(userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations(userId) }),
  });
}

/** Sends a user message, persists both sides of the exchange and returns the coach reply. */
export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  const userId = useUserId();
  const { ctx } = useCoachContext();
  return useMutation({
    mutationFn: async (text: string) => {
      if (!conversationId) throw new Error('No conversation selected.');
      if (!ctx) throw new Error('Your training data is still loading.');
      const key = queryKeys.messages(conversationId);
      const history = qc.getQueryData<ChatMessage[]>(key) ?? [];
      const userMessage: ChatMessage = { id: newMessageId(), conversationId, role: 'user', content: text.trim(), createdAt: nowIso() };
      qc.setQueryData<ChatMessage[]>(key, [...history, userMessage]);
      await addMessage(userId, userMessage, history.length === 0 ? text.trim().slice(0, 48) : undefined);

      const reply = await getCoachProvider().reply(history, text, ctx);
      const assistant: ChatMessage = {
        id: newMessageId(),
        conversationId,
        role: 'assistant',
        createdAt: nowIso(),
        content: reply.content,
        workout: reply.workout,
        exerciseIds: reply.exerciseIds,
        quickActions: reply.quickActions,
      };
      await addMessage(userId, assistant);
      qc.setQueryData<ChatMessage[]>(key, (prev) => [...(prev ?? []), assistant]);
      return assistant;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations(userId) });
    },
  });
}
