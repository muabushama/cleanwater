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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { canonicalBranchForSave } from '@/lib/branchFilters';
import { normalizeStorageLocation, STORAGE_LOCATION_OPTIONS, STORAGE_MAIN } from '@/lib/storageLocation';

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
  price?: number;
  price1: number;
  price2: number;
  price3: number;
  stock?: number;
  sku_code?: string | null;
  barcode?: string | null;
}

type NewProductDraft = {
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  min_stock: string;
  supplier: string;
  description: string;
  category: string;
  cost: string;
  priceRetail: string;
  priceWholesale: string;
  storage_location: string;
  stock: string;
  warranty: string;
};

type ProductLineRow = {
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  mode: 'existing' | 'new';
  draft: NewProductDraft;
  image?: File | null;
};

const emptyNewProduct = (): NewProductDraft => ({
  name: '',
  sku: '',
  barcode: '',
  unit: 'قطعة',
  min_stock: '5',
  supplier: '',
  description: '',
  category: 'غير مصنف',
  cost: '',
  priceRetail: '',
  priceWholesale: '',
  storage_location: STORAGE_MAIN,
  stock: '0',
  warranty: '12',
});

const emptyLine = (): ProductLineRow => ({
  product_id: '',
  product_name: '',
  quantity: '1',
  unit_price: '0',
  mode: 'existing',
  draft: emptyNewProduct(),
  image: null,
});

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
  onProductCreated?: (product: ProductForSuggest) => void;
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
  onProductCreated,
  loading,
}: WorkOrderAddDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm, branch });
  const [customerDropdown, setCustomerDropdown] = useState(false);
  const [productLines, setProductLines] = useState<ProductLineRow[]>([emptyLine()]);
  const [categoryNames, setCategoryNames] = useState<string[]>(['غير مصنف']);
  const [savingNewProductIdx, setSavingNewProductIdx] = useState<number | null>(null);
  const [extraProducts, setExtraProducts] = useState<ProductForSuggest[]>([]);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const allProducts = [...extraProducts, ...products];

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
      setExtraProducts([]);
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
            const matched = allProducts.find((p) => p.id === x.product_id)
              || allProducts.find((p) => String(p.name || '').trim() === productName);
            return {
              ...emptyLine(),
              product_id: String(x.product_id || matched?.id || ''),
              product_name: productName || matched?.name || '',
              quantity: String(x.quantity ?? '1'),
              unit_price: String(x.unit_price ?? '0'),
              mode: 'existing' as const,
            };
          }));
        } else {
          const fallbackPrice = String((merged as any).price1 || '0');
          const fallbackName = String(merged.product_name || '').trim();
          const matched = allProducts.find((p) => String(p.name || '').trim() === fallbackName);
          setProductLines([{
            ...emptyLine(),
            product_id: matched?.id || '',
            product_name: fallbackName || matched?.name || '',
            unit_price: fallbackPrice,
          }]);
        }
      } catch {
        const fallbackPrice = String((merged as any).price1 || '0');
        const fallbackName = String(merged.product_name || '').trim();
        setProductLines([{ ...emptyLine(), product_name: fallbackName, unit_price: fallbackPrice }]);
      }
      supabase.from('inventory_categories').select('name').order('sort_order').then(({ data }) => {
        const names = Array.from(new Set(['غير مصنف', ...(Array.isArray(data) ? data.map((c: any) => String(c.name || '').trim()).filter(Boolean) : [])]));
        setCategoryNames(names);
      });
    }
  }, [open, branch, initialCustomer, nextOrderCode, initialValues, customerDevices, areas]);

  const saveNewProduct = async (ln: ProductLineRow): Promise<ProductForSuggest> => {
    const draft = ln.draft;
    if (!draft.name.trim()) throw new Error('اسم المنتج الجديد مطلوب');
    if (!draft.priceRetail.trim()) throw new Error('سعر القطاعي للمنتج الجديد مطلوب');

    let imageUrl: string | null = null;
    if (ln.image) {
      const ext = ln.image.name.split('.').pop() || 'jpg';
      const filePath = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, ln.image);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
      imageUrl = urlData.publicUrl;
    }

    const insertPayload: Record<string, unknown> = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      branch: canonicalBranchForSave(form.branch || branch),
      category: draft.category.trim() || 'غير مصنف',
      classification: 'عام',
      cost: Number(draft.cost) || 0,
      price: Number(draft.priceRetail) || 0,
      price1: Number(draft.priceWholesale) || Number(draft.priceRetail) || 0,
      price2: 0,
      price3: 0,
      discount: 0,
      warranty: Math.max(0, Math.floor(Number(draft.warranty) || 12)),
      stock: Math.max(0, Math.floor(Number(draft.stock) || 0)),
      min_stock: Math.max(0, Math.floor(Number(draft.min_stock) || 0)),
      image: imageUrl,
      storage_location: normalizeStorageLocation(draft.storage_location),
    };
    if (draft.sku.trim()) insertPayload.sku_code = draft.sku.trim();
    if (draft.barcode.trim()) insertPayload.barcode = draft.barcode.trim();
    if (draft.unit.trim()) insertPayload.unit = draft.unit.trim();
    if (draft.supplier.trim()) insertPayload.supplier_name = draft.supplier.trim();
    if (draft.description.trim()) insertPayload.description = draft.description.trim();

    let { error } = await supabase.from('products').insert(insertPayload as any);
    if (error && /storage_location|Unknown column|warranty/i.test(error.message || '')) {
      delete insertPayload.storage_location;
      if (/Unknown column 'warranty'/i.test(error.message || '')) delete insertPayload.warranty;
      ({ error } = await supabase.from('products').insert(insertPayload as any));
    }
    if (error) throw error;

    const created: ProductForSuggest = {
      id: String(insertPayload.id),
      name: String(insertPayload.name),
      price: Number(insertPayload.price) || 0,
      price1: Number(insertPayload.price1) || 0,
      price2: 0,
      price3: 0,
      stock: Number(insertPayload.stock) || 0,
      sku_code: (insertPayload.sku_code as string) || null,
      barcode: (insertPayload.barcode as string) || null,
    };
    setExtraProducts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    onProductCreated?.(created);
    return created;
  };

  const handleSaveNewProductLine = async (idx: number) => {
    const ln = productLines[idx];
    if (!ln) return;
    setSavingNewProductIdx(idx);
    try {
      const created = await saveNewProduct(ln);
      setProductLines((prev) => prev.map((row, i) => i === idx ? {
        ...row,
        mode: 'existing',
        product_id: created.id,
        product_name: created.name,
        unit_price: String(created.price1 || created.price || row.unit_price || '0'),
        image: null,
      } : row));
      toast({ title: `تم إضافة المنتج «${created.name}» للمخزون واختياره` });
    } catch (err: any) {
      toast({ title: 'تعذر حفظ المنتج الجديد', description: err.message, variant: 'destructive' });
    } finally {
      setSavingNewProductIdx(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines: Array<{ product_id?: string; product_name: string; quantity: number; unit_price: number }> = [];
    try {
      for (const ln of productLines) {
        let productId = ln.product_id;
        let productName = ln.product_name;
        let unitPrice = Math.max(0, Number(ln.unit_price) || 0);
        if (ln.mode === 'new') {
          const created = await saveNewProduct(ln);
          productId = created.id;
          productName = created.name;
          if (!unitPrice) unitPrice = Number(created.price1 || created.price) || 0;
        } else {
          const prod = allProducts.find((p) => p.id === ln.product_id);
          productName = String(prod?.name || ln.product_name || '').trim();
          productId = prod?.id || ln.product_id;
        }
        if (!productName) continue;
        lines.push({
          product_id: productId || undefined,
          product_name: productName,
          quantity: Math.max(1, Number(ln.quantity) || 1),
          unit_price: unitPrice,
        });
      }
    } catch (err: any) {
      toast({ title: 'تعذر حفظ المنتج الجديد', description: err.message, variant: 'destructive' });
      return;
    }
    if (lines.length === 0) {
      toast({ title: 'أضف منتجاً واحداً على الأقل', variant: 'destructive' });
      return;
    }
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
    setProductLines([emptyLine()]);
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
                onClick={() => setProductLines((prev) => [...prev, emptyLine()])}
              >
                إضافة منتج
              </Button>
            </div>
            {productLines.map((ln, idx) => {
              const selected = allProducts.find((p) => p.id === ln.product_id);
              const lineTotal = Math.max(1, Number(ln.quantity) || 1) * Math.max(0, Number(ln.unit_price) || 0);
              const updateDraft = (patch: Partial<NewProductDraft>) =>
                setProductLines((prev) => prev.map((row, i) => i === idx ? { ...row, draft: { ...row.draft, ...patch } } : row));
              return (
                <div key={idx} className="space-y-2 border rounded-md p-2 bg-muted/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs">منتج {idx + 1}</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={ln.mode === 'existing' ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => setProductLines((prev) => prev.map((row, i) => i === idx ? { ...row, mode: 'existing' } : row))}
                      >
                        منتج موجود
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={ln.mode === 'new' ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => setProductLines((prev) => prev.map((row, i) => i === idx ? {
                          ...row,
                          mode: 'new',
                          product_id: '',
                          draft: row.draft.name ? row.draft : { ...emptyNewProduct(), name: row.product_name },
                        } : row))}
                      >
                        منتج جديد
                      </Button>
                    </div>
                  </div>

                  {ln.mode === 'existing' ? (
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6 space-y-1.5">
                        <ProductSearchCombobox
                          products={allProducts.map((p) => ({ id: p.id, name: p.name, stock: Number(p.stock) || 0, sku_code: p.sku_code, barcode: p.barcode }))}
                          value={ln.product_id}
                          onValueChange={(id) =>
                            setProductLines((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      product_id: id,
                                      product_name: allProducts.find((p) => p.id === id)?.name || row.product_name,
                                      unit_price: String(allProducts.find((p) => p.id === id)?.price1 ?? allProducts.find((p) => p.id === id)?.price ?? row.unit_price ?? '0'),
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
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-muted-foreground">اكتب بيانات المنتج كاملة. يُحفظ في المخزون ويمكن اختياره لاحقاً من القائمة.</p>
                      <div>
                        <Label className="text-xs">اسم المنتج *</Label>
                        <Input value={ln.draft.name} onChange={(e) => updateDraft({ name: e.target.value })} placeholder="مثال: فلتر RO 7 مراحل" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">SKU / كود الصنف</Label>
                          <Input dir="ltr" value={ln.draft.sku} onChange={(e) => updateDraft({ sku: e.target.value })} placeholder="RO-7001" />
                        </div>
                        <div>
                          <Label className="text-xs">الباركود</Label>
                          <Input dir="ltr" value={ln.draft.barcode} onChange={(e) => updateDraft({ barcode: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">الوحدة</Label>
                          <Input value={ln.draft.unit} onChange={(e) => updateDraft({ unit: e.target.value })} placeholder="قطعة" />
                        </div>
                        <div>
                          <Label className="text-xs">حد التنبيه الأدنى</Label>
                          <Input type="number" dir="ltr" value={ln.draft.min_stock} onChange={(e) => updateDraft({ min_stock: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">رصيد أول المدة</Label>
                          <Input type="number" dir="ltr" value={ln.draft.stock} onChange={(e) => updateDraft({ stock: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">الضمان (شهر)</Label>
                          <Input type="number" dir="ltr" value={ln.draft.warranty} onChange={(e) => updateDraft({ warranty: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">المورد</Label>
                        <Input value={ln.draft.supplier} onChange={(e) => updateDraft({ supplier: e.target.value })} placeholder="اسم المورد" />
                      </div>
                      <div>
                        <Label className="text-xs">وصف / ملاحظات</Label>
                        <Textarea className="min-h-[64px] text-sm" value={ln.draft.description} onChange={(e) => updateDraft({ description: e.target.value })} placeholder="مواصفات، ملاحظات تركيب..." />
                      </div>
                      <div>
                        <Label className="text-xs">القسم</Label>
                        <Select value={ln.draft.category || 'غير مصنف'} onValueChange={(v) => updateDraft({ category: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                          <SelectContent>
                            {categoryNames.map((name) => (
                              <SelectItem key={`wo-cat-${idx}-${name}`} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="mt-1"
                          value={ln.draft.category}
                          onChange={(e) => updateDraft({ category: e.target.value })}
                          placeholder="أو اكتب قسماً جديداً"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">موقع التخزين</Label>
                        <Select value={normalizeStorageLocation(ln.draft.storage_location)} onValueChange={(v) => updateDraft({ storage_location: normalizeStorageLocation(v) })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STORAGE_LOCATION_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">سعر التكلفة</Label>
                          <Input type="number" dir="ltr" value={ln.draft.cost} onChange={(e) => updateDraft({ cost: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">سعر القطاعي *</Label>
                          <Input type="number" dir="ltr" value={ln.draft.priceRetail} onChange={(e) => {
                            const value = e.target.value;
                            setProductLines((prev) => prev.map((row, i) => i === idx ? {
                              ...row,
                              unit_price: value || row.unit_price,
                              draft: { ...row.draft, priceRetail: value },
                            } : row));
                          }} />
                        </div>
                        <div>
                          <Label className="text-xs">سعر الجملة</Label>
                          <Input type="number" dir="ltr" value={ln.draft.priceWholesale} onChange={(e) => updateDraft({ priceWholesale: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">صورة المنتج</Label>
                        <Input type="file" accept="image/*" onChange={(e) => setProductLines((prev) => prev.map((row, i) => i === idx ? { ...row, image: e.target.files?.[0] || null } : row))} />
                        {ln.image && <p className="text-[11px] text-primary mt-1">تم اختيار: {ln.image.name}</p>}
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4 space-y-1.5">
                          <Label className="text-xs">كمية أمر الشغل</Label>
                          <Input type="number" min={1} value={ln.quantity} onChange={(e) => setProductLines((prev) => prev.map((row, i) => (i === idx ? { ...row, quantity: e.target.value } : row)))} />
                        </div>
                        <div className="col-span-4 space-y-1.5">
                          <Label className="text-xs">سعر الوحدة في الأمر</Label>
                          <Input type="number" min={0} value={ln.unit_price} onChange={(e) => setProductLines((prev) => prev.map((row, i) => (i === idx ? { ...row, unit_price: e.target.value } : row)))} />
                        </div>
                        <div className="col-span-4 space-y-1.5">
                          <Label className="text-xs">إجمالي السطر</Label>
                          <Input value={String(lineTotal)} readOnly />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={savingNewProductIdx === idx}
                        onClick={() => handleSaveNewProductLine(idx)}
                      >
                        {savingNewProductIdx === idx ? 'جاري حفظ المنتج...' : 'حفظ المنتج في المخزون واختياره'}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {ln.mode === 'new'
                        ? (ln.draft.name ? `منتج جديد: ${ln.draft.name}` : 'املأ بيانات المنتج الجديد')
                        : selected
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
