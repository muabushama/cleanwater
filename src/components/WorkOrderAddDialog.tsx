import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { joinWorkOrderPhoneFields } from '@/lib/workOrderPrintPhones';
import { ProductSearchCombobox } from '@/components/inventory/ProductSearchCombobox';
import { matchesLooseSearch, matchesAnyLooseSearch } from '@/lib/searchText';
import { computeWarrantyStatus, findCustomerDevice, type WarrantyDeviceHint } from '@/lib/warrantyStatus';

export interface CustomerForSuggest {
  id: string;
  name: string;
  phone1: string;
  phone2?: string;
  whatsapp?: string;
  address: string;
  region?: string;
  area_id?: string | null;
  customer_code?: string | null;
}

export interface ProductForSuggest {
  id: string;
  name: string;
  price1: number;
  price2: number;
  price3: number;
  stock?: number;
  sku_code?: string | null;
  barcode?: string | null;
}

interface WorkOrderAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: { id: string; full_name: string }[];
  branch: string;
  areas: { id: string; name: string }[];
  customers: CustomerForSuggest[];
  products: ProductForSuggest[];
  customerDevices?: WarrantyDeviceHint[];
  initialCustomer?: CustomerForSuggest | null;
  nextOrderCode?: string;
  initialValues?: Record<string, string>;
  title?: string;
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  loading?: boolean;
}

const defaultForm: Record<string, string> = {
  order_code: '',
  customer_name: '',
  phone: '',
  phone2: '',
  phone3: '',
  address: '',
  location_url: '',
  region: '',
  area_id: 'none',
  product_name: '',
  transport_cost: '0',
  product_lines: '[]',
  extra_products: '',
  assigned_rep: 'none',
  visit_date: '',
  maintenance_dates: '',
  technician: '',
  warranty_status: '',
  status: 'pending',
  branch: 'فرع الإسكندرية',
  notes: '',
};

