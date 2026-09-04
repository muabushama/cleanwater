/** موقع التخزين الفرعي داخل الفرع (مخزن رئيسي / معرض) */
export const STORAGE_MAIN = 'المخزن الرئيسي';
export const STORAGE_SHOWROOM = 'المعرض';

export const STORAGE_LOCATION_OPTIONS = [
  { value: STORAGE_MAIN, label: 'المخزن الرئيسي' },
  { value: STORAGE_SHOWROOM, label: 'المعرض' },
] as const;

export function normalizeStorageLocation(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (s === STORAGE_SHOWROOM) return STORAGE_SHOWROOM;
  return STORAGE_MAIN;
}
