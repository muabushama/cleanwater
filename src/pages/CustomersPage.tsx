import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, Phone, MessageCircle, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CustomerDetailDialog } from '@/components/CustomerDetailDialog';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';

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

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sectorId, setSectorId] = useState('');
  const [addForm, setAddForm] = useState({ name: '', phone1: '', phone2: '', whatsapp: '', address: '', region: '', notes: '', area_id: '' });
  const { toast } = useToast();
  const { branch } = useUserBranch();

  const sectors = areas.filter(a => !a.parent_id);
  const getAreasUnderSector = (parentId: string) => areas.filter(a => a.parent_id === parentId);
  const areaOptions = sectorId ? getAreasUnderSector(sectorId) : [];

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').eq('branch', branch).order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setCustomers(data as Customer[]);
    } else {
      setCustomers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
    supabase.from('areas').select('id,name,parent_id').eq('branch', branch).order('name').then(({ data }) => setAreas(Array.isArray(data) ? (data as { id: string; name: string; parent_id: string | null }[]) : []));
  }, [branch]);

  const searchTrim = search.trim();
  const filtered = customers.filter(c =>
    !searchTrim ||
    c.name.includes(searchTrim) ||
    c.address.includes(searchTrim) ||
    (c.phone1 && c.phone1.includes(searchTrim)) ||
    (c.phone2 && c.phone2.includes(searchTrim)) ||
    (c.whatsapp && c.whatsapp.includes(searchTrim))
  );

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.phone1.trim() || !addForm.address.trim()) {
      toast({ title: 'خطأ', description: 'الاسم والهاتف والعنوان مطلوبون', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from('customers').insert({
        name: addForm.name.trim(),
        phone1: addForm.phone1,
        phone2: addForm.phone2 || '',
        whatsapp: addForm.whatsapp || '',
        address: addForm.address.trim(),
        region: addForm.region || '',
        area_id: addForm.area_id || null,
        notes: addForm.notes || '',
        branch: branch,
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: 'تم إضافة العميل بنجاح' });
      setAddOpen(false);
      setAddForm({ name: '', phone1: '', phone2: '', whatsapp: '', address: '', region: '', notes: '', area_id: '' });
      setSectorId('');
      fetchCustomers();
    } catch (err: unknown) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العملاء</h1>
          <p className="text-muted-foreground text-sm">{customers.length} عميل</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> إضافة عميل
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث بالاسم، العنوان أو رقم التلفون..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((customer, i) => (
            <motion.div key={customer.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="card-shadow hover:card-shadow-lg transition-shadow cursor-pointer" onClick={() => openDetail(customer)}>
                <CardContent className="p-5 space-y-3 relative">
                  <div className="absolute left-2 top-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:bg-green-100"
                      onClick={e => { e.stopPropagation(); const n = (customer.whatsapp || customer.phone1 || '').replace(/[^0-9]/g, ''); const w = n.startsWith('0') ? '20' + n.slice(1) : (n.startsWith('20') ? n : '20' + n); if (w) window.open(`https://wa.me/${w}`, '_blank'); }}
                      title="إرسال واتساب"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-bold text-base pr-10">{customer.name}</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span>{customer.phone1}</span></div>
                    {customer.whatsapp && <div className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5 text-green-600" /><span>{customer.whatsapp}</span></div>}
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /><span>{customer.address}</span></div>
                  </div>
                  {customer.notes && (
                    <p className="text-xs bg-accent/50 text-accent-foreground p-2 rounded-lg">{customer.notes}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) { setSectorId(''); setAddForm({ name: '', phone1: '', phone2: '', whatsapp: '', address: '', region: '', notes: '', area_id: '' }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة عميل جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>اسم العميل *</Label><Input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="الاسم" /></div>
            <div><Label>رقم الهاتف *</Label><Input value={addForm.phone1} onChange={e => setAddForm(p => ({ ...p, phone1: e.target.value }))} placeholder="الهاتف" /></div>
            <div><Label>هاتف بديل</Label><Input value={addForm.phone2} onChange={e => setAddForm(p => ({ ...p, phone2: e.target.value }))} placeholder="بديل" /></div>
            <div><Label>رقم الواتساب</Label><Input value={addForm.whatsapp} onChange={e => setAddForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="واتساب" /></div>
            <div><Label>العنوان *</Label><Input value={addForm.address} onChange={e => setAddForm(p => ({ ...p, address: e.target.value }))} placeholder="العنوان" /></div>
            <div><Label>المنطقة (نص حر)</Label><Input value={addForm.region} onChange={e => setAddForm(p => ({ ...p, region: e.target.value }))} placeholder="المنطقة" /></div>
            {sectors.length > 0 && (
              <>
                <div>
                  <Label>القطاع</Label>
                  <Select value={sectorId} onValueChange={v => { setSectorId(v); setAddForm(p => ({ ...p, area_id: '' })); }}>
                    <SelectTrigger><SelectValue placeholder="اختر القطاع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون</SelectItem>
                      {sectors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المنطقة (من داخل القطاع)</Label>
                  <Select value={addForm.area_id} onValueChange={v => setAddForm(p => ({ ...p, area_id: v }))} disabled={!sectorId}>
                    <SelectTrigger><SelectValue placeholder={sectorId ? 'اختر المنطقة' : 'اختر القطاع أولاً'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون</SelectItem>
                      {areaOptions.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div><Label>ملاحظات</Label><Textarea value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات" rows={2} /></div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleAdd} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CustomerDetailDialog customer={selectedCustomer} open={detailOpen} onOpenChange={setDetailOpen} />
    </motion.div>
  );
}
