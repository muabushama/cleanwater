export type MaintenanceIntervalDevice = {
  contract_installment_interval_months?: number | string | null;
  candles?: Array<{ duration_months?: number }> | null;
};

/** فترة الصيانة بالشهور — من العقد أو الشمعات أو افتراضي شهرين */
export function getMaintenanceIntervalMonths(device?: MaintenanceIntervalDevice | null): number {
  const contractInterval = Number(device?.contract_installment_interval_months);
  if (Number.isFinite(contractInterval) && contractInterval > 0) {
    return Math.max(1, Math.round(contractInterval));
  }
  const candles = Array.isArray(device?.candles) ? device.candles : [];
  const candleMonths = candles
    .map((c) => Number(c.duration_months))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (candleMonths.length > 0) {
    return Math.max(1, Math.min(...candleMonths));
  }
  return 2;
}

export function addMonthsToDate(baseDate: string | Date, months: number): Date {
  const d = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);
  if (Number.isNaN(d.getTime())) return new Date();
  d.setMonth(d.getMonth() + Math.max(1, months));
  return d;
}

export function getNextMaintenanceDateStr(
  device?: MaintenanceIntervalDevice | null,
  baseDate?: string,
): string {
  const interval = getMaintenanceIntervalMonths(device);
  return addMonthsToDate(baseDate || new Date().toISOString().slice(0, 10), interval)
    .toISOString()
    .slice(0, 10);
}

export function getNextMaintenanceDate(
  device?: MaintenanceIntervalDevice | null,
  baseDate?: string,
): Date | null {
  const base = baseDate ? new Date(baseDate) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  return addMonthsToDate(base, getMaintenanceIntervalMonths(device));
}

export function maintenanceVisitStatus(nextDateStr: string): 'upcoming' | 'overdue' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(nextDateStr);
  next.setHours(0, 0, 0, 0);
  return next < today ? 'overdue' : 'upcoming';
}

export function hasFutureMaintenanceVisit(
  records: Array<{ customer_name?: string; next_date?: string; status?: string }>,
  customerName: string,
  onOrAfterDateStr: string,
): boolean {
  const onOrAfter = new Date(onOrAfterDateStr).getTime();
  if (!Number.isFinite(onOrAfter)) return false;
  return records.some((m) => {
    if ((m.customer_name || '').trim() !== customerName.trim()) return false;
    if (String(m.status || '').toLowerCase() === 'completed') return false;
    const nd = new Date(m.next_date || '').getTime();
    return Number.isFinite(nd) && nd >= onOrAfter;
  });
}
