import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, MapPin, FileText, Wrench, ClipboardList, Monitor, CreditCard, Plus, CheckCircle, AlertCircle, Edit, Trash2, ChevronDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEGP } from '@/data/demo-data';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch } from '@/lib/branchFilters';
import { useNavigate } from 'react-router-dom';
import { invoiceCustomerCredit, invoiceDebtRemaining } from '@/lib/invoiceBalance';
import { promptDeletePassword } from '@/lib/deletePassword';
import { formatDateDayMonthYear as formatDateDisplay } from '@/lib/dateDisplay';
import {
  getMaintenanceIntervalMonths,
  getNextMaintenanceDateStr,
} from '@/lib/maintenanceSchedule';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const installmentIntervalAr = (n: number) => {
  const x = Math.max(1, Number(n) || 1);
  if (x === 1) return 'كل شهر';
  if (x === 2) return 'كل شهرين';
  if (x === 3) return 'كل 3 شهور';
  if (x === 6) return 'كل 6 شهور';
  if (x >= 12) return 'سنوي';
  return `كل ${x} شهر`;
};

const parseInstallmentAmounts = (raw: string): number[] =>
  String(raw || '')
    .split(/[،,\s]+/)
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);

interface Customer {
  id: string;
  name: string;
  phone1: string;
  phone2?: string;
  whatsapp?: string;
  address: string;
  region?: string;
  area_id?: string | null;
  notes?: string;
}

interface Candle {
  name: string;
  type: string;
  duration_months: number;
  price: number;
}

interface CustomerDevice {
  id: string;
  customer_id: string;
  product_name: string;
  device_type: string;
  serial_number: string;
  install_date: string | null;
  warranty_months: number;
  warranty_status: string;
  contract_type: string;
  selling_price: number;
  total_price: number;
  contract_value?: number;
  contract_duration_months?: number;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contract_first_visit_date?: string | null;
  contract_installment_interval_months?: number;
  installments_count: number;
  installment_amount: number;
  first_installment_date: string | null;
  candles: Candle[];
  branch: string;
  customer_code: string;
  notes: string;
  ad_source: string;
  created_at: string;
}

interface CandleChange {
  id: string;
  device_id: string;
  change_date: string;
  candle1: boolean;
  candle2: boolean;
  candle3: boolean;
  candle4: boolean;
  candle5: boolean;
  candle6: boolean;
  candle7: boolean;
  candle8?: boolean;
  candle9?: boolean;
  candle10?: boolean;
  tds_reading: string;
  technician: string;
  cost: number;
  collected: number;
  remaining: number;
  notes: string;
  status: string;
}

interface Installment {
  id: string;
  device_id: string;
  installment_date: string;
  amount: number;
  collection_date: string | null;
  status: string;
  /** اختياري إن وُجد عمود لاحقاً في قاعدة البيانات */
  sales_rep?: string | null;
}

interface CustomerDetailDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const calcContractEndDate = (startDate?: string | null, monthsRaw?: number | string | null) => {
  if (!startDate) return '';
  const months = Math.max(0, Number(monthsRaw) || 0);
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const syncCustomerDisplayName = async (customerId: string, oldName: string, newName: string) => {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName.trim()) return;
  const { error: custErr } = await supabase.from('customers').update({ name: trimmed }).eq('id', customerId);
  if (custErr) throw custErr;
  const [invById, invByName, woRes, maintRes] = await Promise.all([
    supabase.from('invoices').update({ customer_name: trimmed }).eq('customer_id', customerId),
    supabase.from('invoices').update({ customer_name: trimmed }).eq('customer_name', oldName),
    supabase.from('work_orders').update({ customer_name: trimmed }).eq('customer_name', oldName),
    supabase.from('maintenance').update({ customer_name: trimmed }).eq('customer_name', oldName),
  ]);
  for (const res of [invById, invByName, woRes, maintRes]) {
    if (res.error) throw res.error;
  }
};

