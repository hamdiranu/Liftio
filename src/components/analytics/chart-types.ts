export interface BarDatum {
  label: string;
  value: number;
  /** Shown in the tooltip when nothing is pressed. */
  caption?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  formatValue?: (value: number) => string;
  highlightIndex?: number;
  showTooltip?: boolean;
  emptyLabel?: string;
}

export interface LineDatum {
  label: string;
  shortLabel: string;
  value: number;
}

export interface LineChartProps {
  data: LineDatum[];
  height?: number;
  formatValue?: (value: number) => string;
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}
