import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { maintenanceSchedule as demoMaintenance } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Wrench, Calendar, Phone, DollarSign, StickyNote, User, X, Edit, Users, ClipboardList, Package, Trash2 } from 'lucide-react';
import { AddDialog } from '@/components/AddDialog';
import { useToast } from '@/hooks/use-toast';
import { promptDeletePassword } from '@/lib/deletePassword';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateDayMonthYear } from '@/lib/dateDisplay';

interface Maintenance {
  id: string;
  customer_name: string;
  product_name: string;
  next_date: string;
  type: string;
  technician: string;
  status: string;
  notes?: string;
  cost?: number;
  phone?: string;
}

const maintenanceFields = [
  { name: 'customer_name', label: 'اسم العميل', required: true },
  { name: 'phone', label: 'رقم التليفون' },
  { name: 'product_name', label: 'المنتج', required: true },
  { name: 'next_date', label: 'تاريخ الصيانة القادم', type: 'date' as const, required: true },
  { name: 'next_dates_extra', label: 'تواريخ قادمة إضافية (مفصولة بفاصلة، مثال: 2026-04-15, 2026-07-20)' },
  { name: 'type', label: 'نوع الصيانة', type: 'select' as const, options: [
    { value: 'تغيير شمعات', label: 'تغيير شمعات' },
    { value: 'صيانة دورية', label: 'صيانة دورية' },
    { value: 'فحص شامل', label: 'فحص شامل' },
    { value: 'إصلاح عطل', label: 'إصلاح عطل' },
  ], defaultValue: 'تغيير شمعات' },
  { name: 'technician', label: 'الفني' },
  { name: 'cost', label: 'التكلفة (ج.م)', type: 'number' as const },
  { name: 'status', label: 'الحالة', type: 'select' as const, options: [
    { value: 'upcoming', label: 'قادمة' },
    { value: 'overdue', label: 'متأخرة' },
    { value: 'completed', label: 'تمت' },
  ], defaultValue: 'upcoming' },
  { name: 'notes', label: 'ملاحظات', type: 'textarea' as const },
];

const mapDemoToMaintenance = (): Maintenance[] =>
  demoMaintenance.map(m => ({
    id: m.id,
    customer_name: m.customer,
    product_name: m.product,
    next_date: m.nextDate,
    type: m.type,
    technician: m.technician,
    status: m.status,
    cost: 0,
    phone: '',
  }));

