import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { workOrders as demoWorkOrders, formatEGP, companyInfo } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Eye, Printer, X, Truck, Edit } from 'lucide-react';
import logo from '@/assets/logo.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddDialog } from '@/components/AddDialog';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';

interface WorkOrder {
  id: string;
  order_code: string;
  customer_code?: string;
  customer_id_num?: number;
  customer_name: string;
  address: string;
  location_url?: string;
  phone: string;
  region?: string;
  product_name: string;
  install_date?: string;
  warranty_until?: string;
  warranty_status?: string;
  visit_date: string;
  visit_time?: string;
  technician?: string;
  notes?: string;
  items: { description: string; value: number }[];
  transport_cost: number;
  total: number;
  previous_visits: { date: string; details: string }[];
  status: string;
  branch: string;
  assigned_rep?: string;
  delivery_status?: string;
}

const ensureHttpUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const openExternalLink = (url: string) => {
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!newWindow || newWindow.closed) {
    try {
      if (window.self !== window.top && window.top) {
        window.top.location.href = url;
        return;
      }
    } catch { /* cross-origin */ }
    window.location.href = url;
  }
};

function WorkOrderDetail({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  return (
    <div className="max-w-4xl mx-auto bg-card print:shadow-none" dir="rtl">
      <div className="flex items-start justify-between border-b-2 border-foreground/20 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Clean Water" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-primary">كلين ووتر</h1>
            <p className="text-xs text-muted-foreground">لتكنولوجيا معالجة مياه الشرب</p>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold gradient-primary text-primary-foreground px-8 py-2 rounded-lg">أمر شغل</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="print:hidden"><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
        <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[80px]">كود الأمر</span><span className="font-medium">{wo.order_code}</span></div>
        <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[80px]">العميل</span><span className="font-bold">{wo.customer_name}</span></div>
        <div className="flex gap-2 col-span-2"><span className="font-semibold text-muted-foreground min-w-[80px]">العنوان</span><span className="text-xs leading-relaxed">{wo.address}</span></div>
        {wo.location_url && (
          <div className="flex gap-2 col-span-2"><span className="font-semibold text-muted-foreground min-w-[80px]">الموقع</span><button className="text-xs text-primary underline cursor-pointer bg-transparent border-none p-0" onClick={() => openExternalLink(ensureHttpUrl(wo.location_url))}>فتح لينك اللوكيشن</button></div>
        )}
        <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[80px]">الهاتف</span><span>{wo.phone}</span></div>
        <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[80px]">المنطقة</span><span>{wo.region}</span></div>
        <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[80px]">تاريخ الزيارة</span><span className="font-bold">{wo.visit_date}</span></div>
        <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[80px]">الفني</span><span className="font-medium">{wo.technician}</span></div>
        {wo.warranty_status && (
          <div className="flex gap-2"><span className="font-semibold text-muted-foreground min-w-[80px]">الضمان</span>
            <Badge variant={wo.warranty_status === 'ساري' ? 'default' : 'destructive'} className="text-[10px]">{wo.warranty_status}</Badge>
          </div>
        )}
      </div>

      {wo.notes && (
        <div className="text-sm mb-4 p-2 bg-accent/50 rounded-lg">
          <span className="font-semibold text-muted-foreground">ملاحظات: </span><span>{wo.notes}</span>
        </div>
      )}

      <table className="w-full text-sm border border-border mb-4">
        <thead><tr className="bg-muted/70"><th className="border border-border p-2 text-right font-semibold">البيان</th><th className="border border-border p-2 text-center font-semibold w-28">القيمة</th></tr></thead>
        <tbody>
          {wo.items.map((item, i) => (
            <tr key={i} className="hover:bg-muted/30"><td className="border border-border p-2">{item.description}</td><td className="border border-border p-2 text-center font-medium">{item.value}</td></tr>
          ))}
          <tr className="bg-muted/30"><td className="border border-border p-2 font-semibold">مواصلات</td><td className="border border-border p-2 text-center">{wo.transport_cost}</td></tr>
          <tr className="bg-primary/10"><td className="border border-border p-2 font-bold text-primary">الإجمالي</td><td className="border border-border p-2 text-center font-bold text-primary">{wo.total}</td></tr>
        </tbody>
      </table>

      <div className="grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground pt-4 border-t border-border">
        <div><p className="font-semibold mb-8">خدمة العملاء</p><div className="border-t border-dashed border-border pt-1">التوقيع</div></div>
        <div><p className="font-semibold mb-8">توقيع العميل</p><div className="border-t border-dashed border-border pt-1">التوقيع</div></div>
        <div><p className="font-semibold mb-8">توقيع الفنى</p><div className="border-t border-dashed border-border pt-1">التوقيع</div></div>
      </div>

      <div className="mt-6 pt-3 border-t border-border text-[10px] text-muted-foreground text-center space-y-1">
        <p>{companyInfo.branches.join(' | ')}</p>
        <p>خدمة العملاء: {companyInfo.customerService.join(' - ')}</p>
        <p>الخط الساخن: {companyInfo.hotline} | إدارة الفنيين: {companyInfo.techManagement}</p>
      </div>

      <div className="mt-4 flex justify-center print:hidden">
        <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> طباعة أمر الشغل</Button>
      </div>
    </div>
  );
}

const deliveryStatusLabel = (s?: string) => {
  switch (s) {
    case 'accepted': return 'مقبول';
    case 'in_transit': return 'جاري التوصيل';
    case 'delivered': return 'تم التسليم';
    case 'rejected': return 'مرفوض';
    default: return 'في الانتظار';
  }
};

const getWorkOrderFields = (reps: { id: string; full_name: string }[], currentBranch: string, areas: { id: string; name: string }[] = []) => {
  const base = [
  { name: 'order_code', label: 'كود الأمر', required: true },
  { name: 'customer_name', label: 'اسم العميل', required: true },
  { name: 'phone', label: 'الهاتف', required: true },
  { name: 'address', label: 'العنوان', required: true },
  { name: 'location_url', label: 'لينك اللوكيشن (Google Maps)' },
  { name: 'region', label: 'المنطقة (نص حر)' },
  ...(areas.length > 0 ? [{ name: 'area_id', label: 'المنطقة (من القائمة)', type: 'select' as const, options: [{ value: '', label: 'بدون' }, ...areas.map(a => ({ value: a.id, label: a.name }))] }] : []),
  { name: 'product_name', label: 'المنتج', required: true },
  { name: 'price1', label: 'سعر 1', type: 'number' as const, defaultValue: '0' },
  { name: 'price2', label: 'سعر 2', type: 'number' as const, defaultValue: '0' },
  { name: 'price3', label: 'سعر 3', type: 'number' as const, defaultValue: '0' },
  { name: 'assigned_rep', label: 'المندوب المسؤول', type: 'select' as const, options: [
    { value: 'none', label: 'بدون مندوب' },
    ...reps.map(r => ({ value: r.id, label: r.full_name })),
  ], defaultValue: 'none' },
  { name: 'visit_date', label: 'تاريخ الزيارة', type: 'date' as const, required: true },
  { name: 'maintenance_dates', label: 'التواريخ القادمة للصيانة (اختياري - مفصولة بفاصلة، مثال: 2026-04-15, 2026-07-20)', type: 'textarea' as const },
  { name: 'technician', label: 'الفني' },
  { name: 'warranty_status', label: 'الضمان', type: 'select' as const, options: [
    { value: 'ساري', label: 'ساري' },
    { value: 'منتهي', label: 'منتهي' },
  ], defaultValue: 'ساري' },
  { name: 'status', label: 'الحالة', type: 'select' as const, options: [
    { value: 'pending', label: 'معلق' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed', label: 'مكتمل' },
  ], defaultValue: 'pending' },
  { name: 'branch', label: 'الفرع', type: 'select' as const, options: [
    { value: 'فرع الإسكندرية', label: 'فرع الإسكندرية' },
    { value: 'فرع الجيزة', label: 'فرع الجيزة' },
  ], defaultValue: currentBranch },
  { name: 'notes', label: 'ملاحظات', type: 'textarea' as const },
];
  return base;
};

interface WorkOrdersPageProps { embedded?: boolean }
export default function WorkOrdersPage({ embedded }: WorkOrdersPageProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingWO, setEditingWO] = useState<WorkOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [reps, setReps] = useState<{ id: string; full_name: string }[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const { toast } = useToast();
  const { branch } = useUserBranch();

  const fetchWorkOrders = async () => {
    const { data } = await supabase.from('work_orders').select('*').eq('branch', branch).order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setWorkOrders(data.map((wo: any) => ({
        ...wo,
        items: Array.isArray(wo.items) ? wo.items : [],
        previous_visits: Array.isArray(wo.previous_visits) ? wo.previous_visits : [],
      })) as WorkOrder[]);
    } else {
      setWorkOrders(demoWorkOrders.map(wo => ({
        id: wo.id,
        order_code: wo.orderCode,
        customer_code: wo.customerCode,
        customer_id_num: wo.customerId,
        customer_name: wo.customer,
        address: wo.address,
        phone: wo.phone,
        region: wo.region,
        product_name: wo.product,
        install_date: wo.installDate,
        warranty_until: wo.warrantyUntil,
        warranty_status: wo.warrantyStatus,
        visit_date: wo.visitDate,
        visit_time: wo.visitTime,
        technician: wo.technician,
        notes: wo.notes,
        items: wo.items,
        transport_cost: wo.transportCost,
        total: wo.total,
        previous_visits: wo.previousVisits,
        status: wo.status,
        branch: wo.branch,
      })));
    }
    setLoading(false);
  };

  const fetchReps = async () => {
    const { data: roleData } = await supabase.from('user_roles').select('user_id').eq('role', 'sales_rep');
    if (roleData && roleData.length > 0) {
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      if (profiles) setReps(profiles);
    }
  };

  useEffect(() => {
    setSelectedWO(null);
    fetchWorkOrders();
    fetchReps();
    supabase.from('areas').select('id,name').eq('branch', branch).then(({ data }) => setAreas(Array.isArray(data) ? data : []));
  }, [branch]);

  const statusLabel = (s: string) => s === 'completed' ? 'مكتمل' : s === 'in_progress' ? 'قيد التنفيذ' : 'معلق';
  const statusVariant = (s: string) => s === 'completed' ? 'default' as const : s === 'in_progress' ? 'secondary' as const : 'outline' as const;

  const assignRep = async (orderId: string, repId: string) => {
    setAssigningId(orderId);
    try {
      const { error } = await supabase.from('work_orders').update({ assigned_rep: repId, delivery_status: 'pending' } as any).eq('id', orderId);
      if (error) throw error;
      toast({ title: 'تم تعيين المندوب بنجاح' });
      fetchWorkOrders();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setAssigningId(null);
    }
  };

  const handleAdd = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const woBranch = values.branch || branch || 'فرع الإسكندرية';
      const { error } = await supabase.from('work_orders').insert({
        order_code: values.order_code,
        customer_name: values.customer_name,
        phone: values.phone,
        address: values.address,
        location_url: values.location_url || '',
        region: values.region || '',
        area_id: values.area_id || null,
        product_name: values.product_name,
        visit_date: values.visit_date,
        technician: values.technician || '',
        warranty_status: values.warranty_status || 'ساري',
        status: values.status || 'pending',
        branch: woBranch,
        notes: values.notes || '',
        items: [],
        transport_cost: 0,
        total: 0,
        previous_visits: [],
        created_by: user?.id,
        assigned_rep: values.assigned_rep && values.assigned_rep !== 'none' ? values.assigned_rep : null,
        delivery_status: values.assigned_rep ? 'pending' : 'pending',
        price1: Number(values.price1) || 0,
        price2: Number(values.price2) || 0,
        price3: Number(values.price3) || 0,
      } as any);
      if (error) throw error;

      const maintenanceDatesRaw = (values.maintenance_dates || '').trim();
      const maintenanceDates = maintenanceDatesRaw
        ? maintenanceDatesRaw.split(/[،,\s]+/).map(d => d.trim()).filter(Boolean)
        : [];
      if (maintenanceDates.length > 0) {
        const firstDate = maintenanceDates[0];
        const { error: maintErr } = await supabase.from('maintenance').insert({
          id: crypto.randomUUID(),
          customer_name: values.customer_name,
          product_name: values.product_name,
          phone: values.phone || '',
          type: 'تغيير شمعات',
          next_date: firstDate,
          next_dates: maintenanceDates,
          status: 'upcoming',
          technician: values.technician || '',
          cost: 0,
          branch: woBranch,
          created_by: user?.id,
        } as any);
        if (maintErr) {
          toast({ title: 'تم إضافة أمر العمل', description: 'لم يتم تسجيل تواريخ الصيانة: ' + maintErr.message, variant: 'destructive' });
        } else {
          toast({ title: 'تم إضافة أمر العمل وتسجيل تواريخ الصيانة في الصيانة والزيارات' });
        }
      } else {
        toast({ title: 'تم إضافة أمر العمل بنجاح' });
      }
      setAddOpen(false);
      fetchWorkOrders();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (values: Record<string, string>) => {
    if (!editingWO) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('work_orders').update({
        order_code: values.order_code,
        customer_name: values.customer_name,
        phone: values.phone,
        address: values.address,
        location_url: values.location_url || '',
        region: values.region || '',
        area_id: values.area_id || null,
        product_name: values.product_name,
        visit_date: values.visit_date,
        technician: values.technician || '',
        warranty_status: values.warranty_status || 'ساري',
        status: values.status || 'pending',
        branch: values.branch || branch,
        notes: values.notes || '',
        assigned_rep: values.assigned_rep && values.assigned_rep !== 'none' ? values.assigned_rep : null,
      } as any).eq('id', editingWO.id);
      if (error) throw error;
      toast({ title: 'تم تعديل أمر العمل بنجاح' });
      setEditOpen(false);
      setEditingWO(null);
      setSelectedWO(null);
      fetchWorkOrders();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isDemoItem = (id: string) => id.startsWith('WO-');

  const openEdit = (wo: WorkOrder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isDemoItem(wo.id)) {
      toast({ title: 'بيانات تجريبية', description: 'لا يمكن تعديل البيانات التجريبية', variant: 'destructive' });
      return;
    }
    setEditingWO(wo);
    setEditOpen(true);
  };

  const editInitialValues = useMemo(() => {
    if (!editingWO) return undefined;
    return {
      order_code: editingWO.order_code || '',
      customer_name: editingWO.customer_name || '',
      phone: editingWO.phone || '',
      address: editingWO.address || '',
      location_url: editingWO.location_url || '',
      region: editingWO.region || '',
      area_id: (editingWO as any).area_id || '',
      product_name: editingWO.product_name || '',
      price1: String((editingWO as any).price1 || 0),
      price2: String((editingWO as any).price2 || 0),
      price3: String((editingWO as any).price3 || 0),
      assigned_rep: editingWO.assigned_rep || 'none',
      visit_date: editingWO.visit_date || '',
      technician: editingWO.technician || '',
      warranty_status: editingWO.warranty_status || 'ساري',
      status: editingWO.status || 'pending',
      branch: editingWO.branch || branch,
      notes: editingWO.notes || '',
    };
  }, [editingWO, branch]);

  const getRepName = (repId?: string) => {
    if (!repId) return null;
    return reps.find(r => r.id === repId)?.full_name || 'مندوب';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">أوامر العمل</h1>
            <p className="text-muted-foreground text-sm">{workOrders.length} أمر عمل</p>
          </div>
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> أمر عمل جديد
          </Button>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> أمر عمل جديد
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="space-y-4">
          {workOrders.map((wo, i) => (
            <motion.div key={wo.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="card-shadow hover:card-shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold">{wo.order_code}</h3>
                        <Badge variant={statusVariant(wo.status)}>{statusLabel(wo.status)}</Badge>
                        {wo.order_code?.startsWith('صيانة-') && (
                          <Badge variant="secondary" className="text-[10px]">صيانة</Badge>
                        )}
                        {wo.warranty_status && (
                          <Badge variant={wo.warranty_status === 'ساري' ? 'default' : 'destructive'} className="text-[10px]">
                            ضمان: {wo.warranty_status}
                          </Badge>
                        )}
                        {wo.assigned_rep && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Truck className="h-3 w-3" />
                            {deliveryStatusLabel(wo.delivery_status)} - {getRepName(wo.assigned_rep)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">العميل: <span className="font-semibold">{wo.customer_name}</span></p>
                      <p className="text-xs text-muted-foreground">{wo.product_name} • {wo.region} • {wo.branch}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>الفني: {wo.technician}</span>
                        <span>الزيارة: {wo.visit_date}</span>
                        <span>الإجمالي: <strong className="text-secondary">{formatEGP(wo.total)}</strong></span>
                        {(wo as any).price1 > 0 && <span>سعر 1: {formatEGP((wo as any).price1)}</span>}
                        {(wo as any).price2 > 0 && <span>سعر 2: {formatEGP((wo as any).price2)}</span>}
                        {(wo as any).price3 > 0 && <span>سعر 3: {formatEGP((wo as any).price3)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedWO(wo)}>
                        <Eye className="h-4 w-4" /> عرض
                      </Button>
                      {!isDemoItem(wo.id) && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={(e) => openEdit(wo, e)}>
                          <Edit className="h-4 w-4" /> تعديل
                        </Button>
                      )}
                      {!wo.assigned_rep && reps.length > 0 && (
                        <Select onValueChange={(repId) => assignRep(wo.id, repId)} disabled={assigningId === wo.id}>
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="تعيين مندوب" />
                          </SelectTrigger>
                          <SelectContent>
                            {reps.map(rep => (
                              <SelectItem key={rep.id} value={rep.id}>{rep.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedWO} onOpenChange={(open) => !open && setSelectedWO(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>أمر شغل {selectedWO?.order_code}</DialogTitle></DialogHeader>
          {selectedWO && (
            <div className="space-y-3">
              {!isDemoItem(selectedWO.id) && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(selectedWO)}>
                    <Edit className="h-4 w-4" /> تعديل أمر العمل
                  </Button>
                </div>
              )}
              <WorkOrderDetail wo={selectedWO} onClose={() => setSelectedWO(null)} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddDialog open={addOpen} onOpenChange={setAddOpen} title="أمر عمل جديد" fields={getWorkOrderFields(reps, branch, areas)} onSubmit={handleAdd} loading={saving} />
      <AddDialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingWO(null); }} title="تعديل أمر العمل" fields={getWorkOrderFields(reps, branch, areas)} onSubmit={handleEdit} loading={saving} initialValues={editInitialValues} />
    </motion.div>
  );
}
