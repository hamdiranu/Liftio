import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Camera, Save } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { toast } from '@/components/ui/overlays';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { MiniStepper } from '@/components/workout/number-stepper';
import { useColors } from '@/constants/theme';
import { useUserId } from '@/features/auth/store';
import { GOAL_LABELS, TRAINING_PREFERENCES, useProfile, useSaveProfile } from '@/features/profile/hooks';
import { WEEKDAY_LABELS, WEEKDAYS } from '@/lib/dates';
import { kgToUnit, roundWeight, unitToKg } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { cn, toErrorMessage } from '@/lib/utils';
import { persistAvatar, pickAvatar } from '@/services/avatar';
import { useSettings } from '@/store/settings';
import type { ExperienceLevel, FitnessGoal, Weekday } from '@/types';

const GOALS = Object.keys(GOAL_LABELS) as FitnessGoal[];

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) >= min && Number(v.replace(',', '.')) <= max), `${label} must be between ${min} and ${max}`);

const makeSchema = (unit: 'kg' | 'lb') =>
  z.object({
    name: z.string().trim().min(2, 'Enter your name').max(50),
    age: optionalNumber(13, 100, 'Age'),
    height: optionalNumber(unit === 'kg' ? 120 : 48, unit === 'kg' ? 230 : 90, 'Height'),
    weight: optionalNumber(unit === 'kg' ? 30 : 66, unit === 'kg' ? 300 : 660, 'Weight'),
    experience: z.enum(['beginner', 'intermediate', 'advanced']),
    goals: z.array(z.enum(GOALS as [FitnessGoal, ...FitnessGoal[]])).min(1, 'Choose at least one goal'),
    preferredDays: z.array(z.enum(WEEKDAYS as [Weekday, ...Weekday[]])).min(1, 'Pick at least one training day'),
    preferredDurationMinutes: z.number().int().min(15).max(180),
    trainingPreferences: z.array(z.string()),
  });
type Values = z.infer<ReturnType<typeof makeSchema>>;

