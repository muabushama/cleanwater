/**
 * مبالغ الفاتورة: لا نستخدم أرقام سالبة في الواجهة أو التخزين.
 * - المتبقي على العميل = max(0, الإجمالي - المدفوع)
 * - رصيد للعميل (دفعة زائدة) = max(0, المدفوع - الإجمالي)
 */
export function invoiceDebtRemaining(amount: unknown, paid: unknown): number {
  const a = Number(amount) || 0;
  const p = Number(paid) || 0;
  return Math.max(0, Math.round((a - p) * 100) / 100);
}

export function invoiceCustomerCredit(amount: unknown, paid: unknown): number {
  const a = Number(amount) || 0;
  const p = Number(paid) || 0;
  return Math.max(0, Math.round((p - a) * 100) / 100);
}
