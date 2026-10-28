import type { StatsRange } from './analytics';
import { localDate } from './report';

export function sparklinePoints(values: readonly number[], width = 112, height = 32): string {
  if (!values.length) return '';
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = max === min ? height / 2 : height - ((value - min) / (max - min)) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export function donutArc(cx: number, cy: number, radius: number, start: number, end: number) {
  const point = (angle: number) => [
    cx + radius * Math.cos(angle - Math.PI / 2),
    cy + radius * Math.sin(angle - Math.PI / 2),
  ];
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
}
export function drilldownParams(
  breakdown: 'groups' | 'categories',
  id: string,
  range: StatsRange,
  currency: string,
  baseCurrency = 'RON',
) {
  return {
    groupId: breakdown === 'groups' ? id : '',
    categoryId: breakdown === 'categories' ? id : '',
    from: localDate(range.from),
    to: localDate(range.to - 1),
    type: 'expense',
    currency: currency === baseCurrency ? '' : currency,
  };
}