export function WorkOrderAddDialog({
  open,
  onOpenChange,
  reps,
  branch,
  areas,
  customers,
  products,
  customerDevices = [],
  initialCustomer,
  nextOrderCode,
  initialValues,
  title,
  submitLabel,
  onSubmit,
  loading,
}: WorkOrderAddDialogProps) {
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm, branch });
  const [customerDropdown, setCustomerDropdown] = useState(false);
  const [productLines, setProductLines] = useState<Array<{ product_id: string; product_name: string; quantity: string; unit_price: string }>>([
    { product_id: '', product_name: '', quantity: '1', unit_price: '0' },
  ]);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const customerSearch = (form.customer_name || '').trim();
  const suggestedCustomers = customerSearch.length < 1 ? [] : customers.filter(
    (c) => matchesAnyLooseSearch([c.name, c.phone1, c.phone2, c.whatsapp, c.customer_code, c.address, c.region], customerSearch),
  ).slice(0, 12);

  const areaNameById = (areaId?: string | null) => {
    if (!areaId || areaId === 'none') return '';
    return areas.find((a) => a.id === areaId)?.name || '';
  };

  const applyCustomerFields = (c: CustomerForSuggest, prev: Record<string, string> = form) => {
    const device = findCustomerDevice(customerDevices, { id: c.id, name: c.name, customer_code: c.customer_code || '' });
    const region = (c.region || '').trim() || areaNameById(c.area_id);
    return {
      ...prev,
      customer_name: c.name,
      phone: String(c.phone1 || '').trim(),
      phone2: String(c.phone2 || '').trim(),
      phone3: String(c.whatsapp || '').trim(),
      address: c.address || '',
      region,
      area_id: (c.area_id && c.area_id !== '') ? c.area_id : 'none',
      order_code: String(c.customer_code || '').trim(),
      warranty_status: computeWarrantyStatus(device),
    };
  };
  useEffect(() => {
    if (open) {
      const base = { ...defaultForm, branch };
      if (initialCustomer) {
        Object.assign(base, applyCustomerFields(initialCustomer, base));
      } else if (nextOrderCode) {
        base.order_code = nextOrderCode;
      }
      const merged = { ...base, phone2: base.phone2 || '', phone3: base.phone3 || '', ...(initialValues || {}) };
      setForm(merged);
      try {
        const parsed = JSON.parse(String(merged.product_lines || '[]'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProductLines(parsed.map((x: any) => {
            const productName = String(x.product_name || '').trim();
            const matched = products.find((p) => p.id === x.product_id)
              || products.find((p) => String(p.name || '').trim() === productName);
            return {
              product_id: String(x.product_id || matched?.id || ''),
              product_name: productName || matched?.name || '',
              quantity: String(x.quantity ?? '1'),
              unit_price: String(x.unit_price ?? '0'),
            };
          }));
        } else {
          const fallbackPrice = String((merged as any).price1 || '0');
          const fallbackName = String(merged.product_name || '').trim();
          const matched = products.find((p) => String(p.name || '').trim() === fallbackName);
          setProductLines([{
            product_id: matched?.id || '',
            product_name: fallbackName || matched?.name || '',
            quantity: '1',
            unit_price: fallbackPrice,
          }]);
        }
      } catch {
        const fallbackPrice = String((merged as any).price1 || '0');
        const fallbackName = String(merged.product_name || '').trim();
        setProductLines([{ product_id: '', product_name: fallbackName, quantity: '1', unit_price: fallbackPrice }]);
      }
    }
  }, [open, branch, initialCustomer, nextOrderCode, initialValues, customerDevices, products, areas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = productLines
      .map((ln) => {
        const prod = products.find((p) => p.id === ln.product_id);
        const product_name = String(prod?.name || ln.product_name || '').trim();
        if (!product_name) return null;
        return {
          product_id: prod?.id || ln.product_id || undefined,
          product_name,
          quantity: Math.max(1, Number(ln.quantity) || 1),
          unit_price: Math.max(0, Number(ln.unit_price) || 0),
        };
      })
      .filter(Boolean) as Array<{ product_id?: string; product_name: string; quantity: number; unit_price: number }>;
    const first = lines[0];
    const { phone2, phone3, ...formRest } = form;
    const joinedPhone = joinWorkOrderPhoneFields(formRest.phone || '', phone2, phone3);
    const payload: Record<string, string> = {
      ...formRest,
      phone: joinedPhone,
      product_name: first?.product_name || '',
      transport_cost: String(Math.max(0, Number(form.transport_cost) || 0)),
      product_lines: JSON.stringify(lines),
    };
    await onSubmit(payload);
    setForm({ ...defaultForm, branch });
    setProductLines([{ product_id: '', product_name: '', quantity: '1', unit_price: '0' }]);
    onOpenChange(false);
  };

  const selectCustomer = (c: CustomerForSuggest) => {
    setForm((prev) => applyCustomerFields(c, prev));
    setCustomerDropdown(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || 'أمر عمل جديد'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>كود العميل</Label>
            <Input
              value={form.order_code}
              readOnly
              className="bg-muted/50"
              placeholder="يُملأ تلقائياً من كود العميل عند اختيار الاسم"
            />
            <p className="text-[11px] text-muted-foreground">رقم الأمر في الطباعة هو كود العميل، ويُعبَّأ تلقائياً عند اختيار العميل.</p>
          </div>

          {/* اقتراح العميل */}
          <div className="space-y-1.5 relative">
            <Label>اسم العميل</Label>
            <Input
              ref={customerInputRef}
              value={form.customer_name}
              onChange={e => { setForm(p => ({ ...p, customer_name: e.target.value })); setCustomerDropdown(true); }}
              onFocus={() => suggestedCustomers.length > 0 && setCustomerDropdown(true)}
              onBlur={() => setTimeout(() => {
                setCustomerDropdown(false);
                const typed = (form.customer_name || '').trim();
                if (!typed) return;
                const matches = customers.filter((c) => matchesLooseSearch(c.name, typed) || c.name.trim() === typed);
                if (matches.length === 1) selectCustomer(matches[0]);
              }, 180)}
              placeholder="ابحث بأي جزء من الاسم أو الهاتف أو الكود (المسافات غير مطلوبة)"
            />
            {customerDropdown && suggestedCustomers.length > 0 && (
              <ul className="absolute z-50 w-full mt-0.5 border bg-popover rounded-md shadow-lg max-h-48 overflow-auto">
                {suggestedCustomers.map(c => (
                  <li key={c.id}>
                    <button type="button" className="w-full text-right px-3 py-2 hover:bg-muted text-sm" onClick={() => selectCustomer(c)}>
                      <span className="font-medium">{c.name}</span>
                      {c.customer_code && <span className="text-muted-foreground"> — كود {c.customer_code}</span>}
                      {c.phone1 && <span className="text-muted-foreground"> — {c.phone1}</span>}
                      {c.region && <span className="text-muted-foreground"> — {c.region}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-medium text-foreground">أرقام التليفون (حتى 3 أرقام)</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>الهاتف (أساسي)</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required dir="ltr" className="text-left" />
              </div>
              <div className="space-y-1.5">
                <Label>المنطقة</Label>
                <Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} placeholder="تُملأ تلقائياً من بيانات العميل" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>هاتف إضافي (اختياري)</Label>
                <Input value={form.phone2} onChange={e => setForm(p => ({ ...p, phone2: e.target.value }))} dir="ltr" className="text-left" placeholder="رقم ثانٍ" />
              </div>
              <div className="space-y-1.5">
                <Label>هاتف إضافي 2 (اختياري)</Label>
                <Input value={form.phone3} onChange={e => setForm(p => ({ ...p, phone3: e.target.value }))} dir="ltr" className="text-left" placeholder="رقم ثالث / واتساب" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>العنوان</Label>
            <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} required />
          </div>

          {areas.length > 0 && (
            <div className="space-y-1.5">
              <Label>المنطقة (من القائمة)</Label>
              <Select
                value={form.area_id || 'none'}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    area_id: v,
                    region: v !== 'none' ? (areas.find((a) => a.id === v)?.name || p.region) : p.region,
                  }))
                }
              >
                <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {areas.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>لينك اللوكيشن (اختياري)</Label>
            <Input value={form.location_url} onChange={e => setForm(p => ({ ...p, location_url: e.target.value }))} />
          </div>

          <div className="space-y-2 border rounded-md p-2">
            <div className="flex items-center justify-between">
              <Label>المنتجات داخل أمر الشغل</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setProductLines((prev) => [...prev, { product_id: '', product_name: '', quantity: '1', unit_price: '0' }])}
              >
                إضافة منتج
              </Button>
            </div>
            {productLines.map((ln, idx) => {
              const selected = products.find((p) => p.id === ln.product_id);
              const lineTotal = Math.max(1, Number(ln.quantity) || 1) * Math.max(0, Number(ln.unit_price) || 0);
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6 space-y-1.5">
                    <Label className="text-xs">منتج {idx + 1}</Label>
                    <ProductSearchCombobox
                      products={products.map((p) => ({ id: p.id, name: p.name, stock: Number(p.stock) || 0, sku_code: p.sku_code, barcode: p.barcode }))}
                      value={ln.product_id}
                      onValueChange={(id) =>
                        setProductLines((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? {
                                  ...row,
                                  product_id: id,
                                  product_name: products.find((p) => p.id === id)?.name || row.product_name,
                                  unit_price: String(products.find((p) => p.id === id)?.price1 ?? row.unit_price ?? '0'),
                                }
                              : row,
                          ),
                        )
                      }
                      placeholder="اكتب حرف من اسم المنتج للبحث"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">الكمية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={ln.quantity}
                      onChange={(e) => setProductLines((prev) => prev.map((row, i) => (i === idx ? { ...row, quantity: e.target.value } : row)))}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">سعر الوحدة</Label>
                    <Input
                      type="number"
                      min={0}
                      value={ln.unit_price}
                      onChange={(e) => setProductLines((prev) => prev.map((row, i) => (i === idx ? { ...row, unit_price: e.target.value } : row)))}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">الإجمالي</Label>
                    <Input value={String(lineTotal)} readOnly />
                  </div>
                  <div className="col-span-12 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {selected
                        ? `تم اختيار: ${selected.name} — المتاح: ${Number(selected.stock) || 0}`
                        : ln.product_name
                          ? `منتج محفوظ: ${ln.product_name}`
                          : 'لم يتم اختيار منتج'}
                    </span>
                    {productLines.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setProductLines((prev) => prev.filter((_, i) => i !== idx))}>
                        حذف السطر
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label>تكلفة المواصلات</Label>
            <Input
              type="number"
              min={0}
              dir="ltr"
              value={form.transport_cost ?? '0'}
              onChange={(e) => setForm((p) => ({ ...p, transport_cost: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>المندوب المسؤول</Label>
              <Select
                value={form.assigned_rep || 'none'}
                onValueChange={(v) => {
                  const name = reps.find((r) => r.id === v)?.full_name || '';
                  setForm((p) => ({
                    ...p,
                    assigned_rep: v,
                    technician: p.technician || (v !== 'none' ? name : p.technician),
                  }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مندوب</SelectItem>
                  {reps.map(r => (<SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الزيارة</Label>
              <Input type="date" value={form.visit_date} onChange={e => setForm(p => ({ ...p, visit_date: e.target.value }))} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>التواريخ القادمة للصيانة (اختياري)</Label>
            <Input value={form.maintenance_dates} onChange={e => setForm(p => ({ ...p, maintenance_dates: e.target.value }))} placeholder="مثال: 2026-04-15, 2026-07-20" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>الفني</Label>
              <Input value={form.technician} onChange={e => setForm(p => ({ ...p, technician: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>الضمان</Label>
              <Select value={form.warranty_status || 'منتهي'} onValueChange={v => setForm(p => ({ ...p, warranty_status: v }))}>
                <SelectTrigger><SelectValue placeholder="يُحسب من تاريخ التركيب" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ساري">ساري</SelectItem>
                  <SelectItem value="منتهي">منتهي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">معلق</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الفرع</Label>
              <Select value={form.branch} onValueChange={v => setForm(p => ({ ...p, branch: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="فرع الإسكندرية">فرع الإسكندرية</SelectItem>
                  <SelectItem value="فرع الجيزة">فرع الجيزة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading ? 'جاري الحفظ...' : (submitLabel || 'حفظ')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