interface MaintenancePageProps { embedded?: boolean }
export default function MaintenancePage({ embedded }: MaintenancePageProps) {
  const formatDateDisplay = (value?: string) => formatDateDayMonthYear(value);
  const [items, setItems] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Maintenance | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Maintenance | null>(null);
  const { toast } = useToast();
  const { branch } = useUserBranch();
  const navigate = useNavigate();

  const fetchMaintenance = async () => {
    setLoading(true);
    const bv = branchDbValuesForUiBranch(branch);
    const { data } = await supabase.from('maintenance').select('*').in('branch', bv).order('next_date', { ascending: true });
    if (data && data.length > 0) {
      setItems(data as Maintenance[]);
    } else {
      setItems(mapDemoToMaintenance());
    }
    setLoading(false);
  };

  useEffect(() => {
    setSelectedItem(null);
    setActiveTab('all');
    fetchMaintenance();
  }, [branch]);

  const handleAdd = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const extraDates = (values.next_dates_extra || '').split(/[،,]\s*/).map(s => s.trim()).filter(Boolean);
      const nextDates = values.next_date ? [values.next_date, ...extraDates].filter(Boolean) : extraDates;
      const { data: maintData, error } = await supabase.from('maintenance').insert({
        customer_name: values.customer_name,
        product_name: values.product_name,
        next_date: values.next_date,
        next_dates: nextDates.length > 0 ? nextDates : null,
        type: values.type || 'تغيير شمعات',
        technician: values.technician || '',
        status: values.status || 'upcoming',
        notes: values.notes || '',
        cost: values.cost ? Number(values.cost) : 0,
        phone: values.phone || '',
        branch: canonicalBranchForSave(branch),
        created_by: user?.id,
      }).select('id').single();
      if (error) throw error;

      const bv = branchDbValuesForUiBranch(branch);
      const { data: cust } = await supabase
        .from('customers')
        .select('address, region')
        .eq('name', values.customer_name)
        .in('branch', bv)
        .limit(1)
        .single();
      const cost = values.cost ? Number(values.cost) : 0;
      await supabase.from('work_orders').insert({
        order_code: `صيانة-${values.next_date}-${maintData?.id?.slice(-6) || Date.now()}`,
        customer_name: values.customer_name,
        phone: values.phone || '',
        address: cust?.address || '—',
        region: cust?.region || '',
        product_name: values.product_name,
        visit_date: values.next_date,
        technician: values.technician || '',
        branch: canonicalBranchForSave(branch),
        status: 'pending',
        items: cost > 0 ? [{ description: values.type || 'تغيير شمعات', value: cost }] : [],
        transport_cost: 0,
        total: cost,
        previous_visits: [],
        created_by: user?.id,
      } as any);

      toast({ title: 'تم جدولة الصيانة بنجاح' });
      setAddOpen(false);
      setActiveTab('all');
      await fetchMaintenance();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (values: Record<string, string>) => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const extraDates = (values.next_dates_extra || '').split(/[،,]\s*/).map(s => s.trim()).filter(Boolean);
      const nextDates = values.next_date ? [values.next_date, ...extraDates].filter(Boolean) : extraDates;
      const { error } = await supabase.from('maintenance').update({
        customer_name: values.customer_name,
        product_name: values.product_name,
        next_date: values.next_date,
        next_dates: nextDates.length > 0 ? nextDates : null,
        type: values.type || 'تغيير شمعات',
        technician: values.technician || '',
        status: values.status || 'upcoming',
        notes: values.notes || '',
        cost: values.cost ? Number(values.cost) : 0,
        phone: values.phone || '',
      }).eq('id', editingItem.id);
      if (error) throw error;
      toast({ title: 'تم تعديل الصيانة بنجاح' });
      setEditOpen(false);
      setEditingItem(null);
      setSelectedItem(null);
      setActiveTab('all');
      await fetchMaintenance();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isDemoItem = (id: string) => id.startsWith('M-');

  const openEdit = (m: Maintenance, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isDemoItem(m.id)) {
      toast({ title: 'بيانات تجريبية', description: 'أضف صيانة جديدة لتتمكن من التعديل', variant: 'destructive' });
      return;
    }
    setEditingItem(m);
    setEditOpen(true);
    setSelectedItem(null);
  };

  const handleDeleteMaintenance = async (m: Maintenance, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isDemoItem(m.id)) {
      toast({ title: 'بيانات تجريبية', description: 'لا يمكن حذف البيانات التجريبية', variant: 'destructive' });
      return;
    }
    if (!confirm(`حذف صيانة ${m.customer_name} — ${m.product_name}؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('maintenance').delete().eq('id', m.id);
      if (error) throw error;
      toast({ title: 'تم حذف سجل الصيانة' });
      setSelectedItem(null);
      await fetchMaintenance();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const editInitialValues = useMemo(() => {
    if (!editingItem) return undefined;
    const nextDates = (editingItem as any).next_dates;
    const extra = Array.isArray(nextDates) ? nextDates.filter((d: string) => d !== editingItem.next_date).join('، ') : '';
    return {
      customer_name: editingItem.customer_name,
      phone: editingItem.phone || '',
      product_name: editingItem.product_name,
      next_date: editingItem.next_date,
      next_dates_extra: extra,
      type: editingItem.type,
      technician: editingItem.technician || '',
      cost: String(editingItem.cost ?? 0),
      status: editingItem.status,
      notes: editingItem.notes || '',
    };
  }, [editingItem]);

  const filteredByStatus = (status: string) => {
    if (status === 'all') return items;
    return items.filter(m => m.status === status);
  };

  const statusLabel = (s: string) => s === 'completed' ? 'تمت' : s === 'overdue' ? 'متأخرة' : 'قادمة';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">الصيانة</h1>
            <p className="text-muted-foreground text-sm">جدول الصيانة الدورية والطارئة • {items.length} عنصر</p>
          </div>
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> جدولة صيانة
          </Button>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> جدولة صيانة
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="upcoming">قادمة ({items.filter(m => m.status === 'upcoming').length})</TabsTrigger>
          <TabsTrigger value="overdue">متأخرة ({items.filter(m => m.status === 'overdue').length})</TabsTrigger>
          <TabsTrigger value="completed">تمت ({items.filter(m => m.status === 'completed').length})</TabsTrigger>
          <TabsTrigger value="all">الكل ({items.length})</TabsTrigger>
        </TabsList>

        {['upcoming', 'overdue', 'completed', 'all'].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? (
              <p className="text-muted-foreground">جاري التحميل...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredByStatus(tab).map((m, i) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card
                      className={`card-shadow border-r-4 cursor-pointer hover:bg-muted/30 transition-colors ${m.status === 'overdue' ? 'border-r-destructive' : m.status === 'completed' ? 'border-r-muted' : 'border-r-secondary'}`}
                      onClick={() => setSelectedItem(m)}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm truncate">{m.customer_name}</h3>
                            <p className="text-xs text-muted-foreground truncate">{m.product_name}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Badge variant={m.status === 'overdue' ? 'destructive' : m.status === 'completed' ? 'secondary' : 'outline'} className="text-[10px]">
                              {statusLabel(m.status)}
                            </Badge>
                            {!isDemoItem(m.id) && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(m, e)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => handleDeleteMaintenance(m, e)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {m.type}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateDisplay(m.next_date)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>الفني: <span className="font-medium">{m.technician || '—'}</span></span>
                          {(m.cost ?? 0) > 0 && (
                            <span className="font-bold text-primary">{Number(m.cost).toLocaleString()} ج.م</span>
                          )}
                        </div>
                        {m.notes && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 bg-muted/30 rounded px-2 py-1">
                            ملاحظات: {m.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
            {!loading && filteredByStatus(tab).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد صيانات {tab === 'all' ? '' : tab === 'upcoming' ? 'قادمة' : tab === 'overdue' ? 'متأخرة' : 'مكتملة'}</p>
                <Button variant="outline" className="mt-3" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 ml-2" /> جدولة صيانة جديدة
                </Button>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">تفاصيل الصيانة</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <DetailRow icon={<User className="h-4 w-4" />} label="العميل" value={selectedItem.customer_name} />
                <DetailRow icon={<Phone className="h-4 w-4" />} label="التليفون" value={selectedItem.phone || '—'} isPhone />
                <DetailRow icon={<Wrench className="h-4 w-4" />} label="المنتج" value={selectedItem.product_name} />
                <DetailRow icon={<Wrench className="h-4 w-4" />} label="نوع الصيانة" value={selectedItem.type} />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="التاريخ" value={formatDateDisplay(selectedItem.next_date)} />
                <DetailRow icon={<User className="h-4 w-4" />} label="الفني" value={selectedItem.technician || '—'} />
                <DetailRow icon={<DollarSign className="h-4 w-4" />} label="التكلفة" value={`${Number(selectedItem.cost || 0).toLocaleString()} ج.م`} />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">الحالة:</span>
                  <Badge variant={selectedItem.status === 'overdue' ? 'destructive' : selectedItem.status === 'completed' ? 'secondary' : 'outline'}>
                    {statusLabel(selectedItem.status)}
                  </Badge>
                </div>
              </div>
              {selectedItem.notes && (
                <div className="border-t pt-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <StickyNote className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">ملاحظات</span>
                  </div>
                  <p className="text-sm bg-muted/40 rounded-lg p-3">{selectedItem.notes}</p>
                </div>
              )}
              <div className="border-t pt-3 flex flex-wrap gap-2">
                {!isDemoItem(selectedItem.id) && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(selectedItem)}>
                      <Edit className="h-3.5 w-3.5" /> تعديل الصيانة
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDeleteMaintenance(selectedItem)}>
                      <Trash2 className="h-3.5 w-3.5" /> حذف
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setSelectedItem(null); navigate('/customers'); }}>
                  <Users className="h-3.5 w-3.5" /> العملاء
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setSelectedItem(null); navigate('/work-orders'); }}>
                  <ClipboardList className="h-3.5 w-3.5" /> أوامر العمل
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setSelectedItem(null); navigate('/products'); }}>
                  <Package className="h-3.5 w-3.5" /> المنتجات
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddDialog open={addOpen} onOpenChange={setAddOpen} title="جدولة صيانة جديدة" fields={maintenanceFields} onSubmit={handleAdd} loading={saving} />
      <AddDialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingItem(null); }} title="تعديل الصيانة" fields={maintenanceFields} onSubmit={handleEdit} loading={saving} initialValues={editInitialValues} />
    </motion.div>
  );
}

function DetailRow({ icon, label, value, isPhone }: { icon: React.ReactNode; label: string; value: string; isPhone?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {isPhone && value !== '—' ? (
          <a href={`tel:${value}`} className="font-medium text-primary underline">{value}</a>
        ) : (
          <p className="font-medium">{value}</p>
        )}
      </div>
    </div>
  );
}
