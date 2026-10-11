export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

/** Start of the month that is `delta` months away from the one containing `timestamp`. */
export function addMonths(timestamp: number, delta: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth() + delta, 1).getTime();
}

/** Half-open range [from, to) covering the month that contains `timestamp`. */
export function monthRange(timestamp: number): { from: number; to: number } {
  const from = startOfMonth(timestamp);
  return { from, to: addMonths(from, 1) };
}

/** Takes the calendar day from `datePart` and the clock time from `timePart`. */
export function combineDateAndTime(datePart: number, timePart: number): number {
  const date = new Date(datePart);
  const time = new Date(timePart);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
  ).getTime();
}
