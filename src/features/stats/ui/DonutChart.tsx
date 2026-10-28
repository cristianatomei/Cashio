import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/core/ui';
import type { StatsSegment } from '../domain/analytics';
import { donutArc } from '../domain/charts';

type Props = {
  segments: readonly StatsSegment[];
  size?: number;
  onSelect?: (segment: StatsSegment) => void;
};

export function DonutChart({ segments, size = 176, onSelect }: Props) {
  const { colors } = useTheme();
  const total = segments.reduce((sum, segment) => sum + segment.amountMinor, 0);
  if (total <= 0) return null;

  const center = size / 2;
  const radius = size * 0.36;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = size * 0.18;
  const slices = segments.reduce<{
    offset: number;
    values: { id: string; length: number; offset: number; color: string }[];
  }>(
    (result, segment) => {
      const length = (segment.amountMinor / total) * circumference;
      return {
        offset: result.offset + length,
        values: [
          ...result.values,
          { id: segment.id, length, offset: result.offset, color: segment.color },
        ],
      };
    },
    { offset: 0, values: [] },
  ).values;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={colors.border}
        strokeWidth={strokeWidth}
      />
      {slices.map((slice, index) => (
        <Path
          key={slice.id}
          d={donutArc(
            center,
            center,
            radius,
            (slice.offset / circumference) * 2 * Math.PI,
            ((slice.offset + Math.min(slice.length, circumference - 0.001)) / circumference) *
              2 *
              Math.PI,
          )}
          fill="none"
          stroke={slice.color}
          strokeWidth={strokeWidth}
          onPress={() => onSelect?.(segments[index])}
          accessible={false}
        />
      ))}
    </Svg>
  );
}
