export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';

export type Muscle =
  | 'chest'
  | 'upper chest'
  | 'lower chest'
  | 'lats'
  | 'upper back'
  | 'lower back'
  | 'traps'
  | 'front delts'
  | 'side delts'
  | 'rear delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'abs'
  | 'obliques'
  | 'hip flexors';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'bench'
  | 'pull-up bar'
  | 'ez bar'
  | 'plate';

export type ExerciseType = 'compound' | 'isolation' | 'bodyweight' | 'isometric';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id: string;
  slug: string;
  name: string;
  muscleGroup: MuscleGroup;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  type: ExerciseType;
  difficulty: Difficulty;
  description: string;
  instructions: string[];
  tips: string[];
  recommended: { sets: number; reps: string; restSeconds: number };
  /** Tracked as time (seconds) instead of reps, e.g. plank. */
  isTimed?: boolean;
  /** Bodyweight movements log added load only (0 = bodyweight). */
  isBodyweight?: boolean;
}

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export interface WorkoutSet {
  id: string;
  index: number;
  type: SetType;
  /** Always stored in kilograms; converted for display. */
  weightKg: number | null;
  reps: number | null;
  /** For timed exercises. */
  durationSeconds: number | null;
  completed: boolean;
  completedAt: string | null;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;
  notes: string;
  restSeconds: number;
  sets: WorkoutSet[];
}

export type WorkoutStatus = 'in_progress' | 'completed' | 'discarded';

export interface Workout {
  id: string;
  userId: string;
  name: string;
  status: WorkoutStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  notes: string;
  templateId: string | null;
  exercises: WorkoutExercise[];
  isSample?: boolean;
}

export interface WorkoutSummaryStats {
  totalVolumeKg: number;
  totalSets: number;
  completedSets: number;
  totalReps: number;
  exerciseCount: number;
  durationSeconds: number;
  estimatedCalories: number;
  personalRecords: PersonalRecord[];
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  focus: MuscleGroup[];
  estimatedMinutes: number;
  exercises: TemplateExercise[];
  createdAt: string;
  updatedAt: string;
  isBuiltIn?: boolean;
}

export type RecordType = 'max_weight' | 'estimated_1rm' | 'max_reps' | 'max_volume';

export interface PersonalRecord {
  id: string;
  userId: string;
  exerciseId: string;
  type: RecordType;
  value: number;
  reps: number | null;
  workoutId: string;
  achievedAt: string;
}

export type FitnessGoal =
  | 'build_muscle'
  | 'lose_fat'
  | 'increase_strength'
  | 'improve_endurance'
  | 'general_fitness';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Profile {
  id: string;
  name: string;
  avatarUri: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  experience: ExperienceLevel;
  goals: FitnessGoal[];
  preferredDays: Weekday[];
  preferredDurationMinutes: number;
  trainingPreferences: string[];
  updatedAt: string;
}

export type WeightUnit = 'kg' | 'lb';
export type ThemeMode = 'system' | 'light' | 'dark' | 'oled';

export interface AppSettings {
  unit: WeightUnit;
  theme: ThemeMode;
  notifications: {
    workoutReminders: boolean;
    reminderHour: number;
    restTimerAlerts: boolean;
    weeklySummary: boolean;
  };
  privacy: {
    shareAnalytics: boolean;
    sendWorkoutDataToCoach: boolean;
  };
  defaultRestSeconds: number;
}

export type ChatRole = 'user' | 'assistant';

export interface WorkoutRecommendation {
  title: string;
  focus: string;
  estimatedMinutes: number;
  exercises: { exerciseId: string; sets: number; reps: string; note?: string }[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  workout?: WorkoutRecommendation;
  exerciseIds?: string[];
  quickActions?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type InsightTone = 'positive' | 'neutral' | 'warning';

export interface CoachInsight {
  id: string;
  title: string;
  body: string;
  tone: InsightTone;
  icon: 'trend' | 'recovery' | 'target' | 'flame' | 'balance' | 'calendar';
}

export type DateRange = '7d' | '30d' | '90d' | 'all';
