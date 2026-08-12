import React, { useCallback } from 'react';
import NativeLineChart from './NativeLineChart';

interface PortfolioPoint {
  time: string;
  value: number;
}

interface PortfolioChartProps {
  data: PortfolioPoint[];
  height?: number;
  onValueSelect?: (value: number, time: string) => void;
}

export default function PortfolioChart({ data, height = 200, onValueSelect }: PortfolioChartProps) {
  const getValue = useCallback((point: PortfolioPoint) => point.value, []);
  const getLabel = useCallback((point: PortfolioPoint) =>
    new Date(point.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), []);
  const handleSelect = useCallback((point: PortfolioPoint) => {
    onValueSelect?.(point.value, point.time);
  }, [onValueSelect]);
  const handleEnd = useCallback(() => {
    const latest = data[data.length - 1];
    if (latest) onValueSelect?.(latest.value, latest.time);
  }, [data, onValueSelect]);

  return (
    <NativeLineChart
      data={data}
      height={height}
      getValue={getValue}
      getLabel={getLabel}
      color="#16a34a"
      fillColor="#22c55e"
      showScale={false}
      onSelect={handleSelect}
      onInteractionEnd={handleEnd}
    />
  );
}
