import { isSupabaseConfigured, supabase } from '@/services/supabase';
import type { ChatMessage, CoachInsight, WorkoutRecommendation } from '@/types';
import type { CoachContext } from './context';
import { generateInsights, localReply, recommendWorkout, type CoachReply } from './engine';

/**
 * The coach talks to a provider through this interface so the model behind it can change
 * without touching UI code. API keys never ship in the app: the "edge" provider calls a
 * Supabase Edge Function that holds the key server-side.
 */
export interface CoachProvider {
  readonly id: 'local' | 'edge';
  reply(history: ChatMessage[], message: string, ctx: CoachContext): Promise<CoachReply>;
  insights(ctx: CoachContext): Promise<CoachInsight[]>;
  plan(ctx: CoachContext, request?: string): Promise<WorkoutRecommendation>;
}

const localProvider: CoachProvider = {
  id: 'local',
  async reply(_history, message, ctx) {
    // Small delay so the typing indicator reads naturally.
    await new Promise((r) => setTimeout(r, 650 + Math.random() * 500));
    return localReply(message, ctx);
  },
  async insights(ctx) {
    return generateInsights(ctx);
  },
  async plan(ctx, request) {
    return recommendWorkout(ctx, request);
  },
};

type EdgeResponse = { content: string; workout?: WorkoutRecommendation | null; exerciseIds?: string[]; quickActions?: string[]; insights?: CoachInsight[] };

async function invokeEdge(body: Record<string, unknown>): Promise<EdgeResponse> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke<EdgeResponse>('ai-coach', { body });
  if (error) throw error;
  if (!data) throw new Error('Empty response from coach.');
  return data;
}

const edgeProvider: CoachProvider = {
  id: 'edge',
  async reply(history, message, ctx) {
    try {
      const data = await invokeEdge({
        mode: 'chat',
        context: ctx,
        messages: [
          ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      });
      return {
        content: data.content,
        workout: data.workout ?? undefined,
        exerciseIds: data.exerciseIds,
        quickActions: data.quickActions,
      };
    } catch (error) {
      // Offline or the function is unavailable: answer from the on-device engine instead.
      console.warn('[coach] edge provider failed, using local engine', error);
      return localReply(message, ctx);
    }
  },
  async insights(ctx) {
    try {
      const data = await invokeEdge({ mode: 'insights', context: ctx });
      return data.insights?.length ? data.insights : generateInsights(ctx);
    } catch {
      return generateInsights(ctx);
    }
  },
  async plan(ctx, request) {
    try {
      const data = await invokeEdge({ mode: 'plan', context: ctx, request });
      return data.workout ?? recommendWorkout(ctx, request);
    } catch {
      return recommendWorkout(ctx, request);
    }
  },
};

const configured = (process.env.EXPO_PUBLIC_AI_PROVIDER ?? 'local').toLowerCase();

export function getCoachProvider(): CoachProvider {
  return configured === 'edge' && isSupabaseConfigured ? edgeProvider : localProvider;
}