export default function EditProfileScreen() {
  const colors = useColors();
  const userId = useUserId();
  const profile = useProfile();
  const save = useSaveProfile();
  const unit = useSettings((s) => s.unit);
  // undefined = unchanged (show the saved photo); a string = newly picked photo.
  const [pickedAvatar, setAvatar] = useState<string | undefined>(undefined);
  const avatar = pickedAvatar ?? profile.data?.avatarUri ?? null;
  const [uploading, setUploading] = useState(false);

  const { control, handleSubmit, reset, formState } = useForm<Values>({
    resolver: zodResolver(makeSchema(unit)),
    defaultValues: { name: '', age: '', height: '', weight: '', experience: 'intermediate', goals: [], preferredDays: [], preferredDurationMinutes: 60, trainingPreferences: [] },
  });

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    reset({
      name: p.name,
      age: p.age ? String(p.age) : '',
      height: p.heightCm ? String(Math.round(unit === 'kg' ? p.heightCm : p.heightCm / 2.54)) : '',
      weight: p.weightKg ? String(roundWeight(kgToUnit(p.weightKg, unit), unit)) : '',
      experience: p.experience,
      goals: p.goals,
      preferredDays: p.preferredDays,
      preferredDurationMinutes: p.preferredDurationMinutes,
      trainingPreferences: p.trainingPreferences,
    });
  }, [profile.data, reset, unit]);

  const onSubmit = handleSubmit(async (v) => {
    if (!profile.data) return;
    const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
    const height = num(v.height);
    const weight = num(v.weight);
    try {
      let avatarUri = avatar;
      if (avatar && avatar !== profile.data.avatarUri && !avatar.startsWith('http')) {
        setUploading(true);
        avatarUri = await persistAvatar(userId, avatar);
      }
      await save.mutateAsync({
        ...profile.data,
        name: v.name.trim(),
        avatarUri,
        age: num(v.age),
        heightCm: height == null ? null : unit === 'kg' ? height : height * 2.54,
        weightKg: weight == null ? null : unitToKg(weight, unit),
        experience: v.experience as ExperienceLevel,
        goals: v.goals,
        preferredDays: WEEKDAYS.filter((d) => v.preferredDays.includes(d)),
        preferredDurationMinutes: v.preferredDurationMinutes,
        trainingPreferences: v.trainingPreferences,
      });
      toast('Profile saved');
      goBack('/profile');
    } catch (e) {
      toast(toErrorMessage(e), 'error');
    } finally {
      setUploading(false);
    }
  });

  if (!profile.data) {
    return (
      <Screen header={<ScreenHeader title="Edit profile" back="close" />}>
        <SkeletonCard lines={6} />
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={<ScreenHeader title="Edit profile" back="close" />}
      footer={
        <View className="px-5 pt-3">
          <Button label="Save profile" icon={Save} size="lg" fullWidth loading={formState.isSubmitting || uploading} onPress={onSubmit} />
        </View>
      }>
      <View className="gap-6 pb-6">
        <View className="items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={async () => {
              try {
                const uri = await pickAvatar();
                if (uri) setAvatar(uri);
              } catch (e) {
                toast(toErrorMessage(e), 'error');
              }
            }}>
            <Avatar name={profile.data.name} uri={avatar} size={96} />
            <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-accent">
              <Camera size={16} color={colors.accentInk} />
            </View>
          </Pressable>
        </View>

        <Controller control={control} name="name" render={({ field, fieldState }) => <Input label="Name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} autoComplete="name" />} />
        <View className="flex-row gap-3">
          <Controller control={control} name="age" render={({ field, fieldState }) => <Input containerClassName="flex-1" label="Age" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} keyboardType="number-pad" maxLength={3} />} />
          <Controller control={control} name="height" render={({ field, fieldState }) => <Input containerClassName="flex-1" label="Height" suffix={unit === 'kg' ? 'cm' : 'in'} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} keyboardType="decimal-pad" maxLength={5} />} />
          <Controller control={control} name="weight" render={({ field, fieldState }) => <Input containerClassName="flex-1" label="Weight" suffix={unit} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} keyboardType="decimal-pad" maxLength={5} />} />
        </View>

        <Controller
          control={control}
          name="experience"
          render={({ field }) => (
            <Section title="Fitness experience">
              <SegmentedControl
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </Section>
          )}
        />

        <Controller
          control={control}
          name="goals"
          render={({ field, fieldState }) => (
            <Section title="Goals" hint="Your first pick is the primary goal." error={fieldState.error?.message}>
              <View className="flex-row flex-wrap gap-2">
                {GOALS.map((g) => {
                  const idx = field.value.indexOf(g);
                  return (
                    <Chip
                      key={g}
                      label={idx === 0 ? `${GOAL_LABELS[g]} · primary` : GOAL_LABELS[g]}
                      selected={idx >= 0}
                      onPress={() => field.onChange(idx >= 0 ? field.value.filter((x) => x !== g) : [...field.value, g])}
                    />
                  );
                })}
              </View>
            </Section>
          )}
        />

        <Controller
          control={control}
          name="preferredDays"
          render={({ field, fieldState }) => (
            <Section title="Preferred training days" error={fieldState.error?.message}>
              <View className="flex-row justify-between">
                {WEEKDAYS.map((d) => {
                  const on = field.value.includes(d);
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={WEEKDAY_LABELS[d]}
                      onPress={() => field.onChange(on ? field.value.filter((x) => x !== d) : [...field.value, d])}
                      className={cn('h-11 w-11 items-center justify-center rounded-full border', on ? 'border-accent bg-accent' : 'border-line-strong bg-card')}>
                      <Text variant="caption" weight="bold" style={{ color: on ? colors.accentInk : colors.textSecondary }}>
                        {WEEKDAY_LABELS[d].slice(0, 2)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>
          )}
        />

        <Controller
          control={control}
          name="preferredDurationMinutes"
          render={({ field }) => (
            <View className="flex-row items-center justify-between rounded-lg border border-line bg-card px-4 py-3">
              <Text variant="body" weight="medium">
                Preferred workout duration
              </Text>
              <MiniStepper value={field.value} onChange={field.onChange} step={5} min={15} max={180} format={(v) => `${v}m`} />
            </View>
          )}
        />

        <Controller
          control={control}
          name="trainingPreferences"
          render={({ field }) => (
            <Section title="Training preferences">
              <View className="flex-row flex-wrap gap-2">
                {TRAINING_PREFERENCES.map((t) => (
                  <Chip key={t} size="sm" label={t} selected={field.value.includes(t)} onPress={() => field.onChange(field.value.includes(t) ? field.value.filter((x) => x !== t) : [...field.value, t])} />
                ))}
              </View>
            </Section>
          )}
        />
      </View>
    </Screen>
  );
}

function Section({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <View className="gap-2.5">
      <Text variant="caption" tone="secondary">
        {title}
      </Text>
      {children}
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
