const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** تطبيع نص البحث: حروف عربية متشابهة + أرقام + حذف المسافات والرموز. */
export function normalizeSearchText(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EASTERN_INDIC.indexOf(d)))
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** بحث مرن: لا يشترط نفس المسافات، ويكفي ظهور كل كلمة داخل النص. */
export function matchesLooseSearch(haystack: string, query: string): boolean {
  const q = String(query || '').trim();
  if (!q) return true;
  const compactHay = normalizeSearchText(haystack);
  const compactQ = normalizeSearchText(q);
  if (compactQ && compactHay.includes(compactQ)) return true;
  const tokens = q
    .split(/\s+/)
    .map((t) => normalizeSearchText(t))
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((tok) => compactHay.includes(tok));
}

export function matchesAnyLooseSearch(fields: Array<string | number | null | undefined>, query: string): boolean {
  return matchesLooseSearch(fields.map((f) => String(f ?? '')).join(' '), query);
}
