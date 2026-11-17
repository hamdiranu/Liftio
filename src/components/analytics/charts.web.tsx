import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { Skeleton } from '@/components/ui/states';
import type { BarChartProps, DonutChartProps, LineChartProps } from './chart-types';

export type { BarChartProps, BarDatum, DonutChartProps, DonutDatum, LineChartProps, LineDatum } from './chart-types';

// Web: CanvasKit (Skia's WebAssembly build, served from /canvaskit.wasm) must load before any
// chart module is evaluated, so each chart is imported lazily behind WithSkiaWeb.
const opts = { locateFile: (file: string) => `/${file}` };

export function BarChart(props: BarChartProps) {
  return (
    <WithSkiaWeb<BarChartProps>
      opts={opts}
      fallback={<Skeleton height={(props.height ?? 180) + 22} radius={14} />}
      getComponent={() => import('./charts-impl').then((m) => ({ default: m.BarChart }))}
      componentProps={props}
    />
  );
}

export function LineChart(props: LineChartProps) {
  return (
    <WithSkiaWeb<LineChartProps>
      opts={opts}
      fallback={<Skeleton height={(props.height ?? 200) + 22} radius={14} />}
      getComponent={() => import('./charts-impl').then((m) => ({ default: m.LineChart }))}
      componentProps={props}
    />
  );
}

export function DonutChart(props: DonutChartProps) {
  return (
    <WithSkiaWeb<DonutChartProps>
      opts={opts}
      fallback={<Skeleton width={props.size ?? 170} height={props.size ?? 170} radius={999} />}
      getComponent={() => import('./charts-impl').then((m) => ({ default: m.DonutChart }))}
      componentProps={props}
    />
  );
}
