import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, MapPin, FileText, Wrench, ClipboardList, Monitor, CreditCard, Plus, CheckCircle, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEGP } from '@/data/demo-data';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  phone1: string;
  phone2?: string;
  whatsapp?: string;
  address: string;
  region?: string;
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
}

interface CustomerDetailDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ===== Add Device Form =====
function AddDeviceForm({ customerId, onSaved }: { customerId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_name: '',
    device_type: '',
    serial_number: '',
    install_date: '',
    warranty_months: 12,
    contract_type: 'كاش',
    selling_price: 0,
    total_price: 0,
    installments_count: 0,
    installment_amount: 0,
    first_installment_date: '',
    branch: 'فرع الإسكندرية',
    customer_code: '',
    notes: '',
    ad_source: '',
  });

  const handleSave = async () => {
    if (!form.product_name) {
      toast({ title: 'خطأ', description: 'اسم المنتج مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from('customer_devices').insert({
        customer_id: customerId,
        product_name: form.product_name,
        device_type: form.device_type,
        serial_number: form.serial_number,
        install_date: form.install_date || null,
        warranty_months: form.warranty_months,
        contract_type: form.contract_type,
        selling_price: form.selling_price,
        total_price: form.total_price,
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
        <div><Label className="text-xs">اسم المنتج *</Label><Input value={form.product_name} onChange={e => setForm(p => ({...p, product_name: e.target.value}))} className="h-8 text-sm" /></div>
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
        <div><Label className="text-xs">كود العميل</Label><Input value={form.customer_code} onChange={e => setForm(p => ({...p, customer_code: e.target.value}))} className="h-8 text-sm" /></div>
        <div><Label className="text-xs">مصدر الإعلان</Label><Input value={form.ad_source} onChange={e => setForm(p => ({...p, ad_source: e.target.value}))} className="h-8 text-sm" /></div>
      </div>
      <div><Label className="text-xs">ملاحظات</Label><Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="text-sm min-h-[50px]" /></div>
      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">{saving ? 'جاري الحفظ...' : 'حفظ الجهاز'}</Button>
    </div>
  );
}

// ===== Add Candle Change Form =====
function AddCandleChangeForm({ deviceId, customerId, onSaved }: { deviceId: string; customerId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    change_date: new Date().toISOString().split('T')[0],
    candle1: false, candle2: false, candle3: false, candle4: false,
    candle5: false, candle6: false, candle7: false,
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
        tds_reading: form.tds_reading,
        technician: form.technician,
        cost: form.cost,
        collected: form.collected,
        remaining: form.cost - form.collected,
        notes: form.notes,
      } as any);
      if (error) throw error;
      toast({ title: 'تم تسجيل الصيانة بنجاح' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const candleLabels = ['ش1', 'ش2', 'ش3', 'ش4', 'ش5', 'ش6', 'ش7'];

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

// ===== Device Detail Card =====
function DeviceDetailCard({ device, customerId, onRefresh }: { device: CustomerDevice; customerId: string; onRefresh: () => void }) {
  const [candleChanges, setCandleChanges] = useState<CandleChange[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [activeTab, setActiveTab] = useState('candles');

  useEffect(() => {
    const fetchDeviceData = async () => {
      const db = supabase as any;
      const [ccRes, instRes] = await Promise.all([
        db.from('candle_changes').select('*').eq('device_id', device.id).order('change_date', { ascending: false }),
        db.from('installments').select('*').eq('device_id', device.id).order('installment_date', { ascending: true }),
      ]);
      setCandleChanges((ccRes.data || []) as CandleChange[]);
      setInstallments((instRes.data || []) as Installment[]);
    };
    fetchDeviceData();
  }, [device.id]);

  const warrantyEnd = device.install_date
    ? new Date(new Date(device.install_date).setMonth(new Date(device.install_date).getMonth() + device.warranty_months))
    : null;
  const isWarrantyActive = warrantyEnd ? warrantyEnd > new Date() : false;

  const candles = Array.isArray(device.candles) ? device.candles : [];

  return (
    <Card className="border-primary/20">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            {device.product_name} {device.device_type && `- ${device.device_type}`}
          </CardTitle>
          <Badge variant={isWarrantyActive ? 'default' : 'destructive'} className="text-[10px]">
            {isWarrantyActive ? 'ضمان ساري' : 'ضمان منتهي'}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px] text-muted-foreground mt-1">
          {device.serial_number && <span>مسلسل: {device.serial_number}</span>}
          {device.install_date && <span>التركيب: {device.install_date}</span>}
          <span>الضمان: {device.warranty_months} شهر</span>
          {warrantyEnd && <span>حتى: {warrantyEnd.toLocaleDateString('ar-EG')}</span>}
          <span>العقد: {device.contract_type}</span>
          {device.selling_price > 0 && <span>السعر: {formatEGP(device.selling_price)}</span>}
          {device.total_price > 0 && <span>الإجمالي: {formatEGP(device.total_price)}</span>}
          {device.branch && <span>الفرع: {device.branch}</span>}
          {device.customer_code && <span>كود: {device.customer_code}</span>}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 h-7">
            <TabsTrigger value="candles" className="text-[10px] py-0.5">بيان الشمعات</TabsTrigger>
            <TabsTrigger value="maintenance" className="text-[10px] py-0.5">بيان الصيانات ({candleChanges.length})</TabsTrigger>
            {device.contract_type === 'تقسيط' && (
              <TabsTrigger value="installments" className="text-[10px] py-0.5">الأقساط ({installments.length})</TabsTrigger>
            )}
          </TabsList>

          {/* Candle Specs */}
          <TabsContent value="candles" className="mt-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border p-1 text-right">#</th>
                    <th className="border p-1 text-right">الشمعة</th>
                    <th className="border p-1 text-right">النوع</th>
                    <th className="border p-1 text-right">المدة</th>
                    <th className="border p-1 text-right">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {candles.map((c: Candle, i: number) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="border p-1">{i + 1}</td>
                      <td className="border p-1">{c.name}</td>
                      <td className="border p-1">{c.type}</td>
                      <td className="border p-1">{c.duration_months} شهر</td>
                      <td className="border p-1">{c.price} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Maintenance History */}
          <TabsContent value="maintenance" className="mt-2 space-y-2">
            <Button size="sm" variant="outline" className="w-full gap-1 text-xs h-7" onClick={() => setShowAddMaint(!showAddMaint)}>
              <Plus className="h-3 w-3" /> تسجيل صيانة
            </Button>
            {showAddMaint && (
              <AddCandleChangeForm
                deviceId={device.id}
                customerId={customerId}
                onSaved={() => {
                  setShowAddMaint(false);
                  // Refresh
                   (supabase as any).from('candle_changes').select('*').eq('device_id', device.id).order('change_date', { ascending: false })
                     .then((res: any) => setCandleChanges((res.data || []) as CandleChange[]));
                }}
              />
            )}
            {candleChanges.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">لا توجد سجلات صيانة</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border p-1">التاريخ</th>
                      <th className="border p-1">ش1</th>
                      <th className="border p-1">ش2</th>
                      <th className="border p-1">ش3</th>
                      <th className="border p-1">ش4</th>
                      <th className="border p-1">ش5</th>
                      <th className="border p-1">ش6</th>
                      <th className="border p-1">ش7</th>
                      <th className="border p-1">TDS</th>
                      <th className="border p-1">الفني</th>
                      <th className="border p-1">القيمة</th>
                      <th className="border p-1">محصل</th>
                      <th className="border p-1">باقي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candleChanges.map(cc => (
                      <tr key={cc.id} className="hover:bg-muted/30">
                        <td className="border p-1">{cc.change_date}</td>
                        {[cc.candle1, cc.candle2, cc.candle3, cc.candle4, cc.candle5, cc.candle6, cc.candle7].map((v, i) => (
                          <td key={i} className="border p-1 text-center">
                            {v ? <CheckCircle className="h-3 w-3 text-green-600 mx-auto" /> : ''}
                          </td>
                        ))}
                        <td className="border p-1">{cc.tds_reading}</td>
                        <td className="border p-1">{cc.technician}</td>
                        <td className="border p-1">{cc.cost}</td>
                        <td className="border p-1">{cc.collected}</td>
                        <td className="border p-1">{cc.remaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Installments */}
          {device.contract_type === 'تقسيط' && (
            <TabsContent value="installments" className="mt-2">
              {installments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">لا توجد أقساط</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="border p-1">#</th>
                        <th className="border p-1">التاريخ</th>
                        <th className="border p-1">الدفعة</th>
                        <th className="border p-1">التحصيل</th>
                        <th className="border p-1">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst, i) => (
                        <tr key={inst.id} className={`hover:bg-muted/30 ${inst.status === 'تمت' ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                          <td className="border p-1">{i + 1}</td>
                          <td className="border p-1">{inst.installment_date}</td>
                          <td className="border p-1">{formatEGP(inst.amount)}</td>
                          <td className="border p-1">{inst.collection_date || '-'}</td>
                          <td className="border p-1">
                            <Badge variant={inst.status === 'تمت' ? 'default' : 'secondary'} className="text-[9px]">
                              {inst.status}
                            </Badge>
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
  const [invoices, setInvoices] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [devices, setDevices] = useState<CustomerDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);

  const fetchAll = async () => {
    if (!customer) return;
    setLoading(true);
    const [invRes, woRes, maintRes, devRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('customer_name', customer.name).order('date', { ascending: false }),
      supabase.from('work_orders').select('*').eq('customer_name', customer.name).order('created_at', { ascending: false }),
      supabase.from('maintenance').select('*').eq('customer_name', customer.name).order('next_date', { ascending: false }),
      (supabase as any).from('customer_devices').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
    ]);
    setInvoices(invRes.data || []);
    setWorkOrders(woRes.data || []);
    setMaintenance(maintRes.data || []);
    setDevices((devRes.data || []) as any[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!customer || !open) return;
    fetchAll();
  }, [customer, open]);

  if (!customer) return null;

  const raw = (customer.whatsapp || customer.phone1 || '').replace(/[^0-9]/g, '');
  const whatsappNumber = raw.startsWith('0') ? '20' + raw.slice(1) : raw ? (raw.startsWith('20') ? raw : '20' + raw) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{customer.name}</DialogTitle>
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
                  <DeviceDetailCard key={dev.id} device={dev} customerId={customer.id} onRefresh={fetchAll} />
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
                        <p className="text-xs text-muted-foreground">{inv.date} • {inv.product_name}</p>
                        {inv.rep_name && <p className="text-xs text-muted-foreground">المندوب: {inv.rep_name}</p>}
                      </div>
                      <div className="text-left">
                        <p className="font-bold">{formatEGP(inv.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">مدفوع: {formatEGP(inv.paid)} • باقي: {formatEGP(inv.remaining)}</p>
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
                        <span>الزيارة: {wo.visit_date}</span>
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
                          <p className="text-xs text-muted-foreground">{m.next_date} • {m.product_name}</p>
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
