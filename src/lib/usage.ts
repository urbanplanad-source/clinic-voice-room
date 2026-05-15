export function secondsBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

export function addDuration(current: number | null | undefined, deltaSeconds: number) {
  return Math.max(0, (current ?? 0) + Math.max(0, Math.round(deltaSeconds)));
}
