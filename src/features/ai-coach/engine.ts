import { EXERCISE_BY_ID, EXERCISES } from '@/features/exercises/catalog';
import { targetReps } from '@/features/workouts/templates';
import { formatNumber } from '@/lib/format';
import { uuid } from '@/lib/utils';
import type { CoachInsight, Exercise, FitnessGoal, MuscleGroup, WorkoutRecommendation } from '@/types';
import type { CoachContext } from './context';

/**
 * On-device coaching engine. It works offline and powers the coach when no model provider is
 * configured; every answer is grounded in the user's own logged training.
 */

export interface CoachReply {
  content: string;
  workout?: WorkoutRecommendation;
  exerciseIds?: string[];
  quickActions?: string[];
}

type Split = { key: string; title: string; groups: MuscleGroup[] };

const SPLITS: Split[] = [
  { key: 'push', title: 'Push Power', groups: ['chest', 'shoulders', 'arms'] },
  { key: 'pull', title: 'Pull Strength', groups: ['back', 'arms'] },
  { key: 'legs', title: 'Leg Day', groups: ['legs', 'core'] },
  { key: 'upper', title: 'Upper Body Builder', groups: ['chest', 'back', 'shoulders'] },
  { key: 'full', title: 'Full Body Session', groups: ['legs', 'chest', 'back', 'core'] },
];

const GOAL_LABEL: Record<FitnessGoal, string> = {
  build_muscle: 'building muscle',
  lose_fat: 'losing fat',
  increase_strength: 'getting stronger',
  improve_endurance: 'improving endurance',
  general_fitness: 'general fitness',
};

function primaryGoal(ctx: CoachContext): FitnessGoal {
  return ctx.profile.goals[0] ?? 'general_fitness';
}

function readiness(ctx: CoachContext, group: MuscleGroup) {
  const days = ctx.recovery.find((r) => r.group === group)?.daysSince;
  const rest = days == null ? 7 : Math.min(days, 7);
  const recentSets = ctx.setsByGroupLast14[group] ?? 0;
  // Rested and under-trained groups score highest; anything hit yesterday is penalized.
  return rest * 2 - recentSets * 0.15 - (days != null && days < 2 ? 6 : 0);
}

function repsFor(goal: FitnessGoal, exercise: Exercise) {
  if (exercise.isTimed) return exercise.recommended.reps;
  if (exercise.type === 'isolation') return goal === 'increase_strength' ? '8-12' : goal === 'build_muscle' ? '10-15' : '12-15';
  switch (goal) {
    case 'increase_strength':
      return '4-6';
    case 'build_muscle':
      return '8-12';
    case 'lose_fat':
    case 'improve_endurance':
      return '12-15';
    default:
      return '8-10';
  }
}

function setsFor(goal: FitnessGoal, exercise: Exercise) {
  if (exercise.type === 'isolation' || exercise.isTimed) return 3;
  return goal === 'increase_strength' || goal === 'build_muscle' ? 4 : 3;
}

function fitsExperience(exercise: Exercise, experience: CoachContext['profile']['experience']) {
  if (experience === 'beginner') return exercise.difficulty !== 'advanced';
  return true;
}

function preferenceScore(exercise: Exercise, prefs: string[]) {
  let score = 0;
  const p = prefs.map((x) => x.toLowerCase());
  if (p.includes('machines') && exercise.equipment.includes('machine')) score += 2;
  if (p.includes('cables') && exercise.equipment.includes('cable')) score += 2;
  if (p.includes('free weights') && (exercise.equipment.includes('barbell') || exercise.equipment.includes('dumbbell'))) score += 2;
  if (p.includes('bodyweight') && exercise.equipment.includes('bodyweight')) score += 2;
  if (p.includes('home gym') && (exercise.equipment.includes('dumbbell') || exercise.equipment.includes('bodyweight'))) score += 2;
  if (p.includes('heavy compounds') && exercise.type === 'compound') score += 2;
  if (p.includes('low impact') && exercise.id !== 'deadlift' && exercise.type !== 'compound') score += 1;
  return score;
}

