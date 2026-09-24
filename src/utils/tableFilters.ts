export function isWithinDateRange(value: string | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!value) return false;

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;

  if (from) {
    const start = Date.parse(`${from}T00:00:00`);
    if (Number.isFinite(start) && timestamp < start) return false;
  }
  if (to) {
    const end = Date.parse(`${to}T23:59:59.999`);
    if (Number.isFinite(end) && timestamp > end) return false;
  }
  return true;
}

export function compareText(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' });
}

export function compareDate(a: string | undefined, b: string | undefined): number {
  const left = a ? Date.parse(a) : Number.NaN;
  const right = b ? Date.parse(b) : Number.NaN;
  if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
  if (!Number.isFinite(left)) return 1;
  if (!Number.isFinite(right)) return -1;
  return left - right;
}
