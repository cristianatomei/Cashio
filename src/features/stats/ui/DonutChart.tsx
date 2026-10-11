import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/core/ui';
import type { StatsSegment } from '../domain/analytics';

type Props = { segments: readonly StatsSegment[]; size?: number };

export function DonutChart({ segments, size = 176 }: Props) {
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
      {slices.map((slice) => (
        <Circle
          key={slice.id}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={slice.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${slice.length} ${circumference}`}
          strokeDashoffset={-slice.offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      ))}
    </Svg>
  );
}
