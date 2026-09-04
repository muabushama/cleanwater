/** كلمة مرور موحّدة لتأكيد الحذف والإجراءات الحساسة في النظام */
export const DELETE_CONFIRM_PASSWORD = 'MyStrongPass123';

export function promptDeletePassword(): boolean {
  const p = window.prompt('أدخل كلمة مرور الحذف للمتابعة:');
  if (p == null) return false;
  if (p !== DELETE_CONFIRM_PASSWORD) {
    window.alert('كلمة المرور غير صحيحة.');
    return false;
  }
  return true;
}

/** نفس السر؛ لعمليات ليست حذفًا صريحًا (مثل تعديل فاتورة). */
export function promptConfirmPassword(purpose: string): boolean {
  const p = window.prompt(`أدخل كلمة المرور (${purpose}):`);
  if (p == null) return false;
  if (p !== DELETE_CONFIRM_PASSWORD) {
    window.alert('كلمة المرور غير صحيحة.');
    return false;
  }
  return true;
}
