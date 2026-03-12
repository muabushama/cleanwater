import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getCategoryIcon } from '@/components/inventory/CategoryIcon';

interface InventoryCategory {
  id: string;
  name: string;
  icon_key: string;
  parent_id: string | null;
  sort_order: number;
  created_at?: string;
}

export default function InventoryCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [products, setProducts] = useState<{ id: string; category: string; classification: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryCategory | null>(null);
  const [form, setForm] = useState({ name: '', icon_key: 'default', parent_id: '' as string, sort_order: 0 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('inventory_categories').select('*').order('sort_order'),
        supabase.from('products').select('id, category, classification').limit(5000),
      ]);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    } catch {
      setCategories([]);
      setProducts([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const roots = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const productCountForCategory = (catName: string) =>
    products.filter(p => p.category === catName || p.classification === catName).length;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'خطأ', description: 'اسم القسم مطلوب', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        icon_key: form.icon_key,
        parent_id: form.parent_id || null,
        sort_order: form.sort_order,
      };
      if (editingCategory) {
        const { error } = await supabase.from('inventory_categories').update(payload).eq('id', editingCategory.id);
        if (error) throw error;
        toast({ title: 'تم تعديل القسم' });
        setEditOpen(false);
        setEditingCategory(null);
      } else {
        const { error } = await supabase.from('inventory_categories').insert({ ...payload, id: crypto.randomUUID() });
        if (error) throw error;
        toast({ title: 'تم إضافة القسم' });
        setAddOpen(false);
      }
      setForm({ name: '', icon_key: 'default', parent_id: '', sort_order: 0 });
      fetchData();
    } catch (err: unknown) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = async (cat: InventoryCategory) => {
    const count = productCountForCategory(cat.name);
    if (count > 0) {
      toast({
        title: 'لا يمكن الحذف',
        description: `يوجد ${count} منتج مرتبط بهذا القسم. غيّر تصنيف المنتجات أولاً.`,
        variant: 'destructive',
      });
      setDeleteConfirm(null);
      return;
    }
    try {
      const { error } = await supabase.from('inventory_categories').delete().eq('id', cat.id);
      if (error) throw error;
      toast({ title: 'تم حذف القسم' });
      setDeleteConfirm(null);
      fetchData();
    } catch (err: unknown) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
      setDeleteConfirm(null);
    }
  };

  const openEdit = (c: InventoryCategory) => {
    setEditingCategory(c);
    setForm({ name: c.name, icon_key: c.icon_key || 'default', parent_id: c.parent_id || '', sort_order: c.sort_order });
    setEditOpen(true);
  };

  const renderTree = (parentId: string | null, level: number) => {
    const items = parentId ? getChildren(parentId) : roots;
    return items.map(cat => {
      const IconComp = getCategoryIcon(cat.icon_key);
      const children = getChildren(cat.id);
      const productCount = productCountForCategory(cat.name);
      return (
        <div key={cat.id} className="rounded-lg border bg-card" style={{ marginRight: level * 24 }}>
          <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <IconComp className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{cat.name}</span>
              {productCount > 0 && (
                <span className="text-xs text-muted-foreground">({productCount} منتج)</span>
              )}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => setDeleteConfirm(cat)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {children.length > 0 && (
            <div className="border-t pr-4 pb-2 pt-1">
              {children.map(sub => (
                <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/20" style={{ marginRight: 16 }}>
                  <div className="flex items-center gap-2">
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    {(() => {
                      const SubIcon = getCategoryIcon(sub.icon_key);
                      return <SubIcon className="h-4 w-4 text-muted-foreground" />;
                    })()}
                    <span>{sub.name}</span>
                    {productCountForCategory(sub.name) > 0 && (
                      <span className="text-xs text-muted-foreground">({productCountForCategory(sub.name)} منتج)</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sub)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(sub)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">جاري التحميل...</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">أقسام المخزون</h1>
        <Button className="gap-2" onClick={() => { setEditingCategory(null); setForm({ name: '', icon_key: 'default', parent_id: '', sort_order: categories.length }); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> إضافة قسم
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">شجرة الأقسام</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roots.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد أقسام. أضف قسماً من الزر أعلاه.</p>
          ) : (
            renderTree(null, 0)
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة قسم</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم القسم</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: فلاتر منزلية" />
            </div>
            <div>
              <Label>الأيقونة</Label>
              <Select value={form.icon_key} onValueChange={v => setForm(p => ({ ...p, icon_key: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home_filters">فلاتر منزلية</SelectItem>
                  <SelectItem value="ro">RO</SelectItem>
                  <SelectItem value="spare_parts">قطع غيار</SelectItem>
                  <SelectItem value="desalination">محطات تحلية</SelectItem>
                  <SelectItem value="default">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>نوع القسم</Label>
              <Select value={form.parent_id || 'none'} onValueChange={v => setForm(p => ({ ...p, parent_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="قسم عادي" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">قسم عادي (بدون تبعية)</SelectItem>
                  {roots.map(r => (
                    <SelectItem key={r.id} value={r.id}>تحت قسم: {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ترتيب العرض</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave}>إضافة</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={o => { setEditOpen(o); if (!o) setEditingCategory(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل القسم</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم القسم</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>الأيقونة</Label>
              <Select value={form.icon_key} onValueChange={v => setForm(p => ({ ...p, icon_key: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home_filters">فلاتر منزلية</SelectItem>
                  <SelectItem value="ro">RO</SelectItem>
                  <SelectItem value="spare_parts">قطع غيار</SelectItem>
                  <SelectItem value="desalination">محطات تحلية</SelectItem>
                  <SelectItem value="default">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>نوع القسم</Label>
              <Select value={form.parent_id || 'none'} onValueChange={v => setForm(p => ({ ...p, parent_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="قسم عادي" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">قسم عادي (بدون تبعية)</SelectItem>
                  {roots.filter(r => r.id !== editingCategory?.id).map(r => (
                    <SelectItem key={r.id} value={r.id}>تحت قسم: {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ترتيب العرض</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل تريد حذف القسم &quot;{deleteConfirm?.name}&quot;؟
            {deleteConfirm && productCountForCategory(deleteConfirm.name) > 0 && (
              <span className="block mt-2 text-destructive">يوجد منتجات مرتبطة بهذا القسم ولا يمكن الحذف.</span>
            )}
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteConfirm ? productCountForCategory(deleteConfirm.name) > 0 : false}
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