export function recommendWorkout(ctx: CoachContext, preferredSplit?: string, minutesOverride?: number): WorkoutRecommendation {
  const goal = primaryGoal(ctx);
  const split =
    SPLITS.find((s) => s.key === preferredSplit) ??
    [...SPLITS].sort(
      (a, b) =>
        b.groups.reduce((acc, g) => acc + readiness(ctx, g), 0) / b.groups.length -
        a.groups.reduce((acc, g) => acc + readiness(ctx, g), 0) / a.groups.length,
    )[0];

  const minutes = minutesOverride ?? (ctx.profile.preferredDurationMinutes || 60);
  const count = Math.max(3, Math.min(7, Math.round(minutes / 10)));
  const chosen: Exercise[] = [];
  const pool = EXERCISES.filter((e) => split.groups.includes(e.muscleGroup) && fitsExperience(e, ctx.profile.experience));
  // Compounds first, then fill each group in turn with the best-matching isolation work.
  const ranked = [...pool].sort(
    (a, b) =>
      (b.type === 'compound' ? 3 : 0) + preferenceScore(b, ctx.profile.trainingPreferences) -
      ((a.type === 'compound' ? 3 : 0) + preferenceScore(a, ctx.profile.trainingPreferences)),
  );
  let round = 0;
  while (chosen.length < count && round < 6) {
    for (const g of split.groups) {
      if (chosen.length >= count) break;
      const next = ranked.find((e) => e.muscleGroup === g && !chosen.includes(e) && (round > 0 || e.type !== 'isolation' || g === 'arms'));
      if (next) chosen.push(next);
    }
    round++;
  }
  // Session order: heavy compounds first, isolation next, core and holds last.
  const rank = (e: Exercise) => (e.muscleGroup === 'core' ? 2 : e.type === 'compound' ? 0 : 1);
  chosen.sort((a, b) => rank(a) - rank(b));

  return {
    title: split.title,
    focus: split.groups.map((g) => g[0].toUpperCase() + g.slice(1)).join(', '),
    estimatedMinutes: minutes,
    exercises: chosen.map((e) => {
      const last = ctx.lastPerformance[e.id];
      const note = last ? progressionNote(e, last) : undefined;
      return { exerciseId: e.id, sets: setsFor(goal, e), reps: repsFor(goal, e), note };
    }),
  };
}

function progressionNote(exercise: Exercise, last: CoachContext['lastPerformance'][string]) {
  const top = Math.max(...exercise.recommended.reps.match(/\d+/g)!.map(Number));
  const hitTop = last.reps.length > 0 && last.reps.every((r) => r >= top);
  const increment = exercise.muscleGroup === 'legs' || exercise.id === 'deadlift' ? 5 : 2.5;
  if (last.weightKg <= 0) return hitTop ? 'Add a rep or slow the lowering phase' : 'Match last session, then add a rep';
  if (hitTop) return `Try ${formatNumber(last.weightKg + increment, 1)} kg (up from ${formatNumber(last.weightKg, 1)})`;
  return `Stay at ${formatNumber(last.weightKg, 1)} kg and add one rep`;
}

export function progressionAdvice(ctx: CoachContext) {
  return Object.entries(ctx.lastPerformance)
    .map(([id, last]) => ({ id, exercise: EXERCISE_BY_ID[id], last }))
    .filter((x) => x.exercise)
    .sort((a, b) => b.last.date.localeCompare(a.last.date))
    .slice(0, 5)
    .map((x) => ({ exerciseId: x.id, name: x.exercise.name, note: progressionNote(x.exercise, x.last) }));
}

