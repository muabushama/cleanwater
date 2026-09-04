import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { invoiceDebtRemaining } from '@/lib/invoiceBalance';
import { promptDeletePassword } from '@/lib/deletePassword';

const formatDateDisplay = (v: any) => {
  const s = String(v || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

interface ReceiptVoucher {
  id: string;
  voucher_number: string;
  voucher_date: string;
  amount: number;
  invoice_id: string | null;
  customer_name: string;
  payment_method: string;
  notes?: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  paid: number;
  remaining: number;
}

export default function ReceiptVouchersPage() {
  const [vouchers, setVouchers] = useState<ReceiptVoucher[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<ReceiptVoucher | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    voucher_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    amount: '',
    invoice_id: 'none',
    customer_name: '',
    payment_method: 'cash',
    notes: '',
  });
  const { toast } = useToast();
  const { branch } = useUserBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
      const bv = branchDbValuesForUiBranch(branch);
      const [vRes, iRes] = await Promise.all([
        supabase.from('receipt_vouchers').select('*').in('branch', bv).order('voucher_date', { ascending: false }).then(r => r).catch(() => ({ data: [] })),
        supabase
          .from('invoices')
          .select('id,invoice_number,customer_name,amount,paid,remaining')
          .in('branch', bv)
          .neq('status', 'deleted'),
      ]);
      setVouchers((vRes?.data || []) as ReceiptVoucher[]);
      setInvoices((iRes?.data || []) as Invoice[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [branch]);

  const filtered = vouchers.filter(
    v => !search.trim() || v.voucher_number.includes(search) || v.customer_name.includes(search)
  );
  const totalCollected = vouchers.reduce((s, v) => s + (Number(v.amount) || 0), 0);

  const applyInvoicePaidDelta = async (invoiceId: string | null, delta: number) => {
    if (!invoiceId || delta === 0) return;
    const { data: row, error } = await supabase.from('invoices').select('id,amount,paid').eq('id', invoiceId).single();
    if (error || !row) throw new Error(error?.message || 'تعذر جلب الفاتورة');
    const invAmt = Number((row as any).amount) || 0;
    const newPaid = Math.max(0, (Number((row as any).paid) || 0) + delta);
    const newRemaining = invoiceDebtRemaining(invAmt, newPaid);
    const newStatus = newRemaining <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
    await supabase.from('invoices').update({ paid: newPaid, remaining: newRemaining, status: newStatus }).eq('id', invoiceId);
  };

  const handleSave = async () => {
    if (!form.voucher_number.trim() || !form.amount) {
      toast({ title: 'خطأ', description: 'رقم السند والمبلغ مطلوبان', variant: 'destructive' });
      return;
    }
    const amount = Number(form.amount);
    if (amount <= 0) {
      toast({ title: 'خطأ', description: 'المبلغ يجب أن يكون أكبر من صفر', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const invoiceId = form.invoice_id && form.invoice_id !== 'none' ? form.invoice_id : null;
      const inv = invoiceId ? invoices.find(i => i.id === invoiceId) : null;

      if (editingVoucher) {
        const oldInvId = editingVoucher.invoice_id;
        const oldAmt = Number(editingVoucher.amount) || 0;
        if (oldInvId === invoiceId) {
          await applyInvoicePaidDelta(invoiceId, amount - oldAmt);
        } else {
          if (oldInvId) await applyInvoicePaidDelta(oldInvId, -oldAmt);
          if (invoiceId) await applyInvoicePaidDelta(invoiceId, amount);
        }
        const { error } = await supabase.from('receipt_vouchers').update({
          voucher_number: form.voucher_number.trim(),
          voucher_date: form.voucher_date,
          amount,
          invoice_id: invoiceId,
          customer_name: form.customer_name.trim() || (inv?.customer_name ?? ''),
          payment_method: form.payment_method,
          notes: form.notes.trim() || null,
        }).eq('id', editingVoucher.id);
        if (error) throw error;
        toast({ title: 'تم تحديث سند القبض والفاتورة المرتبطة' });
        setEditingVoucher(null);
      } else {
        if (invoiceId && inv) {
          const newPaid = (Number(inv.paid) || 0) + amount;
          const invAmt = Number(inv.amount) || 0;
          const newRemaining = invoiceDebtRemaining(invAmt, newPaid);
          const newStatus = newPaid >= invAmt ? 'paid' : 'partial';
          await supabase.from('invoices').update({
            paid: newPaid,
            remaining: newRemaining,
            status: newStatus,
          }).eq('id', invoiceId);
        }
        await supabase.from('receipt_vouchers').insert({
          id: crypto.randomUUID(),
          voucher_number: form.voucher_number.trim(),
          voucher_date: form.voucher_date,
          amount,
          invoice_id: invoiceId,
          customer_name: form.customer_name.trim() || (inv?.customer_name ?? ''),
          payment_method: form.payment_method,
          branch: canonicalBranchForSave(branch),
          notes: form.notes.trim() || null,
          created_by: user?.id,
        });
        toast({ title: 'تم تسجيل سند القبض' + (inv ? ' وتحديث الفاتورة' : '') });
      }
      setAddOpen(false);
      setForm({ voucher_number: '', voucher_date: new Date().toISOString().split('T')[0], amount: '', invoice_id: 'none', customer_name: '', payment_method: 'cash', notes: '' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selectInvoice = (inv: Invoice) => {
    setForm(p => ({ ...p, invoice_id: inv.id, customer_name: inv.customer_name }));
  };

  const handleDelete = async (v: ReceiptVoucher) => {
    if (!confirm(`حذف سند القبض ${v.voucher_number}؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      if (v.invoice_id) {
        await applyInvoicePaidDelta(v.invoice_id, -(Number(v.amount) || 0));
      }
      const { error } = await supabase.from('receipt_vouchers').delete().eq('id', v.id);
      if (error) throw error;
      toast({ title: 'تم حذف سند القبض' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">سندات القبض</h1>
          <p className="text-muted-foreground text-sm">إجمالي المحصل: {formatEGP(totalCollected)}</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditingVoucher(null); setForm({ voucher_number: `RCV-${Date.now().toString().slice(-6)}`, voucher_date: new Date().toISOString().split('T')[0], amount: '', invoice_id: 'none', customer_name: '', payment_method: 'cash', notes: '' }); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> سند قبض جديد
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث برقم السند أو العميل..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <Card>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{v.voucher_number}</p>
                    <p className="text-sm">{v.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateDisplay(v.voucher_date)} {v.invoice_id ? '— مرتبط بفاتورة' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-600">{formatEGP(v.amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="تعديل"
                      onClick={() => {
                        setEditingVoucher(v);
                        setForm({
                          voucher_number: v.voucher_number,
                          voucher_date: v.voucher_date,
                          amount: String(v.amount),
                          invoice_id: v.invoice_id || 'none',
                          customer_name: v.customer_name,
                          payment_method: v.payment_method || 'cash',
                          notes: v.notes || '',
                        });
                        setAddOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      title="حذف"
                      onClick={() => handleDelete(v)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد سندات قبض</p>}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setEditingVoucher(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingVoucher ? 'تعديل سند قبض' : 'سند قبض جديد'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>رقم السند *</Label>
                <Input value={form.voucher_number} onChange={e => setForm(p => ({ ...p, voucher_number: e.target.value }))} />
              </div>
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={form.voucher_date} onChange={e => setForm(p => ({ ...p, voucher_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>الفاتورة (اختياري — لربط التحصيل بالفاتورة)</Label>
              <Select value={form.invoice_id} onValueChange={v => { const inv = invoices.find(i => i.id === v); setForm(p => ({ ...p, invoice_id: v, customer_name: inv?.customer_name ?? p.customer_name })); }}>
                <SelectTrigger><SelectValue placeholder="بدون فاتورة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فاتورة</SelectItem>
                  {invoices.filter(i => invoiceDebtRemaining(i.amount, i.paid) > 0 || (editingVoucher && i.id === editingVoucher.invoice_id)).map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.customer_name} (متبقي: {formatEGP(invoiceDebtRemaining(inv.amount, inv.paid))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>العميل</Label>
              <Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="اسم العميل" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>المبلغ *</Label>
                <Input type="number" dir="ltr" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select value={form.payment_method} onValueChange={v => setForm(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="bank">بنك</SelectItem>
                    <SelectItem value="cheque">شيك</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>ملاحظات</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : editingVoucher ? 'حفظ التعديل' : 'حفظ'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
