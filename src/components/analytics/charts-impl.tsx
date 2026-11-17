import { Circle, LinearGradient, useFont, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Area, Bar, CartesianChart, Line, Pie, PolarChart, useChartPressState } from 'victory-native';

import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import type { BarChartProps, DonutChartProps, LineChartProps } from './chart-types';

const FONT = require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf');


function Tooltip({ title, value }: { title: string; value: string }) {
  return (
    <View className="flex-row items-baseline gap-2" style={{ minHeight: 22 }}>
      <Text variant="small" weight="bold">
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {title}
      </Text>
    </View>
  );
}

export function BarChart({ data, height = 180, formatValue = (v) => String(Math.round(v)), highlightIndex, showTooltip = true, emptyLabel }: BarChartProps) {
  const colors = useColors();
  const font = useFont(FONT, 10);
  const { state, isActive } = useChartPressState({ x: 0, y: { value: 0 } });
  const [selected, setSelected] = useState<number | null>(null);

  useAnimatedReaction(
    () => (state.isActive.value ? state.matchedIndex.value : -1),
    (index, prev) => {
      if (index !== prev) scheduleOnRN(setSelected, index >= 0 ? index : null);
    },
  );

  const rows = data.map((d, i) => ({ x: i, value: d.value }));
  const max = Math.max(1, ...data.map((d) => d.value));
  const active = isActive && selected != null ? data[selected] : null;
  const defaultIdx = highlightIndex ?? data.length - 1;
  const fallback = data[defaultIdx];

  return (
    <View>
      {showTooltip ? (
        <Tooltip
          value={active ? formatValue(active.value) : fallback ? formatValue(fallback.value) : '—'}
          title={active ? active.label : (fallback?.caption ?? fallback?.label ?? '')}
        />
      ) : null}
      <View style={{ height }}>
        {data.every((d) => d.value === 0) && emptyLabel ? (
          <View className="absolute inset-0 items-center justify-center">
            <Text variant="caption" tone="muted">
              {emptyLabel}
            </Text>
          </View>
        ) : null}
        <CartesianChart
          data={rows}
          xKey="x"
          yKeys={['value']}
          domain={{ y: [0, max * 1.15] }}
          domainPadding={{ left: 18, right: 18, top: 8 }}
          chartPressState={state}
          xAxis={{
            font,
            labelColor: colors.textMuted,
            lineColor: 'transparent',
            tickCount: data.length,
            formatXLabel: (i) => data[Math.round(i)]?.label ?? '',
          }}
          yAxis={[{ font: null, lineColor: colors.chartTrack, tickCount: 3 }]}
          frame={{ lineWidth: 0 }}>
          {({ points, chartBounds }) =>
            points.value.map((p, i) => {
              const isHighlight = (isActive ? selected : defaultIdx) === i;
              return (
                <Bar
                  key={i}
                  points={[p]}
                  chartBounds={chartBounds}
                  barCount={data.length}
                  innerPadding={0.38}
                  roundedCorners={{ topLeft: 6, topRight: 6, bottomLeft: 2, bottomRight: 2 }}
                  animate={{ type: 'spring', damping: 18, stiffness: 140 }}
                  color={isHighlight ? colors.accent : 'rgba(255,138,54,0.28)'}>
                  {isHighlight ? (
                    <LinearGradient start={vec(0, chartBounds.top)} end={vec(0, chartBounds.bottom)} colors={[colors.accentSoft, colors.accent]} />
                  ) : null}
                </Bar>
              );
            })
          }
        </CartesianChart>
      </View>
    </View>
  );
}

export function LineChart({ data, height = 200, formatValue = (v) => String(Math.round(v)) }: LineChartProps) {
  const colors = useColors();
  const font = useFont(FONT, 10);
  const { state, isActive } = useChartPressState({ x: 0, y: { value: 0 } });
  const [selected, setSelected] = useState<number | null>(null);
  useAnimatedReaction(
    () => (state.isActive.value ? state.matchedIndex.value : -1),
    (index, prev) => {
      if (index !== prev) scheduleOnRN(setSelected, index >= 0 ? index : null);
    },
  );

  const rows = data.map((d, i) => ({ x: i, value: d.value }));
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(2, (max - min) * 0.25);
  const current = isActive && selected != null ? data[selected] : data[data.length - 1];
  const labelEvery = Math.max(1, Math.ceil(data.length / 5));

  return (
    <View>
      <Tooltip value={current ? formatValue(current.value) : '—'} title={current?.label ?? ''} />
      <View style={{ height }}>
        <CartesianChart
          data={rows}
          xKey="x"
          yKeys={['value']}
          domain={{ y: [Math.max(0, min - pad), max + pad] }}
          domainPadding={{ left: 10, right: 10, top: 12, bottom: 4 }}
          chartPressState={state}
          xAxis={{
            font,
            labelColor: colors.textMuted,
            lineColor: 'transparent',
            tickCount: Math.min(data.length, 6),
            formatXLabel: (i) => {
              const idx = Math.round(i);
              return idx % labelEvery === 0 ? (data[idx]?.shortLabel ?? '') : '';
            },
          }}
          yAxis={[{ font, labelColor: colors.textMuted, lineColor: colors.chartTrack, tickCount: 4, formatYLabel: (v) => String(Math.round(Number(v))) }]}
          frame={{ lineWidth: 0 }}>
          {({ points, chartBounds }) => (
            <>
              <Area points={points.value} y0={chartBounds.bottom} curveType="natural" animate={{ type: 'timing', duration: 600 }}>
                <LinearGradient start={vec(0, chartBounds.top)} end={vec(0, chartBounds.bottom)} colors={['rgba(255,138,54,0.35)', 'rgba(255,138,54,0)']} />
              </Area>
              <Line points={points.value} color={colors.accent} strokeWidth={3} curveType="natural" animate={{ type: 'timing', duration: 600 }} />
              {isActive ? (
                <>
                  <Circle cx={state.x.position} cy={state.y.value.position} r={9} color="rgba(255,138,54,0.25)" />
                  <Circle cx={state.x.position} cy={state.y.value.position} r={5} color={colors.accent} />
                </>
              ) : null}
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

export function DonutChart({ data, size = 170, centerLabel, centerValue }: DonutChartProps) {
  const rows = data.map((d) => ({ label: d.label, value: d.value, color: d.color }));
  return (
    <View style={{ width: size, height: size }}>
      <PolarChart data={rows} labelKey="label" valueKey="value" colorKey="color">
        <Pie.Chart innerRadius="68%" startAngle={-90}>
          {({ slice }) => <Pie.Slice key={slice.label} />}
        </Pie.Chart>
      </PolarChart>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {centerValue ? <Text variant="stat">{centerValue}</Text> : null}
        {centerLabel ? (
          <Text variant="caption" tone="muted">
            {centerLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