// ===== Add Device Form =====
function AddDeviceForm({ customerId, onSaved }: { customerId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; category: string; classification: string }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [form, setForm] = useState({
    id: '',
    product_name: '',
    device_type: '',
    serial_number: '',
    install_date: '',
    warranty_months: 12,
    contract_type: 'كاش',
    selling_price: 0,
    total_price: 0,
    contract_value: 0,
    contract_duration_months: 12,
    contract_start_date: '',
    contract_end_date: '',
    contract_first_visit_date: '',
    installments_count: 0,
    installment_amount: 0,
    first_installment_date: '',
    installment_interval_months: 1,
    maintenance_installments_text: '',
    branch: 'فرع الإسكندرية',
    customer_code: '',
    notes: '',
    ad_source: '',
  });

  const maintenanceInstallmentPreview = useMemo(() => {
    if (form.contract_type !== 'عقد صيانة') return [] as { date: string; amount: number }[];
    const interval = Math.max(1, Number(form.installment_interval_months) || 1);
    const amounts = String(form.maintenance_installments_text || '')
      .split(/[،,\s]+/)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);
    const start = form.first_installment_date ? new Date(form.first_installment_date) : new Date();
    return amounts.map((amount, index) => {
      const d = new Date(start);
      d.setMonth(d.getMonth() + index * interval);
      return { date: d.toISOString().slice(0, 10), amount };
    });
  }, [form.contract_type, form.maintenance_installments_text, form.first_installment_date, form.installment_interval_months]);

  useEffect(() => {
    const loadProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id,name,category,classification')
        .order('name')
        .limit(500);
      if (Array.isArray(data)) {
        setProducts(data as any);
      }
    };
    loadProducts();
  }, []);

  const handleSave = async () => {
    if (!form.product_name) {
      toast({ title: 'خطأ', description: 'اسم المنتج مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const deviceId = crypto.randomUUID();
      const { error } = await (supabase as any).from('customer_devices').insert({
        id: deviceId,
        customer_id: customerId,
        product_name: form.product_name,
        device_type: form.device_type,
        serial_number: form.serial_number,
        install_date: form.install_date || null,
        warranty_months: form.warranty_months,
        contract_type: form.contract_type,
        selling_price: form.selling_price,
        total_price: form.total_price,
        contract_value: form.contract_value || form.total_price,
        contract_duration_months: form.contract_duration_months,
        contract_start_date: form.contract_start_date || form.install_date || null,
        contract_end_date: form.contract_end_date || calcContractEndDate(form.contract_start_date || form.install_date, form.contract_duration_months) || null,
        contract_first_visit_date: form.contract_first_visit_date || null,
        contract_installment_interval_months: form.installment_interval_months,
        installments_count: form.installments_count,
        installment_amount: form.installment_amount,
        first_installment_date: form.first_installment_date || null,
        branch: form.branch,
        customer_code: form.customer_code,
        notes: form.notes,
        ad_source: form.ad_source,
        created_by: user?.id,
      } as any);
      if (error) throw error;

      // عقود الصيانة يمكن تقسيمها على دفعات متغيرة (350، 400، 450...)
      if (form.contract_type === 'عقد صيانة') {
        const interval = Math.max(1, Number(form.installment_interval_months) || 1);
        const amounts = String(form.maintenance_installments_text || '')
          .split(/[،,\s]+/)
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x) && x > 0);
        if (amounts.length > 0) {
          const start = form.first_installment_date
            ? new Date(form.first_installment_date)
            : new Date();
          const rows = amounts.map((amount, index) => {
            const d = new Date(start);
            d.setMonth(d.getMonth() + (index * interval));
            return {
              id: crypto.randomUUID(),
              customer_id: customerId,
              device_id: deviceId,
              installment_date: d.toISOString().slice(0, 10),
              amount,
              status: 'معلق',
              collection_date: null,
            };
          });
          const { error: instError } = await (supabase as any).from('installments').insert(rows as any);
          if (instError) throw instError;
        }
      }
      toast({ title: 'تم إضافة الجهاز بنجاح' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <h4 className="font-semibold text-sm">إضافة جهاز جديد</h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <Label className="text-xs">اسم المنتج *</Label>
          <Input
            value={productSearch || form.product_name}
            onChange={e => {
              const v = e.target.value;
              setProductSearch(v);
              setShowProductDropdown(!!v.trim());
              setForm(p => ({ ...p, product_name: v }));
            }}
            onFocus={() => setShowProductDropdown(!!productSearch.trim() || products.length > 0)}
            onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
            className="h-8 text-sm"
            placeholder="ابحث باسم المنتج من المخزون..."
          />
          {showProductDropdown && products.length > 0 && (
            <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto text-xs">
              {products
                .filter(p => {
                  const term = productSearch.trim();
                  if (!term) return true;
                  const name = (p.name || '').toLowerCase();
                  return name.includes(term.toLowerCase());
                })
                .slice(0, 20)
                .map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-right px-2 py-1.5 hover:bg-accent/50 border-b last:border-0 flex justify-between gap-2"
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        product_name: p.name,
                        device_type: p.classification || p.category || prev.device_type,
                      }));
                      setProductSearch(p.name);
                      setShowProductDropdown(false);
                    }}
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">
                      {p.category} • {p.classification}
                    </span>
                  </button>
                ))}
              {products.length === 0 && (
                <div className="px-2 py-1 text-muted-foreground">لا توجد منتجات في المخزون</div>
              )}
            </div>
          )}
        </div>
        <div><Label className="text-xs">نوع الجهاز</Label><Input value={form.device_type} onChange={e => setForm(p => ({...p, device_type: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">الرقم المسلسل</Label><Input value={form.serial_number} onChange={e => setForm(p => ({...p, serial_number: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">تاريخ التركيب</Label><Input type="date" value={form.install_date} onChange={e => setForm(p => ({...p, install_date: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">مدة الضمان (شهور)</Label><Input type="number" value={form.warranty_months} onChange={e => setForm(p => ({...p, warranty_months: +e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">الفرع</Label>
          <Select value={form.branch} onValueChange={v => setForm(p => ({...p, branch: v}))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="فرع الإسكندرية">فرع الإسكندرية</SelectItem>
              <SelectItem value="فرع الجيزة">فرع الجيزة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">نوع العقد</Label>
          <Select value={form.contract_type} onValueChange={v => setForm(p => ({...p, contract_type: v}))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="كاش">كاش</SelectItem>
              <SelectItem value="تقسيط">تقسيط</SelectItem>
              <SelectItem value="عقد صيانة">عقد صيانة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">سعر البيع</Label><Input type="number" value={form.selling_price} onChange={e => setForm(p => ({...p, selling_price: +e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">الإجمالي</Label><Input type="number" value={form.total_price} onChange={e => setForm(p => ({...p, total_price: +e.target.value}))} className="h-8 text-sm" /></div>
        {form.contract_type === 'تقسيط' && (
          <>
            <div><Label className="text-xs">عدد الأقساط</Label><Input type="number" value={form.installments_count} onChange={e => setForm(p => ({...p, installments_count: +e.target.value}))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">قسط كل (ج.م)</Label><Input type="number" value={form.installment_amount} onChange={e => setForm(p => ({...p, installment_amount: +e.target.value}))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">تاريخ أول قسط</Label><Input type="date" value={form.first_installment_date} onChange={e => setForm(p => ({...p, first_installment_date: e.target.value}))} className="h-8 text-sm" /></div>
          </>
        )}
        {form.contract_type === 'عقد صيانة' && (
          <>
            <div><Label className="text-xs">قيمة العقد</Label><Input type="number" value={form.contract_value} onChange={e => setForm(p => ({...p, contract_value: +e.target.value}))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">مدة العقد (شهور)</Label><Input type="number" value={form.contract_duration_months} onChange={e => setForm(p => ({...p, contract_duration_months: +e.target.value}))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">بداية العقد</Label><Input type="date" value={form.contract_start_date} onChange={e => setForm(p => ({...p, contract_start_date: e.target.value}))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">نهاية العقد</Label><Input type="date" value={form.contract_end_date || (form.contract_start_date ? calcContractEndDate(form.contract_start_date, form.contract_duration_months) : '')} onChange={e => setForm(p => ({...p, contract_end_date: e.target.value}))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">تاريخ أول زيارة</Label><Input type="date" value={form.contract_first_visit_date} onChange={e => setForm(p => ({...p, contract_first_visit_date: e.target.value}))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">فاصل الدفعات (بالشهور)</Label>
              <Select
                value={String(form.installment_interval_months || 1)}
                onValueChange={(v) => setForm((p) => ({ ...p, installment_interval_months: Number(v) || 1 }))}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">كل شهر</SelectItem>
                  <SelectItem value="2">كل شهرين</SelectItem>
                  <SelectItem value="3">كل 3 شهور</SelectItem>
                  <SelectItem value="6">كل 6 شهور</SelectItem>
                  <SelectItem value="12">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">تاريخ أول دفعة</Label><Input type="date" value={form.first_installment_date} onChange={e => setForm(p => ({...p, first_installment_date: e.target.value}))} className="h-8 text-sm" /></div>
            <div className="col-span-2">
              <Label className="text-xs">الدفعات (مبالغ مفصولة بفاصلة)</Label>
              <Input
                value={form.maintenance_installments_text}
                onChange={e => setForm(p => ({ ...p, maintenance_installments_text: e.target.value }))}
                className="h-8 text-sm"
                placeholder="مثال: 350, 400, 450, 400, 450"
              />
            </div>
            {maintenanceInstallmentPreview.length > 0 && (
              <div className="col-span-2 border rounded-md overflow-hidden">
                <p className="text-xs font-semibold bg-muted/60 px-2 py-1">معاينة تقسيم الدفعات</p>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-right p-1">#</th>
                      <th className="text-right p-1">تاريخ الاستحقاق</th>
                      <th className="text-left p-1">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceInstallmentPreview.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1 text-center">{i + 1}</td>
                        <td className="p-1">{formatDateDisplay(row.date)}</td>
                        <td className="p-1 font-medium">{formatEGP(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold bg-muted/30">
                      <td colSpan={2} className="p-1 text-right">الإجمالي</td>
                      <td className="p-1">{formatEGP(maintenanceInstallmentPreview.reduce((s, x) => s + x.amount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
        <div><Label className="text-xs">كود العميل</Label><Input value={form.customer_code} onChange={e => setForm(p => ({...p, customer_code: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">مصدر الإعلان</Label><Input value={form.ad_source} onChange={e => setForm(p => ({...p, ad_source: e.target.value}))} className="h-8 text-sm" /></div>
      </div>
      <div><Label className="text-xs">ملاحظات</Label><Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="text-sm min-h-[50px]" /></div>
      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">{saving ? 'جاري الحفظ...' : 'حفظ الجهاز'}</Button>
    </div>
  );
}

// ===== Add Candle Change Form =====
function AddCandleChangeForm({
  deviceId,
  device,
  customerId,
  customerName,
  deviceName,
  customerPhone,
  customerPhone2,
  customerAddress,
  customerRegion,
  branch,
  onSaved,
}: {
  deviceId: string;
  device: CustomerDevice;
  customerId: string;
  customerName: string;
  deviceName: string;
  customerPhone?: string;
  customerPhone2?: string;
  customerAddress?: string;
  customerRegion?: string;
  branch: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    change_date: new Date().toISOString().split('T')[0],
    candle1: false, candle2: false, candle3: false, candle4: false,
    candle5: false, candle6: false, candle7: false,
    candle8: false, candle9: false, candle10: false,
    tds_reading: '',
    technician: '',
    cost: 0,
    collected: 0,
    notes: '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('candle_changes').insert({
        device_id: deviceId,
        customer_id: customerId,
        change_date: form.change_date,
        candle1: form.candle1,
        candle2: form.candle2,
        candle3: form.candle3,
        candle4: form.candle4,
        candle5: form.candle5,
        candle6: form.candle6,
        candle7: form.candle7,
        candle8: form.candle8,
        candle9: form.candle9,
        candle10: form.candle10,
        tds_reading: form.tds_reading,
        technician: form.technician,
        cost: form.cost,
        collected: form.collected,
        remaining: invoiceDebtRemaining(form.cost, form.collected),
        notes: form.notes,
      } as any);
      if (error) throw error;

      const user = (await supabase.auth.getUser()).data.user;
      const nextDateStr = getNextMaintenanceDateStr(device, form.change_date);
      const phoneJoined = [customerPhone, customerPhone2].filter(Boolean).join(' - ');
      const { data: maintData } = await supabase.from('maintenance').insert({
        customer_name: customerName,
        product_name: deviceName || device.product_name || 'صيانة جهاز',
        type: 'تغيير شمعات',
        next_date: nextDateStr,
        technician: form.technician || '',
        cost: Number(form.cost) || 0,
        notes: form.notes || '',
        phone: phoneJoined,
        status: 'upcoming',
        branch: branch || 'فرع الإسكندرية',
        created_by: user?.id,
      } as any).select('id').single();

      if (nextDateStr && maintData?.id) {
        await supabase.from('work_orders').insert({
          order_code: `صيانة-${nextDateStr}-${String(maintData.id).slice(-6)}`,
          customer_name: customerName,
          phone: phoneJoined,
          address: customerAddress || '—',
          region: customerRegion || '',
          product_name: deviceName || device.product_name || '',
          visit_date: nextDateStr,
          technician: form.technician || '',
          branch: branch || 'فرع الإسكندرية',
          status: 'pending',
          items: Number(form.cost) > 0 ? [{ description: 'تغيير شمعات', value: Number(form.cost) }] : [],
          transport_cost: 0,
          total: Number(form.cost) || 0,
          previous_visits: [],
          created_by: user?.id,
        } as any);
      }

      toast({
        title: 'تم تسجيل الصيانة بنجاح',
        description: `الصيانة القادمة بعد ${getMaintenanceIntervalMonths(device)} شهر: ${formatDateDisplay(nextDateStr)}`,
      });
      onSaved();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const candleLabels = ['ش1', 'ش2', 'ش3', 'ش4', 'ش5', 'ش6', 'ش7', 'ش8', 'ش9', 'ش10'];

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <h4 className="font-semibold text-sm">تسجيل صيانة جديدة</h4>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">التاريخ</Label><Input type="date" value={form.change_date} onChange={e => setForm(p => ({...p, change_date: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">الفني</Label><Input value={form.technician} onChange={e => setForm(p => ({...p, technician: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">التكلفة</Label><Input type="number" value={form.cost} onChange={e => setForm(p => ({...p, cost: +e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">المحصل</Label><Input type="number" value={form.collected} onChange={e => setForm(p => ({...p, collected: +e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">TDS</Label><Input value={form.tds_reading} onChange={e => setForm(p => ({...p, tds_reading: e.target.value}))} className="h-8 text-sm" /></div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">الشمعات المغيّرة</Label>
        <div className="flex flex-wrap gap-3">
          {candleLabels.map((label, i) => {
            const key = `candle${i + 1}` as keyof typeof form;
            return (
              <label key={i} className="flex items-center gap-1 text-xs">
                <Checkbox checked={form[key] as boolean} onCheckedChange={v => setForm(p => ({...p, [key]: v}))} />
                {label}
              </label>
            );
          })}
        </div>
      </div>
      <div><Label className="text-xs">ملاحظات</Label><Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="h-8 text-sm" /></div>
      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">{saving ? 'جاري الحفظ...' : 'حفظ الصيانة'}</Button>
    </div>
  );
}

// ===== Edit Candle Change Form =====
function EditCandleChangeForm({
  record,
  onSaved,
  onCancel,
}: {
  record: CandleChange;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    change_date: record.change_date,
    candle1: record.candle1, candle2: record.candle2, candle3: record.candle3, candle4: record.candle4,
    candle5: record.candle5, candle6: record.candle6, candle7: record.candle7,
    candle8: record.candle8 ?? false, candle9: record.candle9 ?? false, candle10: record.candle10 ?? false,
    tds_reading: record.tds_reading || '',
    technician: record.technician || '',
    cost: Number(record.cost) || 0,
    collected: Number(record.collected) || 0,
    notes: record.notes || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('candle_changes').update({
        change_date: form.change_date,
        candle1: form.candle1, candle2: form.candle2, candle3: form.candle3, candle4: form.candle4,
        candle5: form.candle5, candle6: form.candle6, candle7: form.candle7,
        candle8: form.candle8, candle9: form.candle9, candle10: form.candle10,
        tds_reading: form.tds_reading,
        technician: form.technician,
        cost: form.cost,
        collected: form.collected,
        remaining: invoiceDebtRemaining(form.cost, form.collected),
        notes: form.notes,
      } as any).eq('id', record.id);
      if (error) throw error;
      toast({ title: 'تم تعديل الصيانة بنجاح' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const candleLabels = ['ش1', 'ش2', 'ش3', 'ش4', 'ش5', 'ش6', 'ش7', 'ش8', 'ش9', 'ش10'];

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-yellow-50/50 dark:bg-yellow-950/10">
      <h4 className="font-semibold text-sm">تعديل صيانة — {formatDateDisplay(record.change_date)}</h4>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">التاريخ</Label><Input type="date" value={form.change_date} onChange={e => setForm(p => ({...p, change_date: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">الفني</Label><Input value={form.technician} onChange={e => setForm(p => ({...p, technician: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">التكلفة</Label><Input type="number" value={form.cost} onChange={e => setForm(p => ({...p, cost: +e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">المحصل</Label><Input type="number" value={form.collected} onChange={e => setForm(p => ({...p, collected: +e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">TDS</Label><Input value={form.tds_reading} onChange={e => setForm(p => ({...p, tds_reading: e.target.value}))} className="h-8 text-sm" /></div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">الشمعات المغيّرة</Label>
        <div className="flex flex-wrap gap-3">
          {candleLabels.map((label, i) => {
            const key = `candle${i + 1}` as keyof typeof form;
            return (
              <label key={i} className="flex items-center gap-1 text-xs">
                <Checkbox checked={form[key] as boolean} onCheckedChange={v => setForm(p => ({...p, [key]: v}))} />
                {label}
              </label>
            );
          })}
        </div>
      </div>
      <div><Label className="text-xs">ملاحظات</Label><Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="h-8 text-sm" /></div>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} size="sm" className="flex-1">{saving ? 'جاري الحفظ...' : 'حفظ التعديل'}</Button>
        <Button onClick={onCancel} variant="outline" size="sm">إلغاء</Button>
      </div>
    </div>
  );
}

interface CandleType {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  branch: string;
  sort_order: number;
}

// ===== Device Detail Card =====
function DeviceDetailCard({
  device,
  customerId,
  customerName,
  customerPhone,
  customerPhone2,
  customerAddress,
  customerRegion,
  onRefresh,
  onCustomerNameChange,
}: {
  device: CustomerDevice;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerPhone2?: string;
  customerAddress?: string;
  customerRegion?: string;
  onRefresh: () => void;
  onCustomerNameChange?: (newName: string) => void;
}) {
  const [candleChanges, setCandleChanges] = useState<CandleChange[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [editingChangeId, setEditingChangeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('candles');
  const [editCandles, setEditCandles] = useState(false);
  const [candlesDraft, setCandlesDraft] = useState<Candle[]>([]);
  const [editDeviceOpen, setEditDeviceOpen] = useState(false);
  const [candleTypes, setCandleTypes] = useState<CandleType[]>([]);
  const [showCandleTypesManager, setShowCandleTypesManager] = useState(false);
  const [candleTypeForm, setCandleTypeForm] = useState({ name: '', duration_months: '3', price: '0' });
  const [editingCandleType, setEditingCandleType] = useState<CandleType | null>(null);
  const [candleTypeSaving, setCandleTypeSaving] = useState(false);
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    customer_name: customerName || '',
    product_name: device.product_name || '',
    device_type: device.device_type || '',
    serial_number: device.serial_number || '',
    install_date: device.install_date || '',
    warranty_months: String(device.warranty_months || 12),
    contract_type: device.contract_type || 'كاش',
    selling_price: String(device.selling_price || 0),
    total_price: String(device.total_price || 0),
    contract_value: String(device.contract_value ?? device.total_price ?? 0),
    contract_duration_months: String(device.contract_duration_months ?? 12),
    contract_start_date: device.contract_start_date || '',
    contract_end_date: device.contract_end_date || '',
    contract_first_visit_date: device.contract_first_visit_date || '',
    contract_installment_interval_months: String(device.contract_installment_interval_months ?? 1),
    installments_count: String(device.installments_count || 0),
    installment_amount: String(device.installment_amount || 0),
    maintenance_installments_text: '',
    first_installment_date: device.first_installment_date || '',
    customer_code: device.customer_code || '',
    ad_source: device.ad_source || '',
    notes: device.notes || '',
    branch: device.branch || 'فرع الإسكندرية',
  });
  const [installmentSavingId, setInstallmentSavingId] = useState<string | null>(null);
  const [maintenanceContractPanelOpen, setMaintenanceContractPanelOpen] = useState(
    () => device.contract_type === 'تقسيط' || device.contract_type === 'عقد صيانة',
  );
  const { toast } = useToast();

  const refreshCandleChanges = async () => {
    const { data } = await (supabase as any).from('candle_changes').select('*').eq('device_id', device.id).order('change_date', { ascending: false });
    setCandleChanges((data || []) as CandleChange[]);
  };

  const deleteMaintRecord = async (cc: CandleChange) => {
    if (!confirm(`حذف سجل الصيانة بتاريخ ${formatDateDisplay(cc.change_date)}؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await (supabase as any).from('candle_changes').delete().eq('id', cc.id);
      if (error) throw error;
      toast({ title: 'تم حذف سجل الصيانة' });
      await refreshCandleChanges();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    const fetchDeviceData = async () => {
      const db = supabase as any;
      const [ccRes, instRes] = await Promise.all([
        db.from('candle_changes').select('*').eq('device_id', device.id).order('change_date', { ascending: false }),
        db.from('installments').select('*').eq('device_id', device.id).order('installment_date', { ascending: true }),
      ]);
      setCandleChanges((ccRes.data || []) as CandleChange[]);
      setInstallments((instRes.data || []) as Installment[]);
      if (Array.isArray(instRes.data) && instRes.data.length > 0) {
        setDeviceForm((p) => ({
          ...p,
          maintenance_installments_text: (instRes.data as Installment[]).map((inst) => String(Number(inst.amount) || 0)).join(', '),
        }));
      }
    };
    fetchDeviceData();
  }, [device.id]);

  useEffect(() => {
    (supabase as any).from('candle_types').select('*').order('sort_order')
      .then((res: any) => setCandleTypes(Array.isArray(res?.data) ? res.data as CandleType[] : []));
  }, []);

  const candleTypeNames = candleTypes.length > 0
    ? candleTypes.map(ct => ct.name)
    : ['عادي درجة اولى', 'تيواني'];

  const handleSaveCandleType = async () => {
    if (!candleTypeForm.name.trim()) return;
    setCandleTypeSaving(true);
    try {
      const payload = {
        name: candleTypeForm.name.trim(),
        duration_months: Number(candleTypeForm.duration_months) || 3,
        price: Number(candleTypeForm.price) || 0,
        branch: device.branch || 'فرع الإسكندرية',
        sort_order: candleTypes.length,
      };
      if (editingCandleType) {
        await (supabase as any).from('candle_types').update(payload).eq('id', editingCandleType.id);
      } else {
        await (supabase as any).from('candle_types').insert({ ...payload, id: crypto.randomUUID() });
      }
      const res = await (supabase as any).from('candle_types').select('*').order('sort_order');
      setCandleTypes(Array.isArray(res?.data) ? res.data as CandleType[] : []);
      setCandleTypeForm({ name: '', duration_months: '3', price: '0' });
      setEditingCandleType(null);
      toast({ title: editingCandleType ? 'تم تعديل النوع' : 'تم إضافة النوع' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setCandleTypeSaving(false);
    }
  };

  const handleDeleteCandleType = async (ct: CandleType) => {
    if (!confirm(`حذف نوع الشمعة "${ct.name}"؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      await (supabase as any).from('candle_types').delete().eq('id', ct.id);
      setCandleTypes(prev => prev.filter(t => t.id !== ct.id));
      toast({ title: 'تم حذف النوع' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const warrantyEnd = device.install_date
    ? new Date(new Date(device.install_date).setMonth(new Date(device.install_date).getMonth() + device.warranty_months))
    : null;
  const isWarrantyActive = warrantyEnd ? warrantyEnd > new Date() : false;

  const candles = Array.isArray(device.candles) ? device.candles : [];

  useEffect(() => {
    setCandlesDraft(
      (Array.isArray(device.candles) ? device.candles : []).slice(0, 10).map((c) => ({
        name: c.name,
        type: c.type || 'عادي درجة اولى',
        duration_months: c.duration_months ?? 3,
        price: c.price ?? 0,
      })),
    );
  }, [device.candles]);

  useEffect(() => {
    setDeviceForm({
      customer_name: customerName || '',
      product_name: device.product_name || '',
      device_type: device.device_type || '',
      serial_number: device.serial_number || '',
      install_date: device.install_date || '',
      warranty_months: String(device.warranty_months || 12),
      contract_type: device.contract_type || 'كاش',
      selling_price: String(device.selling_price || 0),
      total_price: String(device.total_price || 0),
      contract_value: String(device.contract_value ?? device.total_price ?? 0),
      contract_duration_months: String(device.contract_duration_months ?? 12),
      contract_start_date: device.contract_start_date || '',
      contract_end_date: device.contract_end_date || '',
      contract_first_visit_date: device.contract_first_visit_date || '',
      contract_installment_interval_months: String(device.contract_installment_interval_months ?? 1),
      installments_count: String(device.installments_count || 0),
      installment_amount: String(device.installment_amount || 0),
      first_installment_date: device.first_installment_date || '',
      customer_code: device.customer_code || '',
      ad_source: device.ad_source || '',
      notes: device.notes || '',
      branch: device.branch || 'فرع الإسكندرية',
    });
  }, [device, customerName]);

  const handleSaveCandles = async () => {
    try {
      const cleaned = candlesDraft
        .filter((c) => (c.name || '').trim() !== '')
        .slice(0, 10)
        .map((c) => ({
          name: c.name.trim(),
          type: c.type || 'عادي درجة اولى',
          duration_months: Number(c.duration_months) || 1,
          price: Number(c.price) || 0,
        }));
      const db = supabase as any;
      const { error } = await db
        .from('customer_devices')
        .update({ candles: cleaned })
        .eq('id', device.id);
      if (error) throw error;
      toast({ title: 'تم حفظ بيانات الشمعات' });
      setEditCandles(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const refreshInstallments = async () => {
    const db = supabase as any;
    const res = await db.from('installments').select('*').eq('device_id', device.id).order('installment_date', { ascending: true });
    setInstallments((res.data || []) as Installment[]);
  };

  const [rebuildingInstallments, setRebuildingInstallments] = useState(false);

  const rebuildInstallments = async (opts?: { skipConfirm?: boolean }) => {
    const contractVal = Number(deviceForm.contract_value ?? deviceForm.total_price) || 0;
    const intervalMonths = Math.max(1, Number(deviceForm.contract_installment_interval_months) || 1);
    const customAmounts = parseInstallmentAmounts(deviceForm.maintenance_installments_text);
    const count = customAmounts.length > 0 ? customAmounts.length : Number(deviceForm.installments_count) || 0;
    if (count <= 0 || contractVal <= 0) {
      toast({ title: 'تنبيه', description: 'يجب تحديد قيمة العقد وعدد الأقساط أولاً من تعديل العقد أو البلوك أعلاه', variant: 'destructive' });
      return;
    }
    if (!opts?.skipConfirm && !confirm(`سيتم حذف جميع الأقساط الحالية (${installments.length}) وإنشاء ${count} قسط جديد. متأكد؟`)) return;
    setRebuildingInstallments(true);
    try {
      await (supabase as any).from('installments').delete().eq('device_id', device.id);
      const perInst = Math.round((contractVal / count) * 100) / 100;
      const startDate = deviceForm.first_installment_date || deviceForm.contract_start_date || new Date().toISOString().slice(0, 10);
      const rows = Array.from({ length: count }, (_, i) => {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i * intervalMonths);
        return {
          id: crypto.randomUUID(),
          customer_id: customerId,
          device_id: device.id,
          installment_date: d.toISOString().slice(0, 10),
          amount: customAmounts[i] ?? perInst,
          status: 'معلق',
          collection_date: null,
        };
      });
      await (supabase as any).from('installments').insert(rows as any);
      await refreshInstallments();
      toast({ title: customAmounts.length > 0 ? `تم إنشاء ${count} قسط بمبالغ مخصصة` : `تم إنشاء ${count} قسط بقيمة ${perInst} ج.م لكل قسط` });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setRebuildingInstallments(false);
    }
  };

  const toggleInstallmentStatus = async (inst: Installment) => {
    try {
      setInstallmentSavingId(inst.id);
      const done = inst.status === 'تمت';
      const { error } = await (supabase as any)
        .from('installments')
        .update({
          status: done ? 'معلق' : 'تمت',
          collection_date: done ? null : new Date().toISOString().slice(0, 10),
        } as any)
        .eq('id', inst.id);
      if (error) throw error;
      await refreshInstallments();
      toast({ title: done ? 'تم إرجاع الدفعة إلى معلق' : 'تم تسجيل الدفعة كمدفوعة' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setInstallmentSavingId(null);
    }
  };

  const updateInstallmentCollectionDate = async (inst: Installment) => {
    const nextDate = window.prompt(
      'تعديل تاريخ التحصيل (YYYY-MM-DD):',
      String(inst.collection_date || new Date().toISOString().slice(0, 10)),
    );
    if (!nextDate) return;
    try {
      setInstallmentSavingId(inst.id);
      const { error } = await (supabase as any)
        .from('installments')
        .update({
          collection_date: nextDate,
          status: inst.status === 'تمت' ? 'تمت' : 'تمت',
        } as any)
        .eq('id', inst.id);
      if (error) throw error;
      await refreshInstallments();
      toast({ title: 'تم تعديل تاريخ التحصيل' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setInstallmentSavingId(null);
    }
  };

  const updateInstallmentAmount = async (inst: Installment) => {
    const nextAmount = window.prompt('قيمة القسط الجديدة:', String(Number(inst.amount) || 0));
    if (!nextAmount) return;
    const amount = Number(nextAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'خطأ', description: 'قيمة القسط غير صحيحة', variant: 'destructive' });
      return;
    }
    try {
      setInstallmentSavingId(inst.id);
      const { error } = await (supabase as any)
        .from('installments')
        .update({ amount } as any)
        .eq('id', inst.id);
      if (error) throw error;
      await refreshInstallments();
      toast({ title: 'تم تعديل قيمة القسط' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setInstallmentSavingId(null);
    }
  };

  const saveDeviceContract = async (opts?: { fromContractStrip?: boolean }): Promise<boolean> => {
    try {
      setDeviceSaving(true);
      const nextCustomerName = deviceForm.customer_name.trim();
      if (!nextCustomerName) {
        toast({ title: 'خطأ', description: 'اسم العميل مطلوب', variant: 'destructive' });
        return false;
      }
      const payload = {
        product_name: deviceForm.product_name.trim(),
        device_type: deviceForm.device_type.trim(),
        serial_number: deviceForm.serial_number.trim(),
        install_date: deviceForm.install_date || null,
        warranty_months: Math.max(1, Number(deviceForm.warranty_months) || 12),
        contract_type: deviceForm.contract_type || 'كاش',
        selling_price: Number(deviceForm.selling_price) || 0,
        total_price: Number(deviceForm.total_price) || 0,
        contract_value: Number(deviceForm.contract_value || deviceForm.total_price) || 0,
        contract_duration_months: Math.max(0, Number(deviceForm.contract_duration_months) || 0),
        contract_start_date: deviceForm.contract_start_date || deviceForm.install_date || null,
        contract_end_date: deviceForm.contract_end_date || calcContractEndDate(deviceForm.contract_start_date || deviceForm.install_date, deviceForm.contract_duration_months) || null,
        contract_first_visit_date: deviceForm.contract_first_visit_date || null,
        contract_installment_interval_months: Math.max(1, Number(deviceForm.contract_installment_interval_months) || 1),
        installments_count: parseInstallmentAmounts(deviceForm.maintenance_installments_text).length || Number(deviceForm.installments_count) || 0,
        installment_amount: Number(deviceForm.installment_amount) || parseInstallmentAmounts(deviceForm.maintenance_installments_text)[0] || 0,
        first_installment_date: deviceForm.first_installment_date || null,
        customer_code: deviceForm.customer_code.trim(),
        ad_source: deviceForm.ad_source.trim(),
        notes: deviceForm.notes.trim(),
        branch: deviceForm.branch || 'فرع الإسكندرية',
      };
      const { error } = await (supabase as any).from('customer_devices').update(payload as any).eq('id', device.id);
      if (error) throw error;
      if (nextCustomerName !== customerName.trim()) {
        await syncCustomerDisplayName(customerId, customerName, nextCustomerName);
        onCustomerNameChange?.(nextCustomerName);
      }
      toast({ title: 'تم تعديل بيانات العقد/الجهاز' });
      if (!opts?.fromContractStrip) setEditDeviceOpen(false);
      onRefresh();
      return true;
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setDeviceSaving(false);
    }
  };

  const applyEqualInstallmentPreview = () => {
    const contractVal = Number(deviceForm.contract_value ?? deviceForm.total_price) || 0;
    const count = Number(deviceForm.installments_count) || 0;
    if (count <= 0 || contractVal <= 0) {
      toast({ title: 'تنبيه', description: 'أدخل قيمة العقد وعدد الأقساط أولاً', variant: 'destructive' });
      return;
    }
    const per = Math.round((contractVal / count) * 100) / 100;
    setDeviceForm((p) => ({ ...p, installment_amount: String(per) }));
    toast({ title: 'تقسيم بالتساوي', description: `${per} ج.م لكل دفعة (${count} دفعات)` });
  };

  const saveContractAndRebuildInstallments = async () => {
    const ok = await saveDeviceContract({ fromContractStrip: true });
    if (!ok) return;
    await rebuildInstallments({ skipConfirm: true });
  };

  const formContractPreview = Number(deviceForm.contract_value || deviceForm.total_price || 0) || 0;
  const formInstallmentsPaidTotal = installments
    .filter((x) => x.status === 'تمت')
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const formInstallmentsRemainingTotal = Math.max(0, formContractPreview - formInstallmentsPaidTotal);

  const installmentContractUi = deviceForm.contract_type === 'تقسيط' || deviceForm.contract_type === 'عقد صيانة';

  const previewEndDateStr =
    deviceForm.contract_end_date ||
    (deviceForm.contract_start_date ? calcContractEndDate(deviceForm.contract_start_date, deviceForm.contract_duration_months) : '') ||
    '';

  const cashMaintenanceContractHint =
    deviceForm.contract_type === 'كاش' ? (
      <div className="rounded-lg border-2 border-dashed border-sky-300 bg-sky-50/50 dark:bg-sky-950/20 p-3 space-y-2 text-[11px]">
        <p className="font-semibold text-sky-900 dark:text-sky-200">عقد صيانة — تقسيم المبلغ على دفعات</p>
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          لعرض قائمة الأقساط بجانب الصيانة وجدول الدفعات الأربعة (التاريخ — الدفعة — التحصيل — الحالة) مع المحصّل والباقي هنا، اضبط عقد صيانة ثم احفظ وأنشئ الأقساط.
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            setDeviceForm((p) => ({
              ...p,
              contract_type: 'عقد صيانة',
              contract_value: Number(p.contract_value) > 0 ? p.contract_value : p.total_price || '0',
              contract_start_date: p.contract_start_date || p.install_date || today,
              contract_duration_months: p.contract_duration_months === '0' ? '12' : p.contract_duration_months || '12',
              installments_count: !p.installments_count || p.installments_count === '0' ? '4' : p.installments_count,
              contract_installment_interval_months: p.contract_type === 'كاش' ? '3' : p.contract_installment_interval_months || '3',
              first_installment_date: p.first_installment_date || p.install_date || today,
            }));
            setMaintenanceContractPanelOpen(true);
          }}
        >
          بدء عقد صيانة وتقسيم المبلغ
        </Button>
      </div>
    ) : null;

  const contractSummaryStandaloneCard = !installmentContractUi ? null : (
    <div className="rounded-lg border-2 border-sky-200 dark:border-sky-800 overflow-hidden bg-card">
      <div className="bg-sky-50 dark:bg-sky-950/30 px-3 py-2 border-b border-sky-200 dark:border-sky-800">
        <h4 className="text-xs font-bold text-sky-800 dark:text-sky-300">بيانات العقد — تعديل كل بند</h4>
      </div>
      <div className="p-3 space-y-3 text-[11px]">
        <div className="space-y-2 rounded-md border border-sky-100 dark:border-sky-900 bg-sky-50/30 dark:bg-sky-950/20 p-2.5">
          <div className="flex flex-wrap items-end gap-1 pb-1 border-b border-sky-100 dark:border-sky-900">
            <span className="text-muted-foreground shrink-0 min-w-[72px]">اسم العميل</span>
            <Input
              className="h-7 text-xs flex-1 min-w-[140px]"
              value={deviceForm.customer_name}
              onChange={(e) => setDeviceForm((p) => ({ ...p, customer_name: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span className="font-bold text-sm text-sky-900 dark:text-sky-100">
              {deviceForm.contract_type === 'عقد صيانة' ? 'عقد صيانة' : 'عقد تقسيط'}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">مدته</span>
            <span className="inline-block min-w-[2rem] border-b-2 border-dotted border-sky-600/50 px-1 text-center font-semibold">
              {deviceForm.contract_duration_months || '—'}
            </span>
            <span>شهر</span>
            <span className="text-muted-foreground mx-0.5">|</span>
            <span className="text-muted-foreground shrink-0">ينتهى فى</span>
            <span className="min-w-[6rem] flex-1 border-b-2 border-dotted border-sky-600/50 px-1 text-center font-semibold">
              {previewEndDateStr ? formatDateDisplay(previewEndDateStr) : '—'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-wrap items-end gap-1">
              <span className="text-muted-foreground shrink-0">قيمة العقد</span>
              <span className="flex-1 border-b-2 border-dotted border-sky-600/50 text-center font-semibold">{formatEGP(formContractPreview)}</span>
            </div>
            <div className="flex flex-wrap items-end gap-1">
              <span className="text-muted-foreground shrink-0">عدد أقساط العقد</span>
              <span className="flex-1 border-b-2 border-dotted border-sky-600/50 text-center font-semibold">
                {deviceForm.installments_count || (installments.length ? String(installments.length) : '—')}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-wrap items-end gap-1">
              <span className="text-muted-foreground shrink-0 min-w-[92px]">تاريخ أول دفعة</span>
              <span className="flex-1 border-b-2 border-dotted border-sky-600/50 text-center font-semibold">
                {deviceForm.first_installment_date
                  ? formatDateDisplay(deviceForm.first_installment_date)
                  : installments.length > 0
                    ? formatDateDisplay(installments[0].installment_date)
                    : '—'}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-1">
              <span className="text-muted-foreground shrink-0">فترة الأقساط</span>
              <span className="flex-1 border-b-2 border-dotted border-sky-600/50 text-center font-semibold">
                {installmentIntervalAr(Number(deviceForm.contract_installment_interval_months) || 1)}
              </span>
            </div>
          </div>
          {deviceForm.contract_type === 'عقد صيانة' && deviceForm.contract_first_visit_date && (
            <div className="flex flex-wrap items-end gap-1 border-t border-sky-100 dark:border-sky-900 pt-1.5">
              <span className="text-muted-foreground min-w-[88px]">تاريخ أول زيارة</span>
              <span className="flex-1 border-b-2 border-dotted border-sky-600/50 text-center font-semibold">
                {formatDateDisplay(deviceForm.contract_first_visit_date)}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">نوع العقد</Label>
              <Select value={deviceForm.contract_type} onValueChange={(v) => setDeviceForm((p) => ({ ...p, contract_type: v }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="كاش">كاش</SelectItem>
                  <SelectItem value="تقسيط">تقسيط</SelectItem>
                  <SelectItem value="عقد صيانة">عقد صيانة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">مدة العقد (شهر)</Label>
              <Input
                type="number"
                min={0}
                className="h-8 text-xs"
                value={deviceForm.contract_duration_months}
                onChange={(e) => setDeviceForm((p) => ({ ...p, contract_duration_months: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px]">ينتهى فى</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={
                  deviceForm.contract_end_date ||
                  (deviceForm.contract_start_date
                    ? calcContractEndDate(deviceForm.contract_start_date, deviceForm.contract_duration_months) || ''
                    : '')
                }
                onChange={(e) => setDeviceForm((p) => ({ ...p, contract_end_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">بداية العقد</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={deviceForm.contract_start_date}
                onChange={(e) => setDeviceForm((p) => ({ ...p, contract_start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">قيمة العقد (ج.م)</Label>
              <Input
                type="number"
                min={0}
                className="h-8 text-xs"
                value={deviceForm.contract_value}
                onChange={(e) => setDeviceForm((p) => ({ ...p, contract_value: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">عدد أقساط العقد</Label>
              <Input
                type="number"
                min={0}
                className="h-8 text-xs"
                value={deviceForm.installments_count}
                onChange={(e) => setDeviceForm((p) => ({ ...p, installments_count: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">تاريخ أول دفعة</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={deviceForm.first_installment_date}
                onChange={(e) => setDeviceForm((p) => ({ ...p, first_installment_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">فترة الأقساط (كل شهر / 2 / 3…)</Label>
              <Select
                value={String(Math.max(1, Number(deviceForm.contract_installment_interval_months) || 1))}
                onValueChange={(v) => setDeviceForm((p) => ({ ...p, contract_installment_interval_months: String(Number(v) || 1) }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">كل شهر</SelectItem>
                  <SelectItem value="2">كل شهرين</SelectItem>
                  <SelectItem value="3">كل 3 شهور</SelectItem>
                  <SelectItem value="6">كل 6 شهور</SelectItem>
                  <SelectItem value="12">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {deviceForm.contract_type === 'عقد صيانة' ? (
              <div className="space-y-1">
                <Label className="text-[10px]">تاريخ أول زيارة</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={deviceForm.contract_first_visit_date}
                  onChange={(e) => setDeviceForm((p) => ({ ...p, contract_first_visit_date: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-[10px]">قيمة القسط (ج.م)</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-xs"
                  value={deviceForm.installment_amount}
                  onChange={(e) => setDeviceForm((p) => ({ ...p, installment_amount: e.target.value }))}
                />
              </div>
            )}
          </div>
          {deviceForm.contract_type === 'عقد صيانة' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">قيمة القسط (ج.م)</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-xs"
                  value={deviceForm.installment_amount}
                  onChange={(e) => setDeviceForm((p) => ({ ...p, installment_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px]">مبالغ الأقساط المخصصة</Label>
                <Input
                  className="h-8 text-xs"
                  dir="ltr"
                  value={deviceForm.maintenance_installments_text}
                  onChange={(e) => setDeviceForm((p) => ({
                    ...p,
                    maintenance_installments_text: e.target.value,
                    installments_count: parseInstallmentAmounts(e.target.value).length
                      ? String(parseInstallmentAmounts(e.target.value).length)
                      : p.installments_count,
                  }))}
                  placeholder="مثال: 350, 400, 500, 250"
                />
                <p className="text-[10px] text-muted-foreground">
                  لو كتبت مبالغ هنا، سيتم إنشاء الأقساط بهذه القيم بدل التقسيم المتساوي.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t">
            <div className="text-center p-1.5 rounded bg-sky-100 dark:bg-sky-900/30">
              <span className="text-muted-foreground block text-[10px]">إجمالي</span>
              <strong className="text-sm">{formatEGP(formContractPreview)}</strong>
            </div>
            <div className="text-center p-1.5 rounded bg-green-100 dark:bg-green-900/30">
              <span className="text-muted-foreground block text-[10px]">محصّل</span>
              <strong className="text-sm text-green-700">{formatEGP(formInstallmentsPaidTotal)}</strong>
            </div>
            <div className="text-center p-1.5 rounded bg-amber-100 dark:bg-amber-900/30">
              <span className="text-muted-foreground block text-[10px]">باقي</span>
              <strong className="text-sm text-amber-800">{formatEGP(formInstallmentsRemainingTotal)}</strong>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px]" onClick={applyEqualInstallmentPreview}>
              تقسيم المبلغ بالتساوي على عدد الأقساط
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => saveDeviceContract({ fromContractStrip: true })} disabled={deviceSaving}>
              {deviceSaving ? 'جاري الحفظ...' : 'حفظ بيانات العقد'}
            </Button>
            <Button type="button" size="sm" className="h-7 text-[11px]" onClick={saveContractAndRebuildInstallments} disabled={deviceSaving || rebuildingInstallments}>
              {deviceSaving || rebuildingInstallments ? 'جاري التنفيذ...' : 'حفظ وإنشاء جدول الأقساط'}
            </Button>
          </div>
        </div>
      </div>
  );

  const contractSummaryEditableBlock = contractSummaryStandaloneCard;

  const maintenanceCollapsibleContract = !installmentContractUi ? null : (
    <Collapsible open={maintenanceContractPanelOpen} onOpenChange={setMaintenanceContractPanelOpen} className="space-y-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-lg border-2 border-sky-200 dark:border-sky-800 bg-sky-100/80 dark:bg-sky-900/40 px-3 py-2.5 text-right text-xs font-bold text-sky-900 dark:text-sky-100 shadow-sm hover:bg-sky-100 dark:hover:bg-sky-900/60"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <div>عقد صيانة / التقسيط — بيانات العقد والتقسيم</div>
            <div className="text-[10px] font-normal text-muted-foreground">
              محصّل {formatEGP(formInstallmentsPaidTotal)} — باقي {formatEGP(formInstallmentsRemainingTotal)} — اضغط للعرض أو الطي
            </div>
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', maintenanceContractPanelOpen && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">{contractSummaryStandaloneCard}</CollapsibleContent>
    </Collapsible>
  );

  return (
    <Card className="border-primary/20">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            {device.product_name} {device.device_type && `- ${device.device_type}`}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant={isWarrantyActive ? 'default' : 'destructive'} className="text-[10px]">
              {isWarrantyActive ? 'ضمان ساري' : 'ضمان منتهي'}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => setEditDeviceOpen((v) => !v)}
            >
              {editDeviceOpen ? 'إغلاق التعديل' : 'تعديل العقد'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px] text-muted-foreground mt-1">
          {device.serial_number && <span>مسلسل: {device.serial_number}</span>}
          {device.install_date && <span>التركيب: {formatDateDisplay(device.install_date)}</span>}
          <span>الضمان: {device.warranty_months} شهر</span>
          {warrantyEnd && <span>حتى: {formatDateDisplay(warrantyEnd)}</span>}
          <span>العقد: {device.contract_type}</span>
          {device.contract_type === 'عقد صيانة' && (device.contract_value || device.total_price) > 0 && <span>قيمة العقد: {formatEGP(Number(device.contract_value ?? device.total_price))}</span>}
          {device.contract_type === 'عقد صيانة' && (device.contract_duration_months || 0) > 0 && <span>مدة العقد: {device.contract_duration_months} شهر</span>}
          {device.contract_type === 'عقد صيانة' && device.contract_start_date && <span>بداية العقد: {formatDateDisplay(device.contract_start_date)}</span>}
          {device.contract_type === 'عقد صيانة' && (device.contract_end_date || device.contract_start_date) && <span>نهاية العقد: {formatDateDisplay(device.contract_end_date || calcContractEndDate(device.contract_start_date, device.contract_duration_months))}</span>}
          {device.contract_type === 'عقد صيانة' && device.contract_first_visit_date && <span>أول زيارة: {formatDateDisplay(device.contract_first_visit_date)}</span>}
          {device.selling_price > 0 && <span>السعر: {formatEGP(device.selling_price)}</span>}
          {device.total_price > 0 && <span>الإجمالي: {formatEGP(device.total_price)}</span>}
          {device.branch && <span>الفرع: {device.branch}</span>}
          {device.customer_code && <span>كود: {device.customer_code}</span>}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {editDeviceOpen && (
          <div className="mb-3 p-3 border rounded-lg bg-muted/20 space-y-2">
            <h4 className="text-xs font-semibold">تعديل بيانات العقد / الجهاز</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Label className="text-xs">اسم العميل</Label><Input className="h-8 text-sm" value={deviceForm.customer_name} onChange={e => setDeviceForm(p => ({ ...p, customer_name: e.target.value }))} /></div>
              <div><Label className="text-xs">اسم المنتج</Label><Input className="h-8 text-sm" value={deviceForm.product_name} onChange={e => setDeviceForm(p => ({ ...p, product_name: e.target.value }))} /></div>
              <div><Label className="text-xs">نوع الجهاز</Label><Input className="h-8 text-sm" value={deviceForm.device_type} onChange={e => setDeviceForm(p => ({ ...p, device_type: e.target.value }))} /></div>
              <div><Label className="text-xs">الرقم المسلسل</Label><Input className="h-8 text-sm" value={deviceForm.serial_number} onChange={e => setDeviceForm(p => ({ ...p, serial_number: e.target.value }))} /></div>
              <div><Label className="text-xs">تاريخ التركيب</Label><Input type="date" className="h-8 text-sm" value={deviceForm.install_date} onChange={e => setDeviceForm(p => ({ ...p, install_date: e.target.value }))} /></div>
              <div><Label className="text-xs">مدة الضمان (شهر)</Label><Input type="number" min={1} className="h-8 text-sm" value={deviceForm.warranty_months} onChange={e => setDeviceForm(p => ({ ...p, warranty_months: e.target.value }))} /></div>
              <div><Label className="text-xs">نوع العقد</Label>
                <Select value={deviceForm.contract_type} onValueChange={v => setDeviceForm(p => ({ ...p, contract_type: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="كاش">كاش</SelectItem>
                    <SelectItem value="تقسيط">تقسيط</SelectItem>
                    <SelectItem value="عقد صيانة">عقد صيانة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">سعر البيع</Label><Input type="number" min={0} className="h-8 text-sm" value={deviceForm.selling_price} onChange={e => setDeviceForm(p => ({ ...p, selling_price: e.target.value }))} /></div>
              <div><Label className="text-xs">الإجمالي</Label><Input type="number" min={0} className="h-8 text-sm" value={deviceForm.total_price} onChange={e => setDeviceForm(p => ({ ...p, total_price: e.target.value }))} /></div>
              {deviceForm.contract_type === 'عقد صيانة' && (
                <>
                  <div><Label className="text-xs">قيمة العقد</Label><Input type="number" min={0} className="h-8 text-sm" value={deviceForm.contract_value} onChange={e => setDeviceForm(p => ({ ...p, contract_value: e.target.value }))} /></div>
                  <div><Label className="text-xs">مدة العقد (شهر)</Label><Input type="number" min={0} className="h-8 text-sm" value={deviceForm.contract_duration_months} onChange={e => setDeviceForm(p => ({ ...p, contract_duration_months: e.target.value }))} /></div>
                  <div><Label className="text-xs">بداية العقد</Label><Input type="date" className="h-8 text-sm" value={deviceForm.contract_start_date} onChange={e => setDeviceForm(p => ({ ...p, contract_start_date: e.target.value }))} /></div>
                  <div><Label className="text-xs">نهاية العقد</Label><Input type="date" className="h-8 text-sm" value={deviceForm.contract_end_date || (deviceForm.contract_start_date ? calcContractEndDate(deviceForm.contract_start_date, deviceForm.contract_duration_months) : '')} onChange={e => setDeviceForm(p => ({ ...p, contract_end_date: e.target.value }))} /></div>
                  <div><Label className="text-xs">تاريخ أول زيارة</Label><Input type="date" className="h-8 text-sm" value={deviceForm.contract_first_visit_date} onChange={e => setDeviceForm(p => ({ ...p, contract_first_visit_date: e.target.value }))} /></div>
                  <div><Label className="text-xs">فاصل الأقساط (بالشهور)</Label><Input type="number" min={1} className="h-8 text-sm" value={deviceForm.contract_installment_interval_months} onChange={e => setDeviceForm(p => ({ ...p, contract_installment_interval_months: e.target.value }))} /></div>
                </>
              )}
              <div><Label className="text-xs">عدد الأقساط</Label><Input type="number" min={0} className="h-8 text-sm" value={deviceForm.installments_count} onChange={e => setDeviceForm(p => ({ ...p, installments_count: e.target.value }))} /></div>
              <div><Label className="text-xs">قيمة القسط</Label><Input type="number" min={0} className="h-8 text-sm" value={deviceForm.installment_amount} onChange={e => setDeviceForm(p => ({ ...p, installment_amount: e.target.value }))} /></div>
              <div className="col-span-2">
                <Label className="text-xs">مبالغ الأقساط المخصصة</Label>
                <Input
                  dir="ltr"
                  className="h-8 text-sm"
                  value={deviceForm.maintenance_installments_text}
                  onChange={(e) => setDeviceForm((p) => ({
                    ...p,
                    maintenance_installments_text: e.target.value,
                    installments_count: parseInstallmentAmounts(e.target.value).length
                      ? String(parseInstallmentAmounts(e.target.value).length)
                      : p.installments_count,
                  }))}
                  placeholder="مثال: 350, 400, 500"
                />
              </div>
              <div><Label className="text-xs">تاريخ أول قسط</Label><Input type="date" className="h-8 text-sm" value={deviceForm.first_installment_date} onChange={e => setDeviceForm(p => ({ ...p, first_installment_date: e.target.value }))} /></div>
              <div><Label className="text-xs">كود العميل</Label><Input className="h-8 text-sm" value={deviceForm.customer_code} onChange={e => setDeviceForm(p => ({ ...p, customer_code: e.target.value }))} /></div>
              <div><Label className="text-xs">مصدر الإعلان</Label><Input className="h-8 text-sm" value={deviceForm.ad_source} onChange={e => setDeviceForm(p => ({ ...p, ad_source: e.target.value }))} /></div>
              <div><Label className="text-xs">الفرع</Label>
                <Select value={deviceForm.branch} onValueChange={v => setDeviceForm(p => ({ ...p, branch: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="فرع الإسكندرية">فرع الإسكندرية</SelectItem>
                    <SelectItem value="فرع الجيزة">فرع الجيزة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">ملاحظات</Label><Textarea className="text-sm min-h-[50px]" value={deviceForm.notes} onChange={e => setDeviceForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDeviceOpen(false)}>إلغاء</Button>
              <Button type="button" onClick={() => saveDeviceContract()} disabled={deviceSaving}>{deviceSaving ? 'جاري الحفظ...' : 'حفظ التعديل'}</Button>
            </div>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 h-7">
            <TabsTrigger value="candles" className="text-[10px] py-0.5">بيان الشمعات</TabsTrigger>
            <TabsTrigger value="maintenance" className="text-[10px] py-0.5">بيان الصيانات ({candleChanges.length})</TabsTrigger>
            {(deviceForm.contract_type === 'تقسيط' || deviceForm.contract_type === 'عقد صيانة') && (
              <TabsTrigger value="installments" className="text-[10px] py-0.5">الأقساط ({installments.length})</TabsTrigger>
            )}
          </TabsList>

          {/* Candle Specs */}
          <TabsContent value="candles" className="mt-2">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground">بيان الشمعات (حتى 10 شمعات)</h4>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => setEditCandles((v) => !v)}
              >
                {editCandles ? 'إلغاء التعديل' : 'تعديل الشمعات'}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border p-1 text-right">#</th>
                    <th className="border p-1 text-right">الشمعة</th>
                    <th className="border p-1 text-right">النوع</th>
                    <th className="border p-1 text-right">المدة (شهر)</th>
                    <th className="border p-1 text-right">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {(editCandles ? candlesDraft : candles).map((c: Candle, i: number) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="border p-1">{i + 1}</td>
                      <td className="border p-1">
                        {editCandles ? (
                          <Input
                            className="h-7 text-[11px]"
                            value={candlesDraft[i]?.name || ''}
                            onChange={(e) =>
                              setCandlesDraft((prev) => {
                                const next = [...prev];
                                next[i] = { ...next[i], name: e.target.value };
                                return next;
                              })
                            }
                          />
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="border p-1">
                        {editCandles ? (
                          <Select
                            value={candlesDraft[i]?.type || 'عادي درجة اولى'}
                            onValueChange={(v) =>
                              setCandlesDraft((prev) => {
                                const next = [...prev];
                                next[i] = { ...next[i], type: v };
                                return next;
                              })
                            }
                          >
                            <SelectTrigger className="h-7 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {candleTypeNames.map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          c.type
                        )}
                      </td>
                      <td className="border p-1">
                        {editCandles ? (
                          <Input
                            type="number"
                            min={1}
                            className="h-7 text-[11px]"
                            value={candlesDraft[i]?.duration_months ?? 1}
                            onChange={(e) =>
                              setCandlesDraft((prev) => {
                                const next = [...prev];
                                next[i] = { ...next[i], duration_months: Number(e.target.value) || 1 };
                                return next;
                              })
                            }
                          />
                        ) : (
                          `${c.duration_months} شهر`
                        )}
                      </td>
                      <td className="border p-1">
                        {editCandles ? (
                          <Input
                            type="number"
                            min={0}
                            className="h-7 text-[11px]"
                            value={candlesDraft[i]?.price ?? 0}
                            onChange={(e) =>
                              setCandlesDraft((prev) => {
                                const next = [...prev];
                                next[i] = { ...next[i], price: Number(e.target.value) || 0 };
                                return next;
                              })
                            }
                          />
                        ) : (
                          `${c.price} ج.م`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editCandles && (
              <div className="flex justify-between items-center mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  disabled={candlesDraft.length >= 10}
                  onClick={() =>
                    setCandlesDraft((prev) =>
                      prev.length >= 10
                        ? prev
                        : [
                            ...prev,
                            {
                              name: `الشمعة ${prev.length + 1}`,
                              type: candleTypeNames[0] || 'عادي درجة اولى',
                              duration_months: 3,
                              price: 0,
                            },
                          ],
                    )
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> إضافة شمعة
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 text-[11px]"
                  onClick={handleSaveCandles}
                >
                  حفظ بيانات الشمعات
                </Button>
              </div>
            )}
            <div className="mt-3 border-t pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => setShowCandleTypesManager(v => !v)}
              >
                <Edit className="h-3 w-3" /> {showCandleTypesManager ? 'إخفاء' : 'إدارة أنواع الشمعات'}
              </Button>
              {showCandleTypesManager && (
                <div className="mt-2 space-y-2 p-2 border rounded-lg bg-muted/20">
                  <h5 className="text-xs font-semibold">أنواع الشمعات (اضافة / تعديل / حذف)</h5>
                  <div className="space-y-1">
                    {candleTypes.map(ct => (
                      <div key={ct.id} className="flex items-center justify-between text-xs bg-background p-1.5 rounded border">
                        <span>{ct.name} — {ct.duration_months} شهر — {ct.price} ج.م</span>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setEditingCandleType(ct);
                            setCandleTypeForm({ name: ct.name, duration_months: String(ct.duration_months), price: String(ct.price) });
                          }}><Edit className="h-3 w-3" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteCandleType(ct)}>
                            <span className="text-xs">✕</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="اسم النوع" value={candleTypeForm.name} onChange={e => setCandleTypeForm(p => ({ ...p, name: e.target.value }))} className="h-7 text-xs" />
                    <Input type="number" placeholder="المدة (شهر)" value={candleTypeForm.duration_months} onChange={e => setCandleTypeForm(p => ({ ...p, duration_months: e.target.value }))} className="h-7 text-xs" />
                    <Input type="number" placeholder="السعر" value={candleTypeForm.price} onChange={e => setCandleTypeForm(p => ({ ...p, price: e.target.value }))} className="h-7 text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="h-7 text-xs flex-1" onClick={handleSaveCandleType} disabled={candleTypeSaving}>
                      {candleTypeSaving ? '...' : editingCandleType ? 'تعديل النوع' : 'إضافة نوع جديد'}
                    </Button>
                    {editingCandleType && (
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditingCandleType(null); setCandleTypeForm({ name: '', duration_months: '3', price: '0' }); }}>إلغاء</Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Maintenance History */}
          <TabsContent value="maintenance" className="mt-2 space-y-2">
            <Button size="sm" variant="outline" className="w-full gap-1 text-xs h-7" onClick={() => { setShowAddMaint(!showAddMaint); setEditingChangeId(null); }}>
              <Plus className="h-3 w-3" /> تسجيل صيانة
            </Button>
            {showAddMaint && !editingChangeId && (
              <AddCandleChangeForm
                deviceId={device.id}
                device={device}
                customerId={customerId}
                customerName={customerName}
                deviceName={device.product_name}
                customerPhone={customerPhone}
                customerPhone2={customerPhone2}
                customerAddress={customerAddress}
                customerRegion={customerRegion}
                branch={device.branch || 'فرع الإسكندرية'}
                onSaved={() => {
                  setShowAddMaint(false);
                  (supabase as any).from('candle_changes').select('*').eq('device_id', device.id).order('change_date', { ascending: false })
                    .then((res: any) => setCandleChanges((res.data || []) as CandleChange[]));
                }}
              />
            )}
            {editingChangeId && (() => {
              const record = candleChanges.find(cc => cc.id === editingChangeId);
              if (!record) return null;
              return (
                <EditCandleChangeForm
                  record={record}
                  onSaved={() => {
                    setEditingChangeId(null);
                    (supabase as any).from('candle_changes').select('*').eq('device_id', device.id).order('change_date', { ascending: false })
                      .then((res: any) => setCandleChanges((res.data || []) as CandleChange[]));
                  }}
                  onCancel={() => setEditingChangeId(null)}
                />
              );
            })()}
            {(() => {
              const maintRowStatus = (cc: CandleChange) => {
                const rem = Number(cc.remaining) || 0;
                const col = Number(cc.collected) || 0;
                const cost = Number(cc.cost) || 0;
                if (cost > 0 && rem <= 0) return 'مغلق';
                if (col > 0) return 'جزئي';
                return 'مفتوح';
              };
              const maintRowType = (cc: CandleChange) => {
                const n = [cc.candle1, cc.candle2, cc.candle3, cc.candle4, cc.candle5, cc.candle6, cc.candle7, cc.candle8, cc.candle9, cc.candle10].filter(Boolean).length;
                return n > 0 ? `صيانة شمعات (${n})` : 'صيانة';
              };
              const showSideBySide = deviceForm.contract_type === 'تقسيط' || deviceForm.contract_type === 'عقد صيانة';
              const maintSummaryTable = (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-[10px] border-collapse min-w-[520px]">
                    <thead>
                      <tr className="bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200">
                        <th className="border p-1.5 font-bold">التاريخ</th>
                        <th className="border p-1.5 font-bold">النوع</th>
                        <th className="border p-1.5 font-bold">الحالة</th>
                        <th className="border p-1.5 font-bold">المندوب / الفني</th>
                        <th className="border p-1.5 font-bold">القيمة</th>
                        <th className="border p-1.5 font-bold">محصل</th>
                        <th className="border p-1.5 font-bold">بواقي</th>
                        <th className="border p-1.5 font-bold">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candleChanges.length === 0 ? (
                        <tr><td colSpan={8} className="border p-2 text-center text-muted-foreground">لا توجد سجلات صيانة</td></tr>
                      ) : (
                        candleChanges.map((cc) => (
                          <tr key={cc.id} className={`hover:bg-muted/30 ${editingChangeId === cc.id ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}>
                            <td className="border p-1.5 font-semibold whitespace-nowrap">{formatDateDisplay(cc.change_date)}</td>
                            <td className="border p-1.5">{maintRowType(cc)}</td>
                            <td className="border p-1.5"><Badge variant="outline" className="text-[9px]">{maintRowStatus(cc)}</Badge></td>
                            <td className="border p-1.5">{cc.technician || '-'}</td>
                            <td className="border p-1.5 font-bold">{Number(cc.cost || 0).toLocaleString('ar-EG')}</td>
                            <td className="border p-1.5 text-green-700 font-semibold">{Number(cc.collected || 0).toLocaleString('ar-EG')}</td>
                            <td className="border p-1.5 text-amber-800 font-semibold">{Number(cc.remaining || 0).toLocaleString('ar-EG')}</td>
                            <td className="border p-1.5 text-center whitespace-nowrap">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingChangeId(cc.id); setShowAddMaint(false); }} title="تعديل"><Edit className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteMaintRecord(cc)} title="حذف"><Trash2 className="h-3 w-3" /></Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              );
              const installmentsSideTable = showSideBySide && (
                <div className="rounded-md border-2 border-emerald-200 dark:border-emerald-800 overflow-hidden">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 border-b border-emerald-200 dark:border-emerald-800">
                    <h4 className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">بيان الأقساط (بجانب الصيانة)</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse min-w-[480px]">
                      <thead>
                        <tr className="bg-emerald-100/80 dark:bg-emerald-900/30">
                          <th className="border p-1 font-bold">التاريخ</th>
                          <th className="border p-1 font-bold">النوع</th>
                          <th className="border p-1 font-bold">الحالة</th>
                          <th className="border p-1 font-bold">المندوب</th>
                          <th className="border p-1 font-bold">القيمة</th>
                          <th className="border p-1 font-bold">محصل</th>
                          <th className="border p-1 font-bold">بواقي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.length === 0 ? (
                          <tr><td colSpan={7} className="border p-2 text-center text-muted-foreground">لا توجد أقساط مسجّلة</td></tr>
                        ) : (
                          installments.map((inst) => {
                            const amt = Number(inst.amount) || 0;
                            const done = inst.status === 'تمت';
                            const paid = done ? amt : 0;
                            const rem = done ? 0 : amt;
                            return (
                              <tr key={inst.id} className={done ? 'bg-green-50/50 dark:bg-green-950/10' : ''}>
                                <td className="border p-1 font-semibold">{formatDateDisplay(inst.installment_date)}</td>
                                <td className="border p-1">
                                  {deviceForm.contract_type === 'عقد صيانة' ? 'دفعة عقد صيانة' : 'دفعة تقسيط'}
                                </td>
                                <td className="border p-1"><Badge variant={done ? 'default' : 'secondary'} className="text-[9px]">{inst.status}</Badge></td>
                                <td className="border p-1 text-muted-foreground max-w-[100px] truncate" title={String((inst as Installment).sales_rep || '').trim() || undefined}>
                                  {String((inst as Installment).sales_rep || '').trim() || '—'}
                                </td>
                                <td className="border p-1 font-bold">{amt.toLocaleString('ar-EG')}</td>
                                <td className="border p-1 text-green-700">{paid.toLocaleString('ar-EG')}</td>
                                <td className="border p-1 text-amber-800">{rem.toLocaleString('ar-EG')}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );

              const installmentsFourColTable = showSideBySide && (
                <div className="overflow-x-auto rounded-lg border-2 border-sky-200 dark:border-sky-800 overflow-hidden">
                  {installments.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30">لا توجد أقساط مسجّلة — من تبويب «الأقساط» أو «تعديل العقد»</p>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200">
                          <th className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold">التاريخ</th>
                          <th className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold">الدفعة</th>
                          <th className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold">التحصيل</th>
                          <th className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((inst) => (
                          <tr key={`m4-${inst.id}`} className={`${inst.status === 'تمت' ? 'bg-green-50 dark:bg-green-950/20' : 'bg-white dark:bg-background'} hover:bg-muted/30`}>
                            <td className="border border-sky-200 dark:border-sky-700 p-1.5 font-semibold whitespace-nowrap">{formatDateDisplay(inst.installment_date)}</td>
                            <td className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold text-center">{Number(inst.amount).toLocaleString('ar-EG')}</td>
                            <td className="border border-sky-200 dark:border-sky-700 p-1.5 whitespace-nowrap">{inst.collection_date ? formatDateDisplay(inst.collection_date) : '—'}</td>
                            <td className="border border-sky-200 dark:border-sky-700 p-1.5">
                              <div className="flex flex-col gap-1 items-stretch sm:flex-row sm:items-center sm:gap-2">
                                <Badge variant={inst.status === 'تمت' ? 'default' : 'secondary'} className="text-[9px] w-fit">
                                  {inst.status}
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] shrink-0"
                                  disabled={installmentSavingId === inst.id}
                                  onClick={() => updateInstallmentAmount(inst)}
                                >
                                  تعديل المبلغ
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] shrink-0"
                                  disabled={installmentSavingId === inst.id}
                                  onClick={() => updateInstallmentCollectionDate(inst)}
                                >
                                  تعديل التحصيل
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={inst.status === 'تمت' ? 'outline' : 'default'}
                                  className="h-6 text-[10px] shrink-0"
                                  disabled={installmentSavingId === inst.id}
                                  onClick={() => toggleInstallmentStatus(inst)}
                                >
                                  {installmentSavingId === inst.id ? '...' : inst.status === 'تمت' ? 'إرجاع معلق' : 'تسجيل سداد'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );

              const detailCandlesTable = (
                <div className="overflow-x-auto mt-2">
                  <p className="text-[10px] text-muted-foreground mb-1">تفصيل الشمعات لكل زيارة</p>
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="border p-1">التاريخ</th>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (<th key={i} className="border p-1">ش{i}</th>))}
                        <th className="border p-1">TDS</th>
                        <th className="border p-1">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candleChanges.map((cc) => (
                        <tr key={`d-${cc.id}`}>
                          <td className="border p-1">{formatDateDisplay(cc.change_date)}</td>
                          {[cc.candle1, cc.candle2, cc.candle3, cc.candle4, cc.candle5, cc.candle6, cc.candle7, cc.candle8, cc.candle9, cc.candle10].map((v, i) => (
                            <td key={i} className="border p-1 text-center">{v ? <CheckCircle className="h-3 w-3 text-green-600 mx-auto" /> : ''}</td>
                          ))}
                          <td className="border p-1">{cc.tds_reading}</td>
                          <td className="border p-1 max-w-[120px] truncate" title={cc.notes || ''}>{cc.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
              return (
                <div className="space-y-3">
                  {showSideBySide && (
                    <>
                      {maintenanceCollapsibleContract}
                      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-[11px] font-bold text-muted-foreground">بيان الصيانات</h4>
                          {maintSummaryTable}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">بيان الأقساط بجانب الصيانة</h4>
                          {installmentsSideTable}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-bold text-sky-900 dark:text-sky-200">جدول الدفعات (التاريخ — الدفعة — التحصيل — الحالة)</h4>
                        {installmentsFourColTable}
                      </div>
                    </>
                  )}
                  {!showSideBySide && (
                    <div className="space-y-3">
                      {cashMaintenanceContractHint}
                      {maintSummaryTable}
                    </div>
                  )}
                  {candleChanges.length > 0 && detailCandlesTable}
                </div>
              );
            })()}
          </TabsContent>

          {/* Installments & Contract Details */}
          {(deviceForm.contract_type === 'تقسيط' || deviceForm.contract_type === 'عقد صيانة') && (
            <TabsContent value="installments" className="mt-2 space-y-3">
              {contractSummaryEditableBlock}

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">جدول الأقساط ({installments.length})</span>
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={rebuildInstallments} disabled={rebuildingInstallments}>
                  {rebuildingInstallments ? 'جاري إعادة الإنشاء...' : 'إعادة إنشاء الأقساط'}
                </Button>
              </div>

              {installments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded">لا توجد أقساط — حدّد عدد الأقساط وقيمة العقد من &quot;تعديل العقد&quot; ثم اضغط &quot;إعادة إنشاء الأقساط&quot;</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border-2 border-sky-200 dark:border-sky-800 overflow-hidden">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200">
                        <th className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold">التاريخ</th>
                        <th className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold">الدفعة</th>
                        <th className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold">التحصيل</th>
                        <th className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst) => (
                        <tr key={inst.id} className={`${inst.status === 'تمت' ? 'bg-green-50 dark:bg-green-950/20' : 'bg-white dark:bg-background'} hover:bg-muted/30`}>
                          <td className="border border-sky-200 dark:border-sky-700 p-1.5 font-semibold whitespace-nowrap">{formatDateDisplay(inst.installment_date)}</td>
                          <td className="border border-sky-200 dark:border-sky-700 p-1.5 font-bold text-center">{Number(inst.amount).toLocaleString('ar-EG')}</td>
                          <td className="border border-sky-200 dark:border-sky-700 p-1.5 whitespace-nowrap">{inst.collection_date ? formatDateDisplay(inst.collection_date) : '—'}</td>
                          <td className="border border-sky-200 dark:border-sky-700 p-1.5">
                            <div className="flex flex-col gap-1 items-stretch sm:flex-row sm:items-center sm:gap-2">
                              <Badge variant={inst.status === 'تمت' ? 'default' : 'secondary'} className="text-[9px] w-fit">
                                {inst.status}
                              </Badge>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] shrink-0"
                                disabled={installmentSavingId === inst.id}
                                onClick={() => updateInstallmentAmount(inst)}
                              >
                                تعديل المبلغ
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] shrink-0"
                                disabled={installmentSavingId === inst.id}
                                onClick={() => updateInstallmentCollectionDate(inst)}
                              >
                                تعديل التحصيل
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={inst.status === 'تمت' ? 'outline' : 'default'}
                                className="h-6 text-[10px] shrink-0"
                                disabled={installmentSavingId === inst.id}
                                onClick={() => toggleInstallmentStatus(inst)}
                              >
                                {installmentSavingId === inst.id ? '...' : inst.status === 'تمت' ? 'إرجاع معلق' : 'تسجيل سداد'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ===== Main Dialog =====
export function CustomerDetailDialog({ customer, open, onOpenChange }: CustomerDetailDialogProps) {
  const { branch } = useUserBranch();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [devices, setDevices] = useState<CustomerDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [activeCustomerName, setActiveCustomerName] = useState('');

  useEffect(() => {
    if (customer) setActiveCustomerName(customer.name);
  }, [customer?.id, customer?.name]);

  const openNewWorkOrderForCustomer = () => {
    if (!customer) return;
    onOpenChange(false);
    navigate('/work-orders', { state: { newOrderForCustomer: { id: customer.id, name: activeCustomerName || customer.name, phone1: customer.phone1, phone2: customer.phone2, whatsapp: customer.whatsapp, address: customer.address, region: customer.region, area_id: customer.area_id ?? null, customer_code: (customer as any).customer_code || null } } });
  };

  const fetchAll = async (nameOverride?: string) => {
    if (!customer) return;
    const queryName = (nameOverride ?? activeCustomerName ?? customer.name).trim();
    if (!queryName) return;
    setLoading(true);
    const bVals = branchDbValuesForUiBranch(branch);
    const [invRes, woRes, maintRes, devRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('customer_name', queryName).in('branch', bVals).order('date', { ascending: false }),
      supabase.from('work_orders').select('*').eq('customer_name', queryName).in('branch', bVals).order('created_at', { ascending: false }),
      supabase.from('maintenance').select('*').eq('customer_name', queryName).in('branch', bVals).order('next_date', { ascending: false }),
      (supabase as any).from('customer_devices').select('*').eq('customer_id', customer.id).in('branch', bVals).order('created_at', { ascending: false }),
    ]);
    setInvoices(invRes.data || []);
    setWorkOrders(woRes.data || []);
    setMaintenance(maintRes.data || []);
    setDevices((devRes.data || []) as any[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!customer || !open || !activeCustomerName) return;
    fetchAll();
  }, [customer, open, branch, activeCustomerName]);

  if (!customer) return null;

  const raw = (customer.whatsapp || customer.phone1 || '').replace(/[^0-9]/g, '');
  const whatsappNumber = raw.startsWith('0') ? '20' + raw.slice(1) : raw ? (raw.startsWith('20') ? raw : '20' + raw) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{activeCustomerName || customer.name}</DialogTitle>
        </DialogHeader>

        {/* Contact Info */}
        <div className="space-y-3 border-b pb-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-2" asChild>
              <a href={`tel:${customer.phone1}`}>
                <Phone className="h-4 w-4" /> {customer.phone1}
              </a>
            </Button>
            {customer.phone2 && (
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <a href={`tel:${customer.phone2}`}>
                  <Phone className="h-4 w-4" /> {customer.phone2}
                </a>
              </Button>
            )}
            <Button size="sm" variant="default" className="gap-2 bg-green-600 hover:bg-green-700" asChild>
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> واتساب
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{customer.address}</span>
            {customer.region && <Badge variant="outline" className="text-[10px]">{customer.region}</Badge>}
          </div>
          {customer.notes && (
            <p className="text-xs bg-accent/50 text-accent-foreground p-2 rounded-lg">{customer.notes}</p>
          )}
          <Button size="sm" variant="default" className="gap-2 mt-2" onClick={openNewWorkOrderForCustomer}>
            <ClipboardList className="h-4 w-4" /> إنشاء أمر عمل لهذا العميل
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="devices" className="mt-2">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="devices" className="gap-1 text-xs">
              <Monitor className="h-3.5 w-3.5" /> الأجهزة ({devices.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" /> الفواتير ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="work-orders" className="gap-1 text-xs">
              <ClipboardList className="h-3.5 w-3.5" /> أوامر العمل ({workOrders.length})
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-1 text-xs">
              <Wrench className="h-3.5 w-3.5" /> الصيانة ({maintenance.length})
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">جاري التحميل...</p>
          ) : (
            <>
              {/* Devices Tab */}
              <TabsContent value="devices" className="space-y-3 mt-3">
                <Button size="sm" variant="outline" className="gap-1 w-full" onClick={() => setShowAddDevice(!showAddDevice)}>
                  <Plus className="h-3.5 w-3.5" /> إضافة جهاز
                </Button>
                {showAddDevice && (
                  <AddDeviceForm
                    customerId={customer.id}
                    onSaved={() => {
                      setShowAddDevice(false);
                      fetchAll();
                    }}
                  />
                )}
                {devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد أجهزة مسجلة</p>
                ) : devices.map(dev => (
                  <DeviceDetailCard
                    key={dev.id}
                    device={dev}
                    customerId={customer.id}
                    customerName={activeCustomerName || customer.name}
                    customerPhone={customer.phone1}
                    customerPhone2={customer.phone2}
                    customerAddress={customer.address}
                    customerRegion={customer.region}
                    onRefresh={() => fetchAll()}
                    onCustomerNameChange={(newName) => {
                      setActiveCustomerName(newName);
                      fetchAll(newName);
                    }}
                  />
                ))}
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices" className="space-y-2 mt-3">
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد فواتير</p>
                ) : invoices.map(inv => (
                  <Card key={inv.id}>
                    <CardContent className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDateDisplay(inv.date)} • {inv.product_name}</p>
                        {inv.rep_name && <p className="text-xs text-muted-foreground">المندوب: {inv.rep_name}</p>}
                      </div>
                      <div className="text-left">
                        <p className="font-bold">{formatEGP(inv.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          مدفوع: {formatEGP(inv.paid)}
                          {invoiceCustomerCredit(inv.amount, inv.paid) > 0
                            ? ` • رصيد للعميل: ${formatEGP(invoiceCustomerCredit(inv.amount, inv.paid))}`
                            : ` • متبقي: ${formatEGP(invoiceDebtRemaining(inv.amount, inv.paid))}`}
                        </p>
                        <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">
                          {inv.status === 'paid' ? 'مدفوعة' : inv.status === 'partial' ? 'جزئي' : 'معلقة'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Work Orders Tab */}
              <TabsContent value="work-orders" className="space-y-2 mt-3">
                {workOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد أوامر عمل</p>
                ) : workOrders.map(wo => (
                  <Card key={wo.id}>
                    <CardContent className="p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{wo.order_code}</p>
                        <Badge variant={wo.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                          {wo.status === 'completed' ? 'مكتمل' : wo.status === 'in_progress' ? 'جاري' : 'معلق'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        <span>المنتج: {wo.product_name}</span>
                        <span>الزيارة: {formatDateDisplay(wo.visit_date)}</span>
                        <span>الفني: {wo.technician || 'غير محدد'}</span>
                        <span>الإجمالي: {formatEGP(wo.total)}</span>
                        {wo.warranty_status && <span>الضمان: {wo.warranty_status}</span>}
                        {wo.location_url && (
                          <a href={wo.location_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            <MapPin className="h-3 w-3 inline" /> الموقع
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Maintenance Tab */}
              <TabsContent value="maintenance" className="space-y-2 mt-3">
                {maintenance.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات صيانة</p>
                ) : maintenance.map(m => (
                  <Card key={m.id}>
                    <CardContent className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{m.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDateDisplay(m.next_date)} • {m.product_name}</p>
                          {m.phone && <p className="text-xs text-muted-foreground">📞 {m.phone}</p>}
                        </div>
                        <div className="text-left">
                          <p className="text-xs">{m.technician || 'بدون فني'}</p>
                          {m.cost > 0 && <p className="text-xs font-medium">{formatEGP(m.cost)}</p>}
                          <Badge variant={m.status === 'completed' ? 'default' : m.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {m.status === 'completed' ? 'مكتمل' : m.status === 'overdue' ? 'متأخر' : 'قادم'}
                          </Badge>
                        </div>
                      </div>
                      {m.notes && <p className="text-[11px] text-muted-foreground mt-1 bg-muted/50 p-1.5 rounded">{m.notes}</p>}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
