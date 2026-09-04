import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, UserPlus, Warehouse, Package, ArrowRightLeft, Search, Pencil, Trash2, Headset } from 'lucide-react';
import { AddDialog } from '@/components/AddDialog';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { promptDeletePassword } from '@/lib/deletePassword';
import { normalizeStorageLocation, STORAGE_MAIN, STORAGE_SHOWROOM } from '@/lib/storageLocation';

interface Rep {
  id: string;
  full_name: string;
  branch_id: string;
  phone?: string;
}

const repFields = [
  { name: 'full_name', label: 'اسم المندوب', required: true },
  { name: 'email', label: 'البريد الإلكتروني', required: true },
  { name: 'password', label: 'كلمة المرور', required: true },
  { name: 'phone', label: 'رقم الهاتف' },
  { name: 'branch_id', label: 'الفرع', type: 'select' as const, options: [
    { value: '1', label: 'فرع الإسكندرية' },
    { value: '2', label: 'فرع الجيزة' },
  ], defaultValue: '1' },
];

const warehouseKeeperFields = [
  { name: 'full_name', label: 'اسم أمين المخزن', required: true },
  { name: 'email', label: 'البريد الإلكتروني', required: true },
  { name: 'password', label: 'كلمة المرور', required: true },
  { name: 'phone', label: 'رقم الهاتف' },
  { name: 'branch_id', label: 'الفرع', type: 'select' as const, options: [
    { value: '1', label: 'فرع الإسكندرية' },
    { value: '2', label: 'فرع الجيزة' },
  ], defaultValue: '1' },
];

const customerServiceFields = [
  { name: 'full_name', label: 'اسم موظف خدمة العملاء', required: true },
  { name: 'email', label: 'البريد الإلكتروني', required: true },
  { name: 'password', label: 'كلمة المرور', required: true },
  { name: 'phone', label: 'رقم الهاتف' },
  { name: 'branch_id', label: 'الفرع', type: 'select' as const, options: [
    { value: '1', label: 'فرع الإسكندرية' },
    { value: '2', label: 'فرع الجيزة' },
  ], defaultValue: '1' },
];

interface RepInventoryItem {
  id: string;
  rep_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  branch: string;
}

interface ProductBasic {
  id: string;
  name: string;
  stock: number;
  storage_location?: string | null;
}

interface RepTransferRow {
  id: string;
  product_id: string;
  quantity: number;
  from_type?: string | null;
  notes?: string | null;
  created_at: string;
  product_name?: string;
}

