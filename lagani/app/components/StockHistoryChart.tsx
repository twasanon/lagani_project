import React, { useCallback } from 'react';
import { View } from 'react-native';
import { ApiChartDataPoint } from '../../src/api/nepseScraper';
import { colors } from '../../src/theme/colors';
import NativeLineChart from './NativeLineChart';

interface StockHistoryChartProps {
  data: ApiChartDataPoint[];
  height?: number;
  chartType?: 'line' | 'candlestick';
  lineColor?: string;
  chartBackgroundColor?: string;
  onCrosshairMove?: (point: { time: number; price: number }) => void;
  onInteractionEnd?: () => void;
}

export default function StockHistoryChart({
  data,
  height = 240,
  lineColor = colors.primary,
  chartBackgroundColor = colors.background,
  onCrosshairMove,
  onInteractionEnd,
}: StockHistoryChartProps) {
  const getValue = useCallback((point: ApiChartDataPoint) => point.c, []);
  const getLabel = useCallback((point: ApiChartDataPoint) =>
    new Date(point.t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }), []);
  const handleSelect = useCallback((point: ApiChartDataPoint) => {
    onCrosshairMove?.({ time: point.t, price: point.c });
  }, [onCrosshairMove]);

  return (
    <View style={{ height, width: '100%', backgroundColor: chartBackgroundColor }}>
      <NativeLineChart
        data={data}
        height={height}
        getValue={getValue}
        getLabel={getLabel}
        color={lineColor}
        onSelect={handleSelect}
        onInteractionEnd={onInteractionEnd}
      />
    </View>
  );
}
