import type { MuscleGroup, TemplateExercise } from '@/types';

export interface TemplateDefinition {
  key: string;
  name: string;
  description: string;
  focus: MuscleGroup[];
  estimatedMinutes: number;
  exercises: TemplateExercise[];
}

const ex = (exerciseId: string, sets: number, reps: string, restSeconds = 90): TemplateExercise => ({
  exerciseId,
  sets,
  reps,
  restSeconds,
});

/** Starter programs copied into a new user's templates so Train is never empty. */
export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
  {
    key: 'upper-strength',
    name: 'Upper Body Strength',
    description: 'Heavy presses and rows for a stronger chest, back and shoulders.',
    focus: ['chest', 'back', 'shoulders'],
    estimatedMinutes: 60,
    exercises: [
      ex('flat-barbell-bench-press', 4, '5-8', 150),
      ex('barbell-bent-over-row', 4, '6-10', 120),
      ex('dumbbell-shoulder-press', 3, '8-12', 90),
      ex('lat-pulldown', 3, '8-12', 90),
      ex('cable-tricep-pushdown', 3, '10-15', 60),
      ex('hammer-curl', 3, '10-12', 60),
    ],
  },
  {
    key: 'push',
    name: 'Push Day',
    description: 'Chest, shoulders and triceps with a mix of heavy and pump work.',
    focus: ['chest', 'shoulders', 'arms'],
    estimatedMinutes: 55,
    exercises: [
      ex('incline-dumbbell-press', 4, '8-12', 90),
      ex('flat-barbell-bench-press', 3, '6-8', 150),
      ex('cable-chest-fly', 3, '12-15', 60),
      ex('lateral-raise', 4, '12-20', 60),
      ex('overhead-tricep-extension', 3, '10-12', 60),
    ],
  },
  {
    key: 'pull',
    name: 'Pull Day',
    description: 'Back width and thickness, rear delts and biceps.',
    focus: ['back', 'arms'],
    estimatedMinutes: 55,
    exercises: [
      ex('pull-up', 4, '5-10', 120),
      ex('seated-cable-row', 3, '10-12', 90),
      ex('one-arm-dumbbell-row', 3, '8-12', 75),
      ex('reverse-pec-deck', 3, '12-15', 60),
      ex('barbell-bicep-curl', 3, '8-12', 75),
    ],
  },
  {
    key: 'legs',
    name: 'Leg Day',
    description: 'Squat-focused lower body session with hamstring and calf work.',
    focus: ['legs', 'core'],
    estimatedMinutes: 65,
    exercises: [
      ex('barbell-squat', 4, '5-8', 180),
      ex('romanian-deadlift', 3, '8-10', 120),
      ex('leg-press', 3, '10-15', 120),
      ex('leg-curl', 3, '10-15', 60),
      ex('calf-raises', 4, '12-20', 60),
      ex('plank', 3, '30-60 s', 45),
    ],
  },
  {
    key: 'full-body',
    name: 'Full Body Express',
    description: 'A 35-minute session that hits everything when time is short.',
    focus: ['legs', 'chest', 'back', 'core'],
    estimatedMinutes: 35,
    exercises: [
      ex('barbell-squat', 3, '6-8', 120),
      ex('push-up', 3, '10-20', 60),
      ex('lat-pulldown', 3, '8-12', 75),
      ex('walking-lunges', 2, '10-12 / leg', 75),
      ex('cable-crunch', 2, '12-15', 45),
    ],
  },
];

/** Parses a rep target like "8-12", "20" or "10-12 / leg" into a starting rep count. */
export function targetReps(reps: string): number {
  const match = reps.match(/\d+/g);
  if (!match) return 10;
  const nums = match.map(Number);
  return nums.length > 1 ? Math.round((nums[0] + nums[1]) / 2) : nums[0];
}

export function targetSeconds(reps: string): number {
  const match = reps.match(/\d+/g);
  return match ? Number(match[match.length - 1]) : 45;
}