export default function SalesRepsPage({ isAdmin }: { isAdmin?: boolean }) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [warehouseKeepers, setWarehouseKeepers] = useState<Rep[]>([]);
  const [customerServiceUsers, setCustomerServiceUsers] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addWkOpen, setAddWkOpen] = useState(false);
  const [addCsOpen, setAddCsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { branch } = useUserBranch();

  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [repInventory, setRepInventory] = useState<RepInventoryItem[]>([]);
  const [mainProducts, setMainProducts] = useState<ProductBasic[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ product_id: '', quantity: '1' });
  const [transferSource, setTransferSource] = useState<string>(STORAGE_MAIN);
  const [transferSaving, setTransferSaving] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [repTransfers, setRepTransfers] = useState<RepTransferRow[]>([]);
  const [editRepOpen, setEditRepOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<Rep | null>(null);
  const [repEditForm, setRepEditForm] = useState({ full_name: '', phone: '', branch_id: '1' });
  const [editWkOpen, setEditWkOpen] = useState(false);
  const [editingWk, setEditingWk] = useState<Rep | null>(null);
  const [wkEditForm, setWkEditForm] = useState({ full_name: '', phone: '', branch_id: '1' });

  const fetchReps = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'sales_rep');
    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      if (profiles) setReps(profiles as Rep[]);
      else setReps([]);
    } else setReps([]);
  };

  const fetchWarehouseKeepers = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'warehouse_keeper');
    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      if (profiles) setWarehouseKeepers(profiles as Rep[]);
      else setWarehouseKeepers([]);
    } else setWarehouseKeepers([]);
  };

  const fetchCustomerServiceUsers = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'customer_service');
    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      if (profiles) setCustomerServiceUsers(profiles as Rep[]);
      else setCustomerServiceUsers([]);
    } else setCustomerServiceUsers([]);
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchReps(), fetchWarehouseKeepers(), fetchCustomerServiceUsers()]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAddRep = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_rep',
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          branch_id: values.branch_id || '1',
          phone: values.phone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'تم إنشاء حساب المندوب بنجاح', description: `الإيميل: ${values.email}` });
      setAddOpen(false);
      fetchReps();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddWarehouseKeeper = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_warehouse_keeper',
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          branch_id: values.branch_id || '1',
          phone: values.phone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'تم إنشاء حساب أمين المخزن بنجاح', description: `الإيميل: ${values.email}` });
      setAddWkOpen(false);
      fetchWarehouseKeepers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomerService = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_customer_service',
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          branch_id: values.branch_id || '1',
          phone: values.phone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'تم إنشاء حساب خدمة العملاء بنجاح', description: `الإيميل: ${values.email}` });
      setAddCsOpen(false);
      fetchCustomerServiceUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const fetchRepInventory = async (repId: string) => {
    if (!repId) { setRepInventory([]); return; }
    const { data } = await (supabase as any).from('rep_inventory').select('*').eq('rep_id', repId);
    const items = Array.isArray(data) ? data as RepInventoryItem[] : [];
    const prodIds = items.map(i => i.product_id).filter(Boolean);
    if (prodIds.length > 0) {
      const { data: prods } = await supabase.from('products').select('id,name').in('id', prodIds);
      const prodMap = new Map((prods || []).map((p: any) => [p.id, p.name]));
      items.forEach(i => { i.product_name = prodMap.get(i.product_id) || 'منتج'; });
    }
    setRepInventory(items);
  };

  const fetchMainProducts = async () => {
    const bv = branchDbValuesForUiBranch(branch);
    const { data, error } = await supabase
      .from('products')
      .select('id,name,stock,storage_location')
      .in('branch', bv)
      .limit(2000);
    if (error && /storage_location|Unknown column/i.test(error.message || '')) {
      const { data: d2 } = await supabase.from('products').select('id,name,stock').in('branch', bv).limit(2000);
      setMainProducts(Array.isArray(d2) ? (d2 as ProductBasic[]) : []);
      return;
    }
    setMainProducts(Array.isArray(data) ? (data as ProductBasic[]) : []);
  };

  useEffect(() => {
    fetchMainProducts();
  }, [branch]);

  const fetchRepTransfers = async (repId: string) => {
    if (!repId) {
      setRepTransfers([]);
      return;
    }
    const { data } = await (supabase as any)
      .from('rep_inventory_transfers')
      .select('*')
      .eq('to_rep_id', repId)
      .order('created_at', { ascending: false })
      .limit(200);
    const rows = Array.isArray(data) ? (data as RepTransferRow[]) : [];
    const prodIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))];
    if (prodIds.length > 0) {
      const { data: prods } = await supabase.from('products').select('id,name').in('id', prodIds);
      const prodMap = new Map((prods || []).map((p: any) => [p.id, p.name]));
      rows.forEach((r) => {
        r.product_name = prodMap.get(r.product_id) || 'منتج';
      });
    }
    setRepTransfers(rows);
  };

  useEffect(() => {
    if (selectedRepId) {
      fetchRepInventory(selectedRepId);
      fetchRepTransfers(selectedRepId);
    } else {
      setRepTransfers([]);
    }
  }, [selectedRepId]);

  const filteredTransferProducts = useMemo(() => {
    const byLoc = mainProducts.filter(
      (p) => normalizeStorageLocation(p.storage_location) === transferSource,
    );
    const term = productSearchTerm.trim().toLowerCase();
    const list = !term ? byLoc : byLoc.filter((p) => (p.name || '').toLowerCase().includes(term));
    return list.slice(0, 20);
  }, [mainProducts, productSearchTerm, transferSource]);

  const handleTransfer = async () => {
    if (!selectedRepId || !transferForm.product_id) {
      toast({ title: 'خطأ', description: 'اختر المندوب والمنتج', variant: 'destructive' });
      return;
    }
    const qty = Math.max(1, Number(transferForm.quantity) || 1);
    const prod = mainProducts.find(p => p.id === transferForm.product_id);
    if (!prod || normalizeStorageLocation(prod.storage_location) !== transferSource) {
      toast({ title: 'خطأ', description: 'المنتج غير مطابق لمصدر التحويل المختار', variant: 'destructive' });
      return;
    }
    if (prod.stock < qty) {
      const srcLabel = transferSource === STORAGE_SHOWROOM ? 'المعرض' : 'المخزن الرئيسي';
      toast({ title: 'خطأ', description: `الكمية المتاحة في ${srcLabel} غير كافية (${prod.stock})`, variant: 'destructive' });
      return;
    }
    setTransferSaving(true);
    try {
      const existing = repInventory.find(i => i.product_id === transferForm.product_id);
      if (existing) {
        await (supabase as any).from('rep_inventory').update({ quantity: (existing.quantity || 0) + qty }).eq('id', existing.id);
      } else {
        await (supabase as any).from('rep_inventory').insert({
          id: crypto.randomUUID(),
          rep_id: selectedRepId,
          product_id: transferForm.product_id,
          quantity: qty,
          branch: canonicalBranchForSave(branch),
        });
      }
      const fromTypeDb = transferSource === STORAGE_SHOWROOM ? 'showroom' : 'main';
      const sourceLabel = transferSource === STORAGE_SHOWROOM ? 'المعرض' : 'المخزن الرئيسي';
      await (supabase as any).from('rep_inventory_transfers').insert({
        id: crypto.randomUUID(),
        from_type: fromTypeDb,
        to_rep_id: selectedRepId,
        product_id: transferForm.product_id,
        quantity: qty,
        notes: `تحويل من ${sourceLabel}`,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      await supabase.from('products').update({ stock: Math.max(0, prod.stock - qty) }).eq('id', transferForm.product_id);
      await supabase.from('stock_movements').insert({
        id: crypto.randomUUID(),
        product_id: transferForm.product_id,
        branch: canonicalBranchForSave(branch),
        type: 'sale',
        quantity: qty,
        reference_type: 'rep_transfer',
        reference_id: selectedRepId,
        notes: `تحويل من ${sourceLabel} — لمخزون الفني ${reps.find(r => r.id === selectedRepId)?.full_name || ''}`,
      });
      toast({ title: 'تم التحويل بنجاح' });
      setTransferOpen(false);
      setTransferForm({ product_id: '', quantity: '1' });
      setProductSearchTerm('');
      fetchRepInventory(selectedRepId);
      fetchRepTransfers(selectedRepId);
      fetchMainProducts();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setTransferSaving(false);
    }
  };

  const branchName = (id: string) => id === '1' ? 'الإسكندرية' : id === '2' ? 'الجيزة' : 'غير محدد';

  const saveRepEdit = async () => {
    if (!editingRep) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: repEditForm.full_name.trim(),
        phone: repEditForm.phone.trim() || null,
        branch_id: repEditForm.branch_id,
      }).eq('id', editingRep.id);
      if (error) throw error;
      toast({ title: 'تم تحديث بيانات المندوب' });
      setEditRepOpen(false);
      setEditingRep(null);
      fetchReps();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRep = async (r: Rep) => {
    if (!confirm(`إزالة المندوب «${r.full_name}» من القائمة؟ (لا يحذف الحساب نهائياً من قاعدة المستخدمين)`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', r.id).eq('role', 'sales_rep');
      if (error) throw error;
      toast({ title: 'تمت إزالة صلاحية المندوب' });
      if (selectedRepId === r.id) setSelectedRepId('');
      fetchReps();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const saveWkEdit = async () => {
    if (!editingWk) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: wkEditForm.full_name.trim(),
        phone: wkEditForm.phone.trim() || null,
        branch_id: wkEditForm.branch_id,
      }).eq('id', editingWk.id);
      if (error) throw error;
      toast({ title: 'تم تحديث بيانات أمين المخزن' });
      setEditWkOpen(false);
      setEditingWk(null);
      fetchWarehouseKeepers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteWk = async (wk: Rep) => {
    if (!confirm(`إزالة أمين المخزن «${wk.full_name}» من القائمة؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', wk.id).eq('role', 'warehouse_keeper');
      if (error) throw error;
      toast({ title: 'تمت إزالة صلاحية أمين المخزن' });
      fetchWarehouseKeepers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const deleteCs = async (cs: Rep) => {
    if (!confirm(`إزالة حساب خدمة العملاء «${cs.full_name}» من القائمة؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', cs.id).eq('role', 'customer_service');
      if (error) throw error;
      toast({ title: 'تمت إزالة صلاحية خدمة العملاء' });
      fetchCustomerServiceUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الموظفين</h1>
        <p className="text-sm text-muted-foreground mt-1">إنشاء حسابات المناديب وخدمة العملاء وأمناء المخزن من هنا فقط (بعد الأدمن الأول).</p>
      </div>

      <Tabs defaultValue="reps" className="space-y-4">
        <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="reps" className="gap-1"><Clock className="h-3.5 w-3.5" /> المناديب ({reps.length})</TabsTrigger>
          <TabsTrigger value="customer-service" className="gap-1"><Headset className="h-3.5 w-3.5" /> خدمة عملاء ({customerServiceUsers.length})</TabsTrigger>
          <TabsTrigger value="warehouse" className="gap-1"><Warehouse className="h-3.5 w-3.5" /> أمناء المخزن ({warehouseKeepers.length})</TabsTrigger>
          <TabsTrigger value="rep-inventory" className="gap-1"><Package className="h-3.5 w-3.5" /> مخزون الفني</TabsTrigger>
        </TabsList>

        <TabsContent value="reps" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">حسابات المندوبين (مبيعات)</p>
            {isAdmin && (
              <Button className="gap-2" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" /> إضافة مندوب
              </Button>
            )}
          </div>
          {loading ? (
            <p className="text-muted-foreground">جاري التحميل...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reps.map((rep, i) => (
                <motion.div key={rep.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="card-shadow">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                          {rep.full_name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold">{rep.full_name}</h3>
                          <p className="text-xs text-muted-foreground">فرع {branchName(rep.branch_id)}</p>
                        </div>
                      </div>
                      {rep.phone && <p className="text-xs text-muted-foreground">{rep.phone}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="gap-1 text-[10px]">مندوب</Badge>
                        <Badge variant="outline" className="gap-1 text-[10px]"><MapPin className="h-3 w-3" /> {branchName(rep.branch_id)}</Badge>
                        {isAdmin && (
                          <span className="mr-auto flex gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="تعديل"
                              onClick={() => { setEditingRep(rep); setRepEditForm({ full_name: rep.full_name, phone: rep.phone || '', branch_id: rep.branch_id || '1' }); setEditRepOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="حذف من القائمة"
                              onClick={() => deleteRep(rep)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {reps.length === 0 && <p className="text-muted-foreground col-span-full">لا يوجد مناديب</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="customer-service" className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">حسابات خدمة العملاء — العملاء، الفواتير، الزيارات، أوامر العمل</p>
            {isAdmin && (
              <Button className="gap-2" onClick={() => setAddCsOpen(true)}>
                <Headset className="h-4 w-4" /> إضافة خدمة عملاء
              </Button>
            )}
          </div>
          {loading ? (
            <p className="text-muted-foreground">جاري التحميل...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customerServiceUsers.map((cs, i) => (
                <motion.div key={cs.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="card-shadow">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-teal-500/15 flex items-center justify-center text-teal-700 font-bold">
                          <Headset className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-bold">{cs.full_name}</h3>
                          <p className="text-xs text-muted-foreground">فرع {branchName(cs.branch_id)}</p>
                        </div>
                      </div>
                      {cs.phone && <p className="text-xs text-muted-foreground">{cs.phone}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="gap-1 text-[10px]">خدمة عملاء</Badge>
                        <Badge variant="outline" className="gap-1 text-[10px]"><MapPin className="h-3 w-3" /> {branchName(cs.branch_id)}</Badge>
                        {isAdmin && (
                          <span className="mr-auto flex gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="إزالة"
                              onClick={() => deleteCs(cs)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {customerServiceUsers.length === 0 && <p className="text-muted-foreground col-span-full">لا يوجد حسابات خدمة عملاء. اضغط «إضافة خدمة عملاء» لإنشاء حساب.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="warehouse" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">حسابات أمناء المخزن — صلاحية المنتجات والمخزون والأقسام والتقارير (بدون حساب الأرباح والخسائر)</p>
            {isAdmin && (
              <Button className="gap-2" onClick={() => setAddWkOpen(true)}>
                <Warehouse className="h-4 w-4" /> إضافة أمين مخزن
              </Button>
            )}
          </div>
          {loading ? (
            <p className="text-muted-foreground">جاري التحميل...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouseKeepers.map((wk, i) => (
                <motion.div key={wk.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="card-shadow">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          <Warehouse className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-bold">{wk.full_name}</h3>
                          <p className="text-xs text-muted-foreground">فرع {branchName(wk.branch_id)}</p>
                        </div>
                      </div>
                      {wk.phone && <p className="text-xs text-muted-foreground">{wk.phone}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="secondary" className="gap-1 text-[10px]">أمين مخزن</Badge>
                        <Badge variant="outline" className="gap-1 text-[10px]"><MapPin className="h-3 w-3" /> {branchName(wk.branch_id)}</Badge>
                        {isAdmin && (
                          <span className="mr-auto flex gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="تعديل"
                              onClick={() => { setEditingWk(wk); setWkEditForm({ full_name: wk.full_name, phone: wk.phone || '', branch_id: wk.branch_id || '1' }); setEditWkOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="حذف من القائمة"
                              onClick={() => deleteWk(wk)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {warehouseKeepers.length === 0 && <p className="text-muted-foreground col-span-full">لا يوجد أمناء مخزن. اضغط «إضافة أمين مخزن» لإنشاء حساب.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rep-inventory" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">إدارة مخزون الفني / المندوب — اختر مندوباً لعرض مخزونه</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-64">
              <Select value={selectedRepId || 'none'} onValueChange={v => setSelectedRepId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="اختر المندوب / الفني" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— اختر مندوب —</SelectItem>
                  {reps.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRepId && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-56 space-y-1">
                  <Label className="text-xs text-muted-foreground">التحويل من — اختر المخزن الرئيسي أو المعرض</Label>
                  <Select
                    value={transferSource}
                    onValueChange={(v) => {
                      const loc = normalizeStorageLocation(v);
                      setTransferSource(loc);
                      setTransferForm((f) => ({ ...f, product_id: '' }));
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="اختر المصدر" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STORAGE_MAIN}>المخزن الرئيسي</SelectItem>
                      <SelectItem value={STORAGE_SHOWROOM}>المعرض</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  className="gap-2 shrink-0"
                  onClick={() => {
                    setTransferForm({ product_id: '', quantity: '1' });
                    setProductSearchTerm('');
                    setTransferOpen(true);
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4" /> تحويل للفني
                </Button>
              </div>
            )}
          </div>
          {selectedRepId ? (
            <>
              {repInventory.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">لا يوجد مخزون لهذا الفني — اختر المصدر من القائمة ثم اضغط «تحويل للفني» لإضافة منتجات</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {repInventory.map(item => (
                    <Card key={item.id} className="card-shadow">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.product_name || 'منتج'}</p>
                          <p className="text-xs text-muted-foreground">الكمية الحالية</p>
                        </div>
                        <Badge variant="secondary" className="text-lg font-bold px-3">{item.quantity}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" /> سجل التوريد للفني (بالتاريخ — الأحدث أولاً)
                </h3>
                {repTransfers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد حركات توريد مسجلة بعد.</p>
                ) : (
                  <div className="border rounded-md overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/80 sticky top-0">
                        <tr>
                          <th className="text-right p-2 font-medium">التاريخ والوقت</th>
                          <th className="text-right p-2 font-medium">المنتج</th>
                          <th className="text-right p-2 font-medium w-24">المصدر</th>
                          <th className="text-center p-2 font-medium w-16">الكمية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repTransfers.map((t) => {
                          const src =
                            t.from_type === 'showroom'
                              ? 'المعرض'
                              : t.from_type === 'main'
                                ? 'المخزن الرئيسي'
                                : t.notes?.includes('المعرض')
                                  ? 'المعرض'
                                  : 'المخزن الرئيسي';
                          return (
                          <tr key={t.id} className="border-t">
                            <td className="p-2 whitespace-nowrap" dir="ltr">
                              {t.created_at ? String(t.created_at).replace('T', ' ').slice(0, 19) : '—'}
                            </td>
                            <td className="p-2">{t.product_name || 'منتج'}</td>
                            <td className="p-2 text-muted-foreground">{src}</td>
                            <td className="p-2 text-center font-semibold">{t.quantity}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-6">اختر مندوباً من القائمة أعلاه</p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) {
            setTransferForm({ product_id: '', quantity: '1' });
            setProductSearchTerm('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تحويل منتج إلى مخزون الفني</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الفني / المندوب</Label>
              <Input value={reps.find(r => r.id === selectedRepId)?.full_name || ''} disabled className="bg-muted" />
            </div>
            <div>
              <Label>مصدر التحويل</Label>
              <Select
                value={transferSource}
                onValueChange={(v) => {
                  const loc = normalizeStorageLocation(v);
                  setTransferSource(loc);
                  setTransferForm((f) => ({ ...f, product_id: '' }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={STORAGE_MAIN}>المخزن الرئيسي</SelectItem>
                  <SelectItem value={STORAGE_SHOWROOM}>المعرض</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">يظهر فقط الأصناف المسجّلة تحت الموقع المختار في بطاقة المنتج.</p>
            </div>
            <div>
              <Label>بحث عن منتج</Label>
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="اكتب اسم المنتج..." value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} className="pr-9" />
              </div>
            </div>
            <div>
              <Label>اختر المنتج</Label>
              <Select value={transferForm.product_id || 'none'} onValueChange={v => setTransferForm(f => ({ ...f, product_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— اختر منتج —</SelectItem>
                  {filteredTransferProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (متاح: {p.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredTransferProducts.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  لا توجد أصناف في {transferSource === STORAGE_SHOWROOM ? 'المعرض' : 'المخزن الرئيسي'} لهذا الفرع — أضف منتجاً بهذا الموقع أو غيّر الموقع في بطاقة المنتج.
                </p>
              )}
            </div>
            <div>
              <Label>الكمية</Label>
              <Input type="number" min="1" value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <Button onClick={handleTransfer} disabled={transferSaving} className="w-full">
              {transferSaving ? 'جاري التحويل...' : 'تأكيد التحويل'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editRepOpen} onOpenChange={setEditRepOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تعديل مندوب</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم</Label><Input value={repEditForm.full_name} onChange={e => setRepEditForm(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>الهاتف</Label><Input value={repEditForm.phone} onChange={e => setRepEditForm(p => ({ ...p, phone: e.target.value }))} dir="ltr" /></div>
            <div>
              <Label>الفرع</Label>
              <Select value={repEditForm.branch_id} onValueChange={v => setRepEditForm(p => ({ ...p, branch_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">فرع الإسكندرية</SelectItem>
                  <SelectItem value="2">فرع الجيزة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={saveRepEdit} disabled={saving}>{saving ? '...' : 'حفظ'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editWkOpen} onOpenChange={setEditWkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تعديل أمين مخزن</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم</Label><Input value={wkEditForm.full_name} onChange={e => setWkEditForm(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>الهاتف</Label><Input value={wkEditForm.phone} onChange={e => setWkEditForm(p => ({ ...p, phone: e.target.value }))} dir="ltr" /></div>
            <div>
              <Label>الفرع</Label>
              <Select value={wkEditForm.branch_id} onValueChange={v => setWkEditForm(p => ({ ...p, branch_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">فرع الإسكندرية</SelectItem>
                  <SelectItem value="2">فرع الجيزة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={saveWkEdit} disabled={saving}>{saving ? '...' : 'حفظ'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <>
          <AddDialog open={addOpen} onOpenChange={setAddOpen} title="إضافة مندوب جديد" fields={repFields} onSubmit={handleAddRep} loading={saving} />
          <AddDialog open={addWkOpen} onOpenChange={setAddWkOpen} title="إضافة أمين مخزن" fields={warehouseKeeperFields} onSubmit={handleAddWarehouseKeeper} loading={saving} />
          <AddDialog open={addCsOpen} onOpenChange={setAddCsOpen} title="إضافة حساب خدمة عملاء" fields={customerServiceFields} onSubmit={handleAddCustomerService} loading={saving} />
        </>
      )}
    </motion.div>
  );
}
