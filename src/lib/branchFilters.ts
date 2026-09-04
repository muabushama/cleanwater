/** أسماء الفروع المعتمدة في الواجهة */
export const BRANCH_ALEX = 'فرع الإسكندرية';
export const BRANCH_GIZA = 'فرع الجيزة';

/**
 * قيم قد تكون مخزّنة في قاعدة البيانات لنفس الفرع (استيراد، هوستنغ، أخطاء إدخال).
 * الاستعلام بـ IN يعيد ظهور العملاء/المناطق/الفواتير دون اعتبارها «محذوفة».
 */
const ALEX_VARIANTS = [
  BRANCH_ALEX,
  'main',
  'الإسكندرية',
  'اسكندرية',
  'اسكندريه',
  'Alexandria',
  'alex',
];

const GIZA_VARIANTS = [
  BRANCH_GIZA,
  'الجيزة',
  'جيزة',
  'القاهرة',
  'قاهرة',
  'Giza',
  'Cairo',
  'giza',
  'cairo',
];

function isGizaUiBranch(b: string): boolean {
  const t = b.trim();
  return t === '2' || t === BRANCH_GIZA || GIZA_VARIANTS.includes(t);
}

/** قائمة قيم عمود `branch` للاستعلام (SELECT) حسب الفرع المعروض في التطبيق */
export function branchDbValuesForUiBranch(uiBranch: string | undefined): string[] {
  const b = (uiBranch || BRANCH_ALEX).trim();
  if (isGizaUiBranch(b)) {
    return [...new Set([...GIZA_VARIANTS, BRANCH_GIZA])];
  }
  return [...new Set([...ALEX_VARIANTS, BRANCH_ALEX])];
}

/** قيمة واحدة للحفظ في DB (إدراج/تحديث) */
export function canonicalBranchForSave(uiBranch: string | undefined): string {
  const b = (uiBranch || BRANCH_ALEX).trim();
  return isGizaUiBranch(b) ? BRANCH_GIZA : BRANCH_ALEX;
}
