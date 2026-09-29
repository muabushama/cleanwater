/** يقبل أرقام فقط وبحد أقصى 11 رقم لأي حقل تليفون في النظام. */
export function sanitizePhoneDigits(value: string, max = 11): string {
  return String(value || '').replace(/\D/g, '').slice(0, max);
}

export function isPhoneFieldName(nameOrLabel: string): boolean {
  return /phone|هاتف|تليفون|موبايل|whatsapp|واتس/i.test(String(nameOrLabel || ''));
}

export function isCompletePhone11(value: string): boolean {
  return sanitizePhoneDigits(value).length === 11;
}
