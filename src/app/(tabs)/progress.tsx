import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { BarChart, DonutChart, LineChart } from '@/components/analytics/charts';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Activity, CalendarDays, ChartLine, ChevronRight, Clock, Layers, Trophy, Weight } from '@/components/ui/icons';
import { Badge, Overline, SectionHeader, StatTile } from '@/components/ui/misc';
import { FadeIn } from '@/components/ui/overlays';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { EmptyState, ErrorState, Skeleton, SkeletonCard } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useColors, muscleGroupColors } from '@/constants/theme';
import { EXERCISE_BY_ID } from '@/features/exercises/catalog';
import {
  changeVsPrevious,
  chartableExercises,
  monthlyActivity,
  muscleDistribution,
  overview,
  strengthProgression,
  volumeBuckets,
} from '@/features/progress/analytics';
import { usePersonalRecords, useWorkoutHistory } from '@/features/workouts/hooks';
import { workoutVolume } from '@/features/workouts/stats';
import { formatShortDate, rangeStart } from '@/lib/dates';
import { formatCompact, formatMinutes, formatNumber, formatWeight, kgToUnit } from '@/lib/format';
import { useSettings } from '@/store/settings';
import type { DateRange } from '@/types';

const RANGES: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

export default function ProgressScreen() {
  const colors = useColors();
  const [range, setRange] = useState<DateRange>('30d');
  const history = useWorkoutHistory();
  const records = usePersonalRecords();
  const unit = useSettings((s) => s.unit);
  const [exerciseId, setExerciseId] = useState<string | null>(null);

  const data = useMemo(() => {
    const all = history.data ?? [];
    const start = rangeStart(range);
    const workouts = start ? all.filter((w) => new Date(w.startedAt) >= start) : all;
    const ov = overview(workouts);
    const buckets = volumeBuckets(workouts, range);
    const chartable = chartableExercises(workouts.length ? workouts : all);
    return {
      all,
      workouts,
      ov,
      buckets,
      chartable,
      muscles: muscleDistribution(workouts, muscleGroupColors),
      months: monthlyActivity(all, 6),
      delta: {
        workouts: changeVsPrevious(all, range, (ws) => ws.length),
        volume: changeVsPrevious(all, range, (ws) => ws.reduce((a, w) => a + workoutVolume(w), 0)),
        duration: changeVsPrevious(all, range, (ws) => (ws.length ? ws.reduce((a, w) => a + w.durationSeconds, 0) / ws.length : 0)),
        sets: changeVsPrevious(all, range, (ws) => overview(ws).totalSets),
      },
    };
  }, [history.data, range]);

  const selectedExercise = exerciseId && data.chartable.includes(exerciseId) ? exerciseId : data.chartable[0];
  const strength = useMemo(() => {
    if (!selectedExercise) return [];
    const source = range === 'all' ? data.all : data.workouts.length >= 2 ? data.workouts : data.all;
    return strengthProgression(source, selectedExercise).map((p) => ({
      label: `${formatShortDate(p.date)} · top set ${formatWeight(p.topWeight, unit)}`,
      shortLabel: new Date(p.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      value: kgToUnit(p.e1rm, unit),
    }));
  }, [selectedExercise, data.all, data.workouts, range, unit]);

  const topRecords = useMemo(
    () => (records.data ?? []).filter((r) => r.type === 'estimated_1rm').sort((a, b) => b.value - a.value).slice(0, 6),
    [records.data],
  );
  const totalSets = data.muscles.reduce((a, m) => a + m.sets, 0);

  return (
    <Screen tabBar refreshing={history.isRefetching} onRefresh={() => history.refetch()}>
      <View className="pb-4 pt-2">
        <Overline>Your training</Overline>
        <Text variant="title" style={{ marginTop: 4 }}>
          Progress overview
        </Text>
      </View>
      <SegmentedControl options={RANGES} value={range} onChange={setRange} />

      {history.error ? (
        <View className="mt-5">
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        </View>
      ) : history.isLoading ? (
        <View className="mt-5 gap-3">
          <SkeletonCard lines={3} />
          <Skeleton height={220} radius={18} />
        </View>
      ) : data.all.length === 0 ? (
        <View className="mt-5">
          <EmptyState icon={ChartLine} title="Nothing to chart yet" body="Finish a workout and your volume, strength and records will show up here." actionLabel="Start training" onAction={() => router.push('/train')} />
        </View>
      ) : (
        <View className="mt-5 gap-5">
          <FadeIn>
            <View className="gap-3">
              <View className="flex-row gap-3">
                <StatTile label="Workouts" value={formatNumber(data.ov.workouts)} icon={CalendarDays} delta={data.delta.workouts} />
                <StatTile label="Volume" value={formatCompact(Math.round(kgToUnit(data.ov.volumeKg, unit)))} unit={unit} icon={Weight} delta={data.delta.volume} />
              </View>
              <View className="flex-row gap-3">
                <StatTile label="Avg duration" value={formatMinutes(data.ov.avgDurationSeconds)} icon={Clock} delta={data.delta.duration} />
                <StatTile label="Total sets" value={formatNumber(data.ov.totalSets)} icon={Layers} delta={data.delta.sets} />
              </View>
            </View>
          </FadeIn>

          <Card>
            <Text variant="subheading">{range === '7d' ? 'Daily training volume' : 'Weekly training volume'}</Text>
            <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
              Press and drag across the bars to inspect
            </Text>
            <BarChart
              data={data.buckets.map((b) => ({ label: b.label, value: kgToUnit(b.volume, unit), caption: range === '7d' ? 'today' : 'this week' }))}
              height={190}
              formatValue={(v) => `${formatNumber(Math.round(v))} ${unit}`}
              emptyLabel="No volume logged in this range"
            />
          </Card>

          <Card>
            <View className="flex-row items-center justify-between">
              <View>
                <Text variant="subheading">Strength progression</Text>
                <Text variant="caption" tone="muted">
                  Estimated 1RM per session ({unit})
                </Text>
              </View>
              <Badge label="e1RM" icon={Activity} tone="neutral" />
            </View>
            {data.chartable.length ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
                  {data.chartable.slice(0, 8).map((id) => (
                    <Chip key={id} size="sm" label={EXERCISE_BY_ID[id]?.name ?? id} selected={id === selectedExercise} onPress={() => setExerciseId(id)} />
                  ))}
                </ScrollView>
                {strength.length >= 2 ? (
                  <LineChart data={strength} height={200} formatValue={(v) => `${formatNumber(v, 1)} ${unit}`} />
                ) : (
                  <Text variant="small" tone="muted" style={{ paddingVertical: 24 }} align="center">
                    Log this exercise twice to see a trend.
                  </Text>
                )}
              </>
            ) : (
              <Text variant="small" tone="muted" style={{ paddingVertical: 24 }} align="center">
                Log a weighted exercise at least twice to see progression.
              </Text>
            )}
          </Card>

          <Card>
            <Text variant="subheading">Muscle group distribution</Text>
            <Text variant="caption" tone="muted" style={{ marginBottom: 12 }}>
              Share of completed sets
            </Text>
            {data.muscles.length ? (
              <View className="flex-row items-center gap-5">
                <DonutChart data={data.muscles.map((m) => ({ label: m.label, value: m.sets, color: m.color }))} size={150} centerValue={formatNumber(totalSets)} centerLabel="sets" />
                <View className="flex-1 gap-2.5">
                  {data.muscles.map((m) => (
                    <View key={m.group} className="flex-row items-center gap-2">
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: m.color }} />
                      <Text variant="small" style={{ flex: 1 }}>
                        {m.label}
                      </Text>
                      <Text variant="small" weight="semibold">
                        {Math.round(m.percent)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text variant="small" tone="muted" align="center" style={{ paddingVertical: 16 }}>
                No sets in this range.
              </Text>
            )}
          </Card>

          <Card>
            <Text variant="subheading">Workout frequency</Text>
            <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
              {range === '7d' ? 'Sessions per day' : 'Sessions per week'}
            </Text>
            <BarChart
              data={data.buckets.map((b) => ({ label: b.label, value: b.workouts, caption: range === '7d' ? 'today' : 'this week' }))}
              height={150}
              formatValue={(v) => `${Math.round(v)} session${Math.round(v) === 1 ? '' : 's'}`}
            />
          </Card>

          <Card>
            <Text variant="subheading">Monthly activity</Text>
            <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
              Workouts per month
            </Text>
            <BarChart data={data.months.map((m) => ({ label: m.label, value: m.workouts, caption: 'this month' }))} height={150} formatValue={(v) => `${Math.round(v)} workouts`} />
          </Card>

          <View>
            <SectionHeader title="Personal records" actionLabel="History" onAction={() => router.push('/workout/history')} />
            {topRecords.length ? (
              <View className="gap-2">
                {topRecords.map((r, i) => (
                  <PressableScale key={r.id} onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: r.exerciseId } })} scaleTo={0.98} accessibilityLabel={`${EXERCISE_BY_ID[r.exerciseId]?.name} record`}>
                    <View className="flex-row items-center gap-3 rounded-lg border border-line bg-card p-3.5">
                      <View className={`h-9 w-9 items-center justify-center rounded-full ${i === 0 ? 'bg-accent' : 'bg-accent/15'}`}>
                        <Trophy size={16} color={i === 0 ? colors.accentInk : colors.accent} />
                      </View>
                      <View className="flex-1">
                        <Text variant="body" weight="semibold" numberOfLines={1}>
                          {EXERCISE_BY_ID[r.exerciseId]?.name ?? r.exerciseId}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {formatShortDate(r.achievedAt)} · e1RM
                        </Text>
                      </View>
                      <Text variant="subheading" weight="bold" tone="accent">
                        {formatWeight(r.value, unit)}
                      </Text>
                      <ChevronRight size={16} color={colors.textMuted} />
                    </View>
                  </PressableScale>
                ))}
              </View>
            ) : (
              <EmptyState icon={Trophy} title="No records yet" body="Your heaviest lifts will be tracked automatically." compact />
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}
