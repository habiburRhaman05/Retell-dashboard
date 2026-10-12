export function monthlyPeriodStart(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function periodKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
