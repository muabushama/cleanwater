import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Area {
  id: string;
  name: string;
  parent_id: string | null;
  branch: string;
}

export default function AreasPage() {
  const { branch } = useUserBranch();
  const { toast } = useToast();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  // form.parent_id يبقى للاحتفاظ بالتبعية الحالية فقط عند التعديل، بدون اختيارها من الفورم
  const [form, setForm] = useState({ name: '', parent_id: '' as string });

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('areas').select('*').eq('branch', branch).order('name');
      setAreas(Array.isArray(data) ? (data as Area[]) : []);
    } catch {
      setAreas([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAreas(); }, [branch]);

  const roots = areas.filter(a => !a.parent_id);
  const getChildren = (parentId: string) => areas.filter(a => a.parent_id === parentId);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'خطأ', description: 'اسم المنطقة مطلوب', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        // عدم السماح بتغيير التبعية من الفورم؛ نحافظ على القيمة الحالية في حالة التعديل
        parent_id: editingArea?.parent_id ?? null,
        branch,
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
        toast({ title: 'تم إضافة المنطقة' });
        setAddOpen(false);
      }
      setForm({ name: '', parent_id: '' });
      fetchAreas();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (area: Area) => {
    const children = getChildren(area.id);
    if (children.length > 0) {
      toast({ title: 'لا يمكن الحذف', description: 'احذف المناطق الفرعية أولاً', variant: 'destructive' });
      return;
    }
    if (!confirm(`حذف المنطقة "${area.name}"؟`)) return;
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
        <Button className="gap-2" onClick={() => { setEditingArea(null); setForm({ name: '', parent_id: '' }); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> إضافة قطاع جديد
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <Card className="card-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> قائمة القطاعات والمناطق</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {roots.map(area => (
              <div key={area.id} className="border rounded-lg p-3">
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
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(area)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                {getChildren(area.id).map(sub => (
                  <div key={sub.id} className="flex items-center justify-between pr-6 py-2 text-sm text-muted-foreground border-t mt-2">
                    <span>منطقة: {sub.name}</span>
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
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(sub)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {roots.length === 0 && <p className="text-muted-foreground text-sm py-4">لا توجد قطاعات. أضف قطاعاً أولاً ثم المناطق تحته.</p>}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={addOpen || editOpen}
        onOpenChange={open => {
          setAddOpen(open);
          setEditOpen(open);
          if (!open) setEditingArea(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingArea ? 'تعديل' : 'إضافة قطاع جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم القطاع</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="مثال: القطاع الشمالي"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setAddOpen(false); setEditOpen(false); }}>إلغاء</Button>
              <Button onClick={handleSave}>{editingArea ? 'تعديل' : 'إضافة'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
