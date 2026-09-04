export type PhoneCustomer = { name: string; phone1?: string; phone2?: string; whatsapp?: string };

/** فاصل تخزين عدة أرقام في حقل phone الواحد (أوامر العمل). */
const WO_PHONE_JOIN = ' | ';

/** يدمج حتى ثلاثة حقول هاتف لحفظها في عمود phone. */
export function joinWorkOrderPhoneFields(phone: string, phone2?: string, phone3?: string): string {
  return [phone, phone2, phone3]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(WO_PHONE_JOIN);
}

/** يعيد تقسيم قيمة phone المحفوظة إلى ثلاثة حقول للنموذج. */
export function splitWorkOrderPhoneFields(stored: string): { phone: string; phone2: string; phone3: string } {
  const raw = String(stored || '').trim();
  if (!raw) return { phone: '', phone2: '', phone3: '' };
  const parts = raw.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { phone: parts[0] || '', phone2: parts[1] || '', phone3: parts[2] || '' };
  }
  return { phone: parts[0] || raw, phone2: '', phone3: '' };
}

/** يجمع كل أرقام الهاتف المعروفة لأمر العمل (من الحقل المحفوظ + مطابقة العميل). */
export function workOrderPhonesForPrint(
  wo: { phone?: string; customer_name?: string },
  customers: PhoneCustomer[],
): string {
  const parts: string[] = [];
  const pushUnique = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (t && !parts.some((p) => p === t || p.replace(/\D/g, '') === t.replace(/\D/g, ''))) parts.push(t);
  };

  const raw = String(wo.phone || '').trim();
  if (raw) {
    // أرقام التطبيق تُحفظ مفصولة بـ « | » — نعتمدها أولاً ولا نُقسِّم على الشرطات داخل الرقم (كان يسبب ظهور رقم واحد فقط في الطباعة).
    if (raw.includes('|')) {
      raw.split(/\s*\|\s*/).forEach((x) => {
        const z = x.trim();
        if (z) pushUnique(z);
      });
    } else if (/[،,]/.test(raw)) {
      raw.split(/[،,]+/).forEach((x) => {
        const z = x.trim();
        if (z) pushUnique(z);
      });
    } else {
      pushUnique(raw);
    }
    if (parts.length === 0) pushUnique(raw);
  }

  const nameMatch = customers.find((x) => x.name === wo.customer_name);
  const phoneMatch =
    nameMatch ||
    customers.find((x) => {
      const p1 = (x.phone1 || '').trim();
      const p2 = (x.phone2 || '').trim();
      if (!raw) return false;
      return (p1 && raw.includes(p1)) || (p2 && raw.includes(p2));
    });

  if (phoneMatch) {
    pushUnique(phoneMatch.phone1 || '');
    pushUnique(phoneMatch.phone2 || '');
    pushUnique(phoneMatch.whatsapp || '');
  }

  return parts.filter(Boolean).join(' - ') || raw || '-';
}
