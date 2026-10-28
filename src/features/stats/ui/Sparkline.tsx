import Svg, { Polyline } from 'react-native-svg';
import { sparklinePoints } from '../domain/charts';

export function Sparkline({
  values,
  color,
  label,
}: {
  values: readonly number[];
  color: string;
  label: string;
}) {
  return (
    <Svg
      width="100%"
      height={36}
      viewBox="-2 -2 116 36"
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Polyline points={sparklinePoints(values)} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
