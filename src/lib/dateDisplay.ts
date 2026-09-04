/** عرض التاريخ بصيغة يوم / شهر / سنة (من ISO yyyy-mm-dd أو من كائن Date). */
export function formatDateDayMonthYear(v?: string | Date | null): string {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '—';
    return `${v.getDate()}/${v.getMonth() + 1}/${v.getFullYear()}`;
  }
  const raw = String(v ?? '').trim();
  if (!raw) return '—';
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const day = Number(m[3]);
    const month = Number(m[2]);
    return `${day}/${month}/${m[1]}`;
  }
  return raw;
}
