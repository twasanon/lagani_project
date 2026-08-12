import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

interface NativeLineChartProps<T> {
  data: T[];
  height: number;
  getValue: (item: T) => number;
  getLabel: (item: T) => string;
  color: string;
  fillColor?: string;
  showScale?: boolean;
  onSelect?: (item: T) => void;
  onInteractionEnd?: () => void;
}

const HORIZONTAL_PADDING = 12;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 24;

export default function NativeLineChart<T>({
  data,
  height,
  getValue,
  getLabel,
  color,
  fillColor = color,
  showScale = true,
  onSelect,
  onInteractionEnd,
}: NativeLineChartProps<T>) {
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const values = useMemo(() => data.map(getValue), [data, getValue]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const spread = max - min || Math.max(Math.abs(max) * 0.01, 1);
  const chartHeight = height - TOP_PADDING - BOTTOM_PADDING;
  const chartWidth = Math.max(0, width - HORIZONTAL_PADDING * 2);

  const xForIndex = (index: number): number =>
    HORIZONTAL_PADDING + (data.length <= 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
  const yForValue = (value: number): number =>
    TOP_PADDING + ((max - value) / spread) * chartHeight;

  const linePath = useMemo(() => {
    if (width === 0 || data.length === 0) return '';
    return data.map((item, index) => {
      const x = xForIndex(index);
      const y = yForValue(getValue(item));
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [data, getValue, width, max, spread, chartHeight, chartWidth]);

  const areaPath = linePath
    ? `${linePath} L ${xForIndex(data.length - 1)} ${height - BOTTOM_PADDING} L ${xForIndex(0)} ${height - BOTTOM_PADDING} Z`
    : '';

  const selectAtX = (x: number) => {
    if (dataRef.current.length === 0 || chartWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, (x - HORIZONTAL_PADDING) / chartWidth));
    const index = Math.round(ratio * (dataRef.current.length - 1));
    setSelectedIndex(index);
    onSelect?.(dataRef.current[index]);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(onSelect),
    onMoveShouldSetPanResponder: () => Boolean(onSelect),
    onPanResponderGrant: (event) => selectAtX(event.nativeEvent.locationX),
    onPanResponderMove: (event) => selectAtX(event.nativeEvent.locationX),
    onPanResponderRelease: () => {
      setSelectedIndex(null);
      onInteractionEnd?.();
    },
    onPanResponderTerminate: () => {
      setSelectedIndex(null);
      onInteractionEnd?.();
    },
  }), [chartWidth, onSelect, onInteractionEnd]);

  const selected = selectedIndex === null ? null : data[selectedIndex];
  const selectedX = selectedIndex === null ? 0 : xForIndex(selectedIndex);
  const selectedY = selected ? yForValue(getValue(selected)) : 0;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Price chart with ${data.length} points`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
      {...panResponder.panHandlers}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={fillColor} stopOpacity={0.24} />
              <Stop offset="1" stopColor={fillColor} stopOpacity={0.01} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((ratio) => {
            const y = TOP_PADDING + ratio * chartHeight;
            return <Line key={ratio} x1={HORIZONTAL_PADDING} x2={width - HORIZONTAL_PADDING} y1={y} y2={y} stroke="#e4e4e7" strokeWidth={1} />;
          })}
          {areaPath ? <Path d={areaPath} fill="url(#chartFill)" /> : null}
          {linePath ? <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {showScale && data.length > 0 ? (
            <>
              <SvgText x={HORIZONTAL_PADDING} y={12} fill="#71717a" fontSize={10}>{max.toFixed(2)}</SvgText>
              <SvgText x={HORIZONTAL_PADDING} y={height - 7} fill="#71717a" fontSize={10}>{getLabel(data[0])}</SvgText>
              <SvgText x={width - HORIZONTAL_PADDING} y={height - 7} fill="#71717a" fontSize={10} textAnchor="end">{getLabel(data[data.length - 1])}</SvgText>
            </>
          ) : null}
          {selected ? (
            <>
              <Line x1={selectedX} x2={selectedX} y1={TOP_PADDING} y2={height - BOTTOM_PADDING} stroke="#71717a" strokeDasharray="4 4" />
              <Circle cx={selectedX} cy={selectedY} r={5} fill="#fff" stroke={color} strokeWidth={2.5} />
            </>
          ) : null}
        </Svg>
      )}
    </View>
  );
}
