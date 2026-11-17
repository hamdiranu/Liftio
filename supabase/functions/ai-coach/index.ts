// Supabase Edge Function (Deno): the Fitio AI coach.
// The model API key lives only here (ANTHROPIC_API_KEY secret) — the app never sees it.
//
//   supabase secrets set ANTHROPIC_API_KEY=...
//   supabase functions deploy ai-coach
import Anthropic from 'npm:@anthropic-ai/sdk@1.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { EXERCISE_CATALOG, EXERCISE_IDS } from '../_shared/exercise-catalog.ts';

const MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-opus-5-5';
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Stable system prompt (cached): role, rules and the exercise catalog the coach may reference.
const SYSTEM = `You are the AI personal trainer inside Fitio, a strength-training app.

How you coach:
- Ground every answer in the user's training context (sessions, volume, recovery by muscle group, last performance, records, goals). Quote their actual numbers when useful.
- Be direct and practical, like an experienced coach between sets. Short paragraphs; use "• " bullets for lists. Plain text only — no markdown headings, bold or tables.
- Progressive overload rule of thumb: when every working set hits the top of the rep range, add 2.5 kg (upper body) or 5 kg (lower body); if reps fall two or more below target, hold the weight.
- Respect recovery: avoid training a muscle group hit within the last 48 hours hard again; suggest rest or mobility after five or more sessions in a week.
- Only recommend exercises from the catalog below, by id. Match difficulty to the user's experience.
- Nutrition or medical questions: give general, conservative guidance and suggest a qualified professional for anything personal. Never diagnose injuries; advise stopping and seeing a professional if something hurts.
- Weights are in kilograms.

Exercise catalog (id | name | muscle group | equipment | difficulty | default sets x reps):
${EXERCISE_CATALOG.map((e) => `${e.id} | ${e.name} | ${e.group} | ${e.equipment.join('/')} | ${e.difficulty} | ${e.sets}x${e.reps}`).join('\n')}`;

const workoutSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'focus', 'estimatedMinutes', 'exercises'],
  properties: {
    title: { type: 'string' },
    focus: { type: 'string', description: 'Comma-separated muscle groups, e.g. "Chest, Shoulders"' },
    estimatedMinutes: { type: 'integer' },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['exerciseId', 'sets', 'reps', 'note'],
        properties: {
          exerciseId: { type: 'string', enum: EXERCISE_IDS },
          sets: { type: 'integer' },
          reps: { type: 'string', description: 'Rep range such as "8-12", or seconds such as "45 s" for holds' },
          note: { type: 'string', description: 'Load or progression cue based on last performance; empty string if none' },
        },
      },
    },
  },
} as const;

const SCHEMAS = {
  chat: {
    type: 'object',
    additionalProperties: false,
    required: ['content', 'workout', 'exerciseIds', 'quickActions'],
    properties: {
      content: { type: 'string', description: 'The reply shown in the chat bubble.' },
      workout: { anyOf: [{ type: 'null' }, workoutSchema], description: 'Only when the user asked for a workout or plan.' },
      exerciseIds: { type: 'array', items: { type: 'string', enum: EXERCISE_IDS }, description: 'Exercises to show as cards (0-4).' },
      quickActions: { type: 'array', items: { type: 'string' }, description: '2-3 short follow-up questions the user might tap next.' },
    },
  },
  insights: {
    type: 'object',
    additionalProperties: false,
    required: ['insights'],
    properties: {
      insights: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title', 'body', 'tone', 'icon'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string', description: 'Under 50 characters.' },
            body: { type: 'string', description: 'One or two sentences.' },
            tone: { type: 'string', enum: ['positive', 'neutral', 'warning'] },
            icon: { type: 'string', enum: ['trend', 'recovery', 'target', 'flame', 'balance', 'calendar'] },
          },
        },
      },
    },
  },
  plan: {
    type: 'object',
    additionalProperties: false,
    required: ['workout'],
    properties: { workout: workoutSchema },
  },
} as const;

type Mode = keyof typeof SCHEMAS;
type ChatTurn = { role: 'user' | 'assistant'; content: string };

function buildMessages(mode: Mode, context: unknown, messages: ChatTurn[], request?: string): Anthropic.Beta.BetaMessageParam[] {
  const ctx = `<training_context>\n${JSON.stringify(context)}\n</training_context>`;
  if (mode === 'insights') {
    return [{ role: 'user', content: `${ctx}\n\nWrite 3 to 5 weekly insights for this user: consistency, volume trend, recovery, balance between muscle groups and one concrete progression step.` }];
  }
  if (mode === 'plan') {
    return [
      {
        role: 'user',
        content: `${ctx}\n\nPlan the user's next workout${request ? ` (requested focus: ${request})` : ''}. Pick the most recovered muscle groups, fit their preferred duration, order compounds before isolation, and add a load cue per exercise from their last performance.`,
      },
    ];
  }
  // chat: prior turns verbatim; the context rides on the newest user message so the cached prefix stays stable.
  const history = messages.slice(-12).filter((m) => m.content?.trim());
  const last = history.pop();
  return [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: `${ctx}\n\n${last?.content ?? 'Hi'}` },
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // The platform verifies the JWT; resolve the user so only signed-in accounts reach the model.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Sign in to use the coach.' }, 401);

  let body: { mode?: Mode; context?: unknown; messages?: ChatTurn[]; request?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const mode: Mode = body.mode && body.mode in SCHEMAS ? body.mode : 'chat';
  if (!body.context) return json({ error: 'Missing training context.' }, 400);

  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: buildMessages(mode, body.context, body.messages ?? [], body.request),
      output_config: {
        effort: mode === 'plan' ? 'medium' : 'low',
        format: { type: 'json_schema', schema: SCHEMAS[mode] },
      },
    });

    if (response.stop_reason === 'refusal') {
      return json({
        content: 'I can’t help with that one. Ask me about your training, recovery or exercise technique instead.',
        workout: null,
        exerciseIds: [],
        quickActions: ['Build my next workout', 'Should I rest today?'],
      });
    }
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('No text in model response.');
    const parsed = JSON.parse(text.text);
    return json(parsed);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'The coach is busy. Try again in a moment.' }, 429);
    if (error instanceof Anthropic.APIError) {
      console.error('anthropic error', error.status, error.message);
      return json({ error: 'The coach is unavailable right now.' }, 502);
    }
    console.error('coach error', error);
    return json({ error: 'Something went wrong.' }, 500);
  }
});
