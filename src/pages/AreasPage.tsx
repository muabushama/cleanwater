import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, MapPin, Users, Search } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { promptDeletePassword } from '@/lib/deletePassword';

interface Area {
  id: string;
  name: string;
  parent_id: string | null;
  branch: string;
}

interface SimpleCustomer {
  id: string;
  name: string;
  phone1: string;
  address: string;
  area_id?: string | null;
}

export default function AreasPage() {
  const { branch } = useUserBranch();
  const { toast } = useToast();
  const [areas, setAreas] = useState<Area[]>([]);
  const [customers, setCustomers] = useState<SimpleCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [parentForNewArea, setParentForNewArea] = useState<Area | null>(null);
  // form.parent_id يُستخدم لحفظ تبعية المنطقة الجديدة، أو تبعية المنطقة الحالية عند التعديل
  const [form, setForm] = useState({ name: '', parent_id: '' as string });
  const [customersDialogArea, setCustomersDialogArea] = useState<Area | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone1: '', address: '', notes: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const [{ data: areasData }, { data: customersData }] = await Promise.all([
        supabase.from('areas').select('*').in('branch', branchDbValuesForUiBranch(branch)).order('name'),
        supabase.from('customers').select('id,name,phone1,address,area_id').in('branch', branchDbValuesForUiBranch(branch)),
      ]);
      setAreas(Array.isArray(areasData) ? (areasData as Area[]) : []);
      setCustomers(Array.isArray(customersData) ? (customersData as SimpleCustomer[]) : []);
    } catch {
      setAreas([]);
      setCustomers([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAreas(); }, [branch]);

  const roots = areas.filter(a => !a.parent_id);
  const getChildren = (parentId: string) => areas.filter(a => a.parent_id === parentId);
  const customersForArea = (areaId: string) => customers.filter(c => c.area_id === areaId);
  const customersWithoutArea = () => customers.filter(c => !c.area_id);
  const allAreaOptions = useMemo(() => {
    return areas.map((a) => ({
      id: a.id,
      name: a.name,
      isSector: !a.parent_id,
      parentName: a.parent_id ? areas.find((x) => x.id === a.parent_id)?.name || '' : '',
    }));
  }, [areas]);
  const areaSearchTerm = areaSearch.trim().toLowerCase();
  const areaSuggestions = useMemo(() => {
    if (!areaSearchTerm) return allAreaOptions.slice(0, 8);
    return allAreaOptions
      .filter((a) => a.name.toLowerCase().includes(areaSearchTerm) || a.parentName.toLowerCase().includes(areaSearchTerm))
      .slice(0, 8);
  }, [allAreaOptions, areaSearchTerm]);
  const filteredRoots = useMemo(() => {
    if (!areaSearchTerm) return roots;
    return roots.filter((r) => {
      if (r.name.toLowerCase().includes(areaSearchTerm)) return true;
      return getChildren(r.id).some((c) => c.name.toLowerCase().includes(areaSearchTerm));
    });
  }, [roots, areas, areaSearchTerm]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'خطأ', description: 'اسم المنطقة مطلوب', variant: 'destructive' });
      return;
    }
    try {
      const parentIdToUse = editingArea ? editingArea.parent_id : (parentForNewArea?.id || null);
      const payload = {
        name: form.name.trim(),
        parent_id: parentIdToUse,
        branch: canonicalBranchForSave(branch),
      };
      if (editingArea) {
        const { error } = await supabase.from('areas').update(payload).eq('id', editingArea.id);
        if (error) throw error;
        toast({ title: 'تم تعديل المنطقة' });
        setEditOpen(false);
        setEditingArea(null);
      } else {
        const { error } = await supabase.from('areas').insert({ ...payload, id: crypto.randomUUID() });
        if (error) throw error;
        toast({ title: parentForNewArea ? 'تم إضافة المنطقة' : 'تم إضافة القطاع' });
        setAddOpen(false);
      }
      setForm({ name: '', parent_id: '' });
      setParentForNewArea(null);
      fetchAreas();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleAssignExistingCustomer = async (customer: SimpleCustomer, area: Area) => {
    try {
      const { error } = await supabase.from('customers').update({ area_id: area.id }).eq('id', customer.id);
      if (error) throw error;
      toast({ title: 'تم ربط العميل بالمنطقة' });
      fetchAreas();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddCustomerToArea = async (area: Area) => {
    if (!newCustomer.name.trim() || !newCustomer.phone1.trim() || !newCustomer.address.trim()) {
      toast({ title: 'خطأ', description: 'اسم العميل، الهاتف والعنوان مطلوبة', variant: 'destructive' });
      return;
    }
    setSavingCustomer(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from('customers').insert({
        name: newCustomer.name.trim(),
        phone1: newCustomer.phone1.trim(),
        phone2: '',
        whatsapp: '',
        address: newCustomer.address.trim(),
        region: '',
        area_id: area.id,
        notes: newCustomer.notes || '',
        branch: canonicalBranchForSave(branch),
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: 'تم إضافة العميل في هذه المنطقة' });
      setNewCustomer({ name: '', phone1: '', address: '', notes: '' });
      fetchAreas();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDelete = async (area: Area) => {
    const children = getChildren(area.id);
    if (children.length > 0) {
      toast({ title: 'لا يمكن الحذف', description: 'احذف المناطق الفرعية أولاً', variant: 'destructive' });
      return;
    }
    if (!confirm(`حذف المنطقة "${area.name}"؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('areas').delete().eq('id', area.id);
      if (error) throw error;
      toast({ title: 'تم حذف المنطقة' });
      fetchAreas();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">القطاعات والمناطق</h1>
          <p className="text-muted-foreground text-sm">يمكنك إضافة قطاعات جديدة، والمناطق الفرعية تتم إضافتها أو تعديلها من خارج هذه التبعية.</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setEditingArea(null);
            setParentForNewArea(null);
            setForm({ name: '', parent_id: '' });
            setAddOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> إضافة قطاع جديد
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <Card className="card-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> قائمة القطاعات والمناطق</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="relative mb-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={areaSearch}
                onChange={(e) => {
                  setAreaSearch(e.target.value);
                  setShowAreaSuggestions(true);
                }}
                onFocus={() => setShowAreaSuggestions(true)}
                onBlur={() => setTimeout(() => setShowAreaSuggestions(false), 150)}
                placeholder="ابحث في القطاعات والمناطق..."
                className="pr-8"
              />
              {showAreaSuggestions && areaSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
                  {areaSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-right px-3 py-2 text-sm hover:bg-accent/50 border-b last:border-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAreaSearch(s.name);
                        setShowAreaSuggestions(false);
                      }}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground mr-2">
                        {s.isSector ? 'قطاع' : `منطقة داخل ${s.parentName}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {filteredRoots.map(area => (
              <div key={area.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="font-medium">قطاع: {area.name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingArea(area);
                          setForm({ name: area.name, parent_id: area.parent_id || '' });
                          setEditOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setEditingArea(null);
                          setParentForNewArea(area);
                          setForm({ name: '', parent_id: area.id });
                          setAddOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> منطقة جديدة
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(area)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                {getChildren(area.id).map(sub => (
                  <div key={sub.id} className="flex items-center justify-between pr-6 py-2 text-sm text-muted-foreground border-t mt-2">
                    <span>منطقة: {sub.name} <span className="text-[11px] text-muted-foreground">({customersForArea(sub.id).length} عميل)</span></span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingArea(sub);
                          setForm({ name: sub.name, parent_id: sub.parent_id || '' });
                          setEditOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setCustomersDialogArea(sub);
                          setCustomerSearch('');
                          setNewCustomer({ name: '', phone1: '', address: '', notes: '' });
                        }}
                      >
                        <Users className="h-3 w-3 mr-1" /> عملاء
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(sub)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {filteredRoots.length === 0 && <p className="text-muted-foreground text-sm py-4">لا توجد نتائج مطابقة للبحث.</p>}
            {roots.length === 0 && <p className="text-muted-foreground text-sm py-4">لا توجد قطاعات. أضف قطاعاً أولاً ثم المناطق تحته.</p>}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={addOpen || editOpen}
        onOpenChange={open => {
          setAddOpen(open);
          setEditOpen(open);
          if (!open) {
            setEditingArea(null);
            setParentForNewArea(null);
            setForm({ name: '', parent_id: '' });
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingArea
                ? editingArea.parent_id
                  ? 'تعديل منطقة'
                  : 'تعديل قطاع'
                : parentForNewArea
                  ? `إضافة منطقة داخل القطاع ${parentForNewArea.name}`
                  : 'إضافة قطاع جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{editingArea?.parent_id || parentForNewArea ? 'اسم المنطقة' : 'اسم القطاع'}</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder={editingArea?.parent_id || parentForNewArea ? 'مثال: سيدي بشر' : 'مثال: القطاع الشمالي'}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setAddOpen(false); setEditOpen(false); }}>إلغاء</Button>
              <Button onClick={handleSave}>{editingArea ? 'تعديل' : 'إضافة'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog لإدارة عملاء كل منطقة */}
      <Dialog open={!!customersDialogArea} onOpenChange={open => { if (!open) { setCustomersDialogArea(null); setCustomerSearch(''); setNewCustomer({ name: '', phone1: '', address: '', notes: '' }); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>العملاء في منطقة: {customersDialogArea?.name}</DialogTitle>
          </DialogHeader>
          {customersDialogArea && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" /> ربط عميل موجود بهذه المنطقة
                </h3>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو الهاتف..."
                    className="pr-8"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                  {customersWithoutArea()
                    .filter(c => {
                      const term = customerSearch.trim();
                      if (!term) return true;
                      return c.name.includes(term) || c.phone1.includes(term);
                    })
                    .map(c => (
                      <div key={c.id} className="flex items-center justify-between px-2 py-1.5 text-sm">
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone1} • {c.address}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleAssignExistingCustomer(c, customersDialogArea)}
                        >
                          ربط بالمنطقة
                        </Button>
                      </div>
                    ))}
                  {customersWithoutArea().length === 0 && (
                    <p className="text-xs text-muted-foreground p-2 text-center">لا يوجد عملاء بدون منطقة حالياً.</p>
                  )}
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <h3 className="text-sm font-medium">إضافة عميل جديد داخل هذه المنطقة</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label>اسم العميل *</Label>
                    <Input
                      value={newCustomer.name}
                      onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>رقم الهاتف *</Label>
                    <Input
                      value={newCustomer.phone1}
                      onChange={e => setNewCustomer(p => ({ ...p, phone1: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>العنوان *</Label>
                  <Input
                    value={newCustomer.address}
                    onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea
                    rows={2}
                    value={newCustomer.notes}
                    onChange={e => setNewCustomer(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => handleAddCustomerToArea(customersDialogArea)}
                    disabled={savingCustomer}
                  >
                    {savingCustomer ? 'جاري الحفظ...' : 'حفظ العميل'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
