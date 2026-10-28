export function dateInput(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** A manual date includes rates through that day, but never through the future. */
export function valuationDate(value: string, now: number): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (dateInput(date.getTime()) !== value || date.getTime() > now) return null;
  date.setHours(23, 59, 59, 999);
  return Math.min(date.getTime(), now);
}
