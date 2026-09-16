export type WarrantyDeviceHint = {
  customer_id?: string | null;
  customer_name?: string | null;
  customer_code?: string | null;
  install_date?: string | null;
  warranty_months?: number | null;
  warranty_until?: string | null;
  warranty_end?: string | null;
  warranty_status?: string | null;
};

const toDateOnly = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

export function warrantyEndDate(device?: WarrantyDeviceHint | null): string {
  if (!device) return '';
  const until = toDateOnly(device.warranty_until || device.warranty_end || '');
  if (until) return until;
  const install = toDateOnly(device.install_date || '');
  const months = Number(device.warranty_months);
  if (!install || !Number.isFinite(months) || months <= 0) return '';
  const d = new Date(`${install}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function computeWarrantyStatus(device?: WarrantyDeviceHint | null): 'ساري' | 'منتهي' {
  const end = warrantyEndDate(device);
  if (end) {
    const today = new Date().toISOString().slice(0, 10);
    return end >= today ? 'ساري' : 'منتهي';
  }
  const stored = String(device?.warranty_status || '').trim();
  if (stored === 'منتهي' || stored === 'منتهى') return 'منتهي';
  if (stored === 'ساري') return 'ساري';
  return 'منتهي';
}

export function findCustomerDevice(
  devices: WarrantyDeviceHint[] | undefined,
  customer: { id?: string; name?: string; customer_code?: string },
): WarrantyDeviceHint | undefined {
  const list = Array.isArray(devices) ? devices : [];
  if (customer.id) {
    const byId = list.find((d) => String(d.customer_id || '') === String(customer.id));
    if (byId) return byId;
  }
  const code = String(customer.customer_code || '').trim();
  if (code) {
    const byCode = list.find((d) => String(d.customer_code || '').trim() === code);
    if (byCode) return byCode;
  }
  const name = String(customer.name || '').trim();
  if (name) {
    return list.find((d) => String(d.customer_name || '').trim() === name);
  }
  return undefined;
}

export function resolveWorkOrderWarranty(
  wo: { customer_name?: string; customer_code?: string; warranty_status?: string; warranty_until?: string },
  devices: WarrantyDeviceHint[] | undefined,
  customerId?: string,
): 'ساري' | 'منتهي' {
  const device = findCustomerDevice(devices, {
    id: customerId,
    name: wo.customer_name,
    customer_code: wo.customer_code,
  });
  if (device || wo.warranty_until) {
    return computeWarrantyStatus({
      ...device,
      warranty_until: wo.warranty_until || device?.warranty_until,
    });
  }
  const stored = String(wo.warranty_status || '').trim();
  if (stored === 'منتهي' || stored === 'منتهى') return 'منتهي';
  return computeWarrantyStatus(device);
}
