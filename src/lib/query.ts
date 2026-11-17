import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  workouts: (userId: string) => ['workouts', userId] as const,
  workoutList: (userId: string, scope: string) => ['workouts', userId, 'list', scope] as const,
  workout: (id: string) => ['workout', id] as const,
  templates: (userId: string) => ['templates', userId] as const,
  template: (id: string) => ['template', id] as const,
  records: (userId: string) => ['workouts', userId, 'records'] as const,
  exerciseHistory: (userId: string, exerciseId: string) => ['workouts', userId, 'exercise', exerciseId] as const,
  exercises: ['exercises'] as const,
  favorites: (userId: string) => ['favorites', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  conversations: (userId: string) => ['coach', userId, 'conversations'] as const,
  messages: (conversationId: string) => ['coach', 'messages', conversationId] as const,
  insights: (userId: string) => ['coach', userId, 'insights'] as const,
  sync: (userId: string) => ['sync', userId] as const,
};
