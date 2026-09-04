import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';

const formatDateDisplay = (v: any) => { const s = String(v || ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };
import { promptDeletePassword } from '@/lib/deletePassword';

interface Expense {
  id: string;
  expense_number: string;
  category: string;
  payee_name: string;
  amount: number;
  expense_date: string;
  branch: string;
  notes?: string | null;
}

const EXPENSE_CATEGORIES = ['عام', 'شراء بضاعة', 'إيجار', 'رواتب', 'مرافق', 'نقل', 'صيانة', 'أخرى'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expense_number: '',
    category: 'عام',
    payee_name: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const { toast } = useToast();
  const { branch } = useUserBranch();

  const fetchExpenses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .in('branch', branchDbValuesForUiBranch(branch))
      .order('expense_date', { ascending: false });
    setExpenses((data || []) as Expense[]);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [branch]);

  const filtered = expenses.filter(
    e =>
      !search.trim() ||
      e.expense_number.includes(search) ||
      e.payee_name.includes(search) ||
      e.category.includes(search)
  );

  const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const handleSave = async () => {
    if (!form.expense_number.trim() || !form.payee_name.trim() || !form.amount) {
      toast({ title: 'خطأ', description: 'رقم السند، المستفيد والمبلغ مطلوبون', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        expense_number: form.expense_number.trim(),
        category: form.category,
        payee_name: form.payee_name.trim(),
        amount: Number(form.amount),
        expense_date: form.expense_date,
        branch: canonicalBranchForSave(branch),
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await supabase.from('expenses').update(payload).eq('id', editing.id);
        toast({ title: 'تم تعديل المصروف' });
      } else {
        await supabase.from('expenses').insert({ ...payload, id: crypto.randomUUID() });
        toast({ title: 'تم إضافة المصروف' });
      }
      setAddOpen(false);
      setEditing(null);
      setForm({ expense_number: '', category: 'عام', payee_name: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });
      fetchExpenses();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      expense_number: e.expense_number,
      category: e.category || 'عام',
      payee_name: e.payee_name,
      amount: String(e.amount),
      expense_date: e.expense_date,
      notes: e.notes || '',
    });
    setAddOpen(true);
  };

  const handleDelete = async (e: Expense) => {
    if (!confirm(`حذف المصروف ${e.expense_number}؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      await supabase.from('expenses').delete().eq('id', e.id);
      toast({ title: 'تم حذف المصروف' });
      fetchExpenses();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">المصروفات (فواتير خارجة)</h1>
          <p className="text-muted-foreground text-sm">إجمالي المصروفات: {formatEGP(totalAmount)}</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setForm({ expense_number: `EXP-${Date.now().toString().slice(-6)}`, category: 'عام', payee_name: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' }); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> مصروف جديد
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث برقم السند أو المستفيد أو التصنيف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((exp, i) => (
            <motion.div key={exp.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <Card>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{exp.expense_number}</span>
                      <Badge variant="outline" className="text-xs">{exp.category}</Badge>
                    </div>
                    <p className="text-sm">{exp.payee_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateDisplay(exp.expense_date)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-destructive">{formatEGP(exp.amount)}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(exp)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(exp)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد مصروفات</p>}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل مصروف' : 'مصروف جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>رقم السند *</Label>
                <Input value={form.expense_number} onChange={e => setForm(p => ({ ...p, expense_number: e.target.value }))} />
              </div>
              <div>
                <Label>التصنيف</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>المستفيد *</Label>
              <Input value={form.payee_name} onChange={e => setForm(p => ({ ...p, payee_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>المبلغ *</Label>
                <Input type="number" dir="ltr" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