export function generateInsights(ctx: CoachContext): CoachInsight[] {
  const insights: CoachInsight[] = [];
  const target = Math.max(1, ctx.profile.preferredDays.length);

  const remaining = target - ctx.sessionsThisWeek;
  if (remaining <= 0) {
    insights.push({ id: 'consistency', icon: 'flame', tone: 'positive', title: 'Right on schedule', body: `${ctx.sessionsThisWeek} sessions this week against your target of ${target}. Consistency like this is what drives progress.` });
  } else if (ctx.sessionsLast28 === 0) {
    insights.push({ id: 'consistency', icon: 'calendar', tone: 'neutral', title: 'Let’s get the first one in', body: 'Log a session and I’ll start tailoring recommendations to your training.' });
  } else {
    insights.push({ id: 'consistency', icon: 'calendar', tone: 'warning', title: `${remaining} more session${remaining > 1 ? 's' : ''} this week`, body: `You average ${ctx.avgSessionsPerWeek} sessions a week. A short ${Math.min(40, ctx.profile.preferredDurationMinutes)}-minute workout still counts.` });
  }

  if (ctx.volumePrev7Kg > 0) {
    const change = ((ctx.volumeLast7Kg - ctx.volumePrev7Kg) / ctx.volumePrev7Kg) * 100;
    if (change > 25) {
      insights.push({ id: 'volume', icon: 'trend', tone: 'warning', title: 'Big jump in volume', body: `Training volume is up ${Math.round(change)}% on last week. Keep the next session moderate so recovery keeps up.` });
    } else if (change >= 0) {
      insights.push({ id: 'volume', icon: 'trend', tone: 'positive', title: 'Volume trending up', body: `Up ${Math.round(change)}% on last week — steady, sustainable overload.` });
    } else {
      insights.push({ id: 'volume', icon: 'trend', tone: 'neutral', title: 'Lighter week', body: `Volume is down ${Math.round(Math.abs(change))}%. Fine as a deload — otherwise add a set to your main lifts.` });
    }
  }

  const fresh = ctx.recovery.filter((r) => r.daysSince != null && r.daysSince < 2).map((r) => r.group);
  const ready = ctx.recovery.filter((r) => r.daysSince == null || r.daysSince >= 3).map((r) => r.group);
  if (ctx.streakDays >= 6 && ctx.sessionsLast7 >= 5) {
    insights.push({ id: 'recovery', icon: 'recovery', tone: 'warning', title: 'Consider a recovery day', body: 'Five or more sessions in a week. A rest or mobility day now protects your next heavy session.' });
  } else if (ready.length) {
    insights.push({ id: 'recovery', icon: 'recovery', tone: 'positive', title: `${listJoin(ready.map(cap))} ${ready.length > 1 ? 'are' : 'is'} recovered`, body: fresh.length ? `Give ${listJoin(fresh.map(cap))} another day — they were trained recently.` : 'Everything is fresh. A good day for a heavy session.' });
  }

  const push = (ctx.setsByGroupLast14.chest ?? 0) + (ctx.setsByGroupLast14.shoulders ?? 0);
  const pull = ctx.setsByGroupLast14.back ?? 0;
  if (push > 0 && pull > 0 && push / pull > 1.5) {
    insights.push({ id: 'balance', icon: 'balance', tone: 'warning', title: 'Pushing more than pulling', body: `${push} pressing sets vs ${pull} pulling sets in two weeks. Add rows or pulldowns to keep shoulders healthy.` });
  } else if ((ctx.setsByGroupLast14.legs ?? 0) < 6 && ctx.sessionsLast28 > 2) {
    insights.push({ id: 'balance', icon: 'balance', tone: 'warning', title: 'Legs need attention', body: 'Fewer than 6 leg sets in two weeks. One lower-body session a week keeps your training balanced.' });
  }

  const advice = progressionAdvice(ctx)[0];
  if (advice) {
    insights.push({ id: 'overload', icon: 'target', tone: 'positive', title: `Next step on ${advice.name}`, body: `${advice.note}.` });
  }
  return insights.slice(0, 5);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const listJoin = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

function findMuscleGroup(text: string): MuscleGroup | null {
  const t = text.toLowerCase();
  const map: [RegExp, MuscleGroup][] = [
    [/chest|pec|bench/, 'chest'],
    [/back|lat|row|pull/, 'back'],
    [/shoulder|delt/, 'shoulders'],
    [/arm|bicep|tricep|curl/, 'arms'],
    [/leg|quad|hamstring|glute|calf|calves|squat/, 'legs'],
    [/core|abs|ab |oblique|six.?pack/, 'core'],
  ];
  return map.find(([re]) => re.test(t))?.[1] ?? null;
}

function findExercise(text: string): Exercise | null {
  const t = text.toLowerCase();
  return EXERCISES.find((e) => t.includes(e.name.toLowerCase())) ?? EXERCISES.find((e) => t.includes(e.slug.replace(/-/g, ' '))) ?? null;
}

const DEFAULT_ACTIONS = ['Build my next workout', 'How do I progress my lifts?', 'Should I rest today?'];

export function localReply(message: string, ctx: CoachContext): CoachReply {
  const t = message.toLowerCase();
  const goal = primaryGoal(ctx);
  const exercise = findExercise(message);

  if (/mobility|stretch|warm.?up|active recovery/.test(t)) {
    return {
      content: [
        'A 15-minute mobility routine for a recovery day:',
        '• 3 min easy cardio (bike, rower or brisk walk)',
        '• Cat–cow × 10 slow reps',
        '• World’s greatest stretch × 5 per side',
        '• 90/90 hip switches × 8 per side',
        '• Thoracic open books × 8 per side',
        '• Deep squat hold, 3 × 30 s (hold onto something if needed)',
        '• Band pull-aparts or wall slides × 15',
        '',
        'Move slowly and stay below any pain. Before lifting, do the same moves at a brisker pace plus two light ramp-up sets of your first exercise.',
      ].join('\n'),
      quickActions: ['Build my next workout', 'Should I rest today?'],
    };
  }

  const shorter = /shorter|quick|less time|short on time|30.?min/.test(t);
  const why = /^why|why these|why this/.test(t);
  if (why) {
    const workout = recommendWorkout(ctx);
    const rested = ctx.recovery
      .filter((r) => workout.focus.toLowerCase().includes(r.group))
      .map((r) => `${cap(r.group)} (${r.daysSince == null ? 'not trained recently' : `${r.daysSince} day${r.daysSince === 1 ? '' : 's'} since last trained`})`);
    return {
      content: `I build sessions from three things:\n\n• Recovery: ${listJoin(rested) || 'your most-rested muscle groups'}.\n• Your goal (${GOAL_LABEL[goal]}): that sets the rep ranges — ${repsFor(goal, EXERCISE_BY_ID['barbell-squat'])} for big lifts, higher for isolation work.\n• Your setup and level: ${ctx.profile.experience} exercises that match your preferences (${ctx.profile.trainingPreferences.join(', ') || 'any equipment'}).\n\nCompounds go first while you’re fresh, then isolation, then core.`,
      exerciseIds: workout.exercises.slice(0, 4).map((e) => e.exerciseId),
      quickActions: ['Make it shorter', 'Build my next workout'],
    };
  }

  if ((/workout|plan|routine|program|session|today|build|train|day\b|swap/.test(t) || shorter) && !exercise) {
    const group = findMuscleGroup(t);
    const splitKey = /push/.test(t)
      ? 'push'
      : /pull/.test(t)
        ? 'pull'
        : /leg/.test(t)
          ? 'legs'
          : /full/.test(t)
            ? 'full'
            : /upper/.test(t)
              ? 'upper'
              : group === 'chest' || group === 'shoulders'
                ? 'push'
                : group === 'back'
                  ? 'pull'
                  : group === 'arms'
                    ? 'upper'
                    : group === 'core'
                      ? 'full'
                      : undefined;
    const workout = recommendWorkout(ctx, splitKey, shorter ? 30 : undefined);
    const focusGroups = listJoin(workout.focus.split(', ').map((s) => s.toLowerCase()));
    return {
      content: shorter
        ? `Here’s a tighter ${workout.estimatedMinutes}-minute version: fewer exercises, the big lifts kept. Keep rests to 60–90 seconds and you’ll be done on time.`
        : `Here’s a ${workout.estimatedMinutes}-minute ${workout.title.toLowerCase()} built around ${GOAL_LABEL[goal]}. ${splitKey ? `It focuses on ${focusGroups}, as you asked.` : `I picked it because ${focusGroups} ${workout.focus.includes(',') ? 'are' : 'is'} the most recovered right now.`} Weights carry over from your last sessions with a small step up where you earned it.`,
      workout,
      quickActions: shorter ? ['Why these exercises?', 'Swap to a pull day'] : ['Make it shorter', splitKey === 'push' ? 'Swap to a pull day' : 'Swap to a push day', 'Why these exercises?'],
    };
  }

  if (/how many sets|sets per week|weekly sets|how much volume/.test(t)) {
    const sets = Object.entries(ctx.setsByGroupLast14)
      .map(([g, n]) => `• ${cap(g)}: about ${Math.round(n / 2)} sets a week`)
      .join('\n');
    return {
      content: `A solid target for most lifters is 10–20 hard sets per muscle group each week, spread over two sessions. Beginners grow well on the lower end; push toward 20 only if you’re recovering well.\n\nYour last two weeks:\n${sets}`,
      quickActions: ['Build my next workout', 'What should I improve?'],
    };
  }

  if (/improve|weak|lagging|imbalance|focus on/.test(t)) {
    const flagged = generateInsights(ctx).filter((i) => i.tone === 'warning');
    return {
      content: flagged.length
        ? `Here’s where I’d focus next:\n\n${flagged.map((i) => `• ${i.title}: ${i.body}`).join('\n')}`
        : 'Nothing stands out — your frequency, balance and progression all look healthy. Keep adding small amounts of load and stay consistent.',
      quickActions: ['Build my next workout', 'How do I progress my lifts?'],
    };
  }

  if (/overload|progress|plateau|stuck|increase|heavier|stall|miss/.test(t)) {
    const advice = progressionAdvice(ctx);
    if (!advice.length) {
      return {
        content: 'Log a couple of sessions and I’ll tell you exactly when to add weight. The rule I use: once every working set reaches the top of the rep range, add 2.5 kg for upper body or 5 kg for lower body and work back up.',
        quickActions: DEFAULT_ACTIONS,
      };
    }
    return {
      content: `Progressive overload, based on your last sessions:\n\n${advice.map((a) => `• ${a.name}: ${a.note}`).join('\n')}\n\nThe rule: hit the top of the rep range on every working set, then add load. If reps drop more than two below the target, hold the weight next time.`,
      exerciseIds: advice.map((a) => a.exerciseId),
      quickActions: ['Build my next workout', 'What if I miss reps?'],
    };
  }

  if (/rest|recover|sore|tired|deload|fatigue|sleep/.test(t)) {
    const fresh = ctx.recovery.filter((r) => r.daysSince != null && r.daysSince < 2).map((r) => r.group);
    const ready = ctx.recovery.filter((r) => r.daysSince == null || r.daysSince >= 2).map((r) => r.group);
    const heavyWeek = ctx.sessionsLast7 >= 5;
    return {
      content: heavyWeek
        ? `You’ve trained ${ctx.sessionsLast7} times this week, so a recovery day is a smart call. Go for a 20–30 minute walk, light mobility, and prioritize 7–9 hours of sleep. You’ll come back stronger.`
        : `You’re in good shape to train. ${ready.length ? `${listJoin(ready.map(cap))} ${ready.length > 1 ? 'are' : 'is'} recovered` : 'Most muscle groups are recovered'}${fresh.length ? `, while ${listJoin(fresh.map(cap))} could use another day` : ''}. If you feel unusually sore or sleep was poor, keep the session but cut one set from each exercise.`,
      quickActions: heavyWeek ? ['Give me a mobility routine', 'When should I deload?'] : ['Build my next workout', 'When should I deload?'],
    };
  }

  if (/analy|how am i|how’s my|how is my|performance|report|consisten|summary/.test(t)) {
    const change = ctx.volumePrev7Kg ? Math.round(((ctx.volumeLast7Kg - ctx.volumePrev7Kg) / ctx.volumePrev7Kg) * 100) : null;
    const top = ctx.topRecords.slice(0, 3).map((r) => `• ${r.exercise}: ~${r.e1rmKg} kg estimated 1RM`);
    return {
      content: [
        `Here’s your training snapshot:`,
        `• ${ctx.sessionsLast7} sessions in the last 7 days, ${ctx.sessionsLast28} in the last 28 (about ${ctx.avgSessionsPerWeek}/week).`,
        `• Weekly volume: ${formatNumber(ctx.volumeLast7Kg)} kg${change != null ? ` (${change >= 0 ? '+' : ''}${change}% vs last week)` : ''}.`,
        `• Current streak: ${ctx.streakDays} days.`,
        ...(top.length ? ['', 'Strongest lifts:', ...top] : []),
      ].join('\n'),
      quickActions: ['What should I improve?', 'Build my next workout'],
    };
  }

  if (exercise) {
    return {
      content: `${exercise.name} trains your ${exercise.primaryMuscle}${exercise.secondaryMuscles.length ? ` with help from ${exercise.secondaryMuscles.slice(0, 3).join(', ')}` : ''}.\n\n${exercise.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nCoach tip: ${exercise.tips[0] ?? 'control the lowering phase.'} For ${GOAL_LABEL[goal]}, aim for ${setsFor(goal, exercise)} sets of ${repsFor(goal, exercise)}.`,
      exerciseIds: [exercise.id],
      quickActions: ['Alternatives to this exercise', 'Build my next workout'],
    };
  }

  const group = findMuscleGroup(t);
  if (group || /exercise|alternative|recommend|suggest|best/.test(t)) {
    const g = group ?? ([...ctx.recovery].sort((a, b) => (b.daysSince ?? 99) - (a.daysSince ?? 99))[0]?.group ?? 'chest');
    const picks = EXERCISES.filter((e) => e.muscleGroup === g && fitsExperience(e, ctx.profile.experience))
      .sort((a, b) => preferenceScore(b, ctx.profile.trainingPreferences) - preferenceScore(a, ctx.profile.trainingPreferences))
      .slice(0, 4);
    return {
      content: `Top ${g} exercises for you right now. Start with a compound and finish with one isolation movement — 10 to 16 hard sets per week is a good target for ${GOAL_LABEL[goal]}.`,
      exerciseIds: picks.map((p) => p.id),
      quickActions: [`Build a ${g} workout`, 'How many sets per week?'],
    };
  }

  if (/protein|diet|nutrition|eat|calorie|food|cut|bulk/.test(t)) {
    const w = ctx.profile.weightKg;
    return {
      content: `General guidance (not medical advice): aim for roughly 1.6–2.2 g of protein per kg of body weight${w ? ` — about ${Math.round(w * 1.6)}–${Math.round(w * 2.2)} g a day for you` : ''}, spread across 3–5 meals. ${goal === 'lose_fat' ? 'For fat loss, a modest deficit of 300–500 kcal keeps strength intact.' : goal === 'build_muscle' ? 'For muscle gain, a small surplus of 200–300 kcal keeps fat gain low.' : 'Eat mostly whole foods and keep protein consistent.'} For a personalised plan, check with a registered dietitian.`,
      quickActions: DEFAULT_ACTIONS,
    };
  }

  return {
    content: `I can build workouts, plan progressive overload, check your recovery and break down your training. You’re focused on ${GOAL_LABEL[goal]} with ${ctx.profile.preferredDays.length} training days a week — try one of the suggestions below, or ask about any exercise in the library.`,
    quickActions: DEFAULT_ACTIONS,
  };
}

export const SUGGESTED_QUESTIONS = [
  'Build my next workout',
  'How should I progress my bench press?',
  'Should I rest today?',
  'Analyze my last month',
  'Best exercises for back width',
  'How much protein do I need?',
];

export function newMessageId() {
  return uuid();
}

export function startingReps(reps: string) {
  return targetReps(reps);
}
