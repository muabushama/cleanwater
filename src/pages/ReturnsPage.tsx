import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP, companyInfo } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Printer } from 'lucide-react';

const formatDateDisplay = (v: any) => { const s = String(v || ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };

interface Customer {
  id: string;
  name: string;
  phone1?: string;
  address?: string;
}
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch } from '@/lib/branchFilters';
import { promptDeletePassword } from '@/lib/deletePassword';
interface ReturnRecord {
  id: string;
  return_number: string;
  invoice_id: string | null;
  customer_name: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  amount: number;
  return_date: string;
  branch: string;
  rep_name: string | null;
  notes: string | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  branch?: string;
  sku_code?: string | null;
  barcode?: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  date: string;
}

const emptyForm = {
  return_number: '',
  return_type: 'customer' as 'customer' | 'supplier' | 'stock',
  customer_name: '',
  supplier_name: '',
  supplier_phone: '',
  reason: '',
  product_id: '',
  product_name: '',
  quantity: '1',
  amount: '0',
  return_date: new Date().toISOString().split('T')[0],
  invoice_id: '' as string,
  rep_name: '',
  notes: '',
};

export default function ReturnsPage() {
  const [list, setList] = useState<ReturnRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ReturnRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const { toast } = useToast();
  const { branch } = useUserBranch();

  const fetchData = async () => {
    setLoading(true);
    const bv = branchDbValuesForUiBranch(branch);
    const [retRes, prodRes, custRes, invRes] = await Promise.all([
      supabase.from('returns').select('*').in('branch', bv).order('return_date', { ascending: false }),
      supabase.from('products').select('id, name, stock, branch, sku_code, barcode').in('branch', bv).limit(500),
      supabase.from('customers').select('id, name, phone1, address').in('branch', bv).order('name'),
      supabase.from('invoices').select('id, invoice_number, customer_name, date').in('branch', bv).order('date', { ascending: false }).limit(500),
    ]);
    setList((retRes.data || []) as ReturnRecord[]);
    setProducts((prodRes.data || []) as Product[]);
    setCustomers((custRes.data || []) as Customer[]);
    setInvoices((invRes.data || []) as Invoice[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [branch]);

  const filtered = list.filter(
    r =>
      !search.trim() ||
      r.return_number.includes(search) ||
      r.customer_name.includes(search) ||
      (r.product_name || '').includes(search)
  );

  const filteredCusts = customerSearch.trim()
    ? customers.filter(c => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase().trim()) || (c.phone1 || '').includes(customerSearch.trim())).slice(0, 15)
    : [];
  const filteredProductsForForm = productSearch.trim()
    ? products.filter(p => {
        const term = productSearch.toLowerCase().trim();
        const name = (p.name || '').toLowerCase();
        const sku = String(p.sku_code || '').toLowerCase();
        const bc = String(p.barcode || '').toLowerCase();
        return name.includes(term) || sku.includes(term) || bc.includes(term);
      }).slice(0, 15)
    : [];

  const [form, setForm] = useState(emptyForm);

  const filteredInvoicesForForm = invoiceSearch.trim()
    ? invoices.filter(inv =>
        (inv.customer_name || '').toLowerCase().includes(invoiceSearch.toLowerCase().trim()) ||
        (inv.invoice_number || '').toLowerCase().includes(invoiceSearch.toLowerCase().trim())
      ).slice(0, 30)
    : invoices.slice(0, 30);

  const handleSave = async () => {
    const return_number = (form.return_number || (editing ? editing.return_number : '')).trim() || `RET-${Date.now().toString().slice(-6)}`;
    const isSupplier = form.return_type === 'supplier';
    const isStock = form.return_type === 'stock';
    const customer_name = isSupplier
      ? (form.supplier_name || '').trim() || 'مورد'
      : isStock
        ? (form.customer_name || '').trim() || 'مرتجع مخزون'
        : (form.customer_name || '').trim() || 'غير محدد';
    const product_id = form.product_id || null;
    const product_name = (form.product_name || '').trim() || products.find(p => p.id === form.product_id)?.name || 'منتج';
    const quantity = Math.max(1, Number(form.quantity) || 1);
    const amount = Number(form.amount) || 0;
    const return_date = form.return_date || new Date().toISOString().split('T')[0];
    const notes = (form.notes || '').trim() || null;
    const invoice_id = form.invoice_id || null;

    if (!product_id && !product_name) {
      toast({ title: 'خطأ', description: 'المنتج مطلوب', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        return_number,
        customer_name,
        product_id,
        product_name,
        quantity,
        amount,
        return_date,
        branch: branch || 'فرع الإسكندرية',
        invoice_id: invoice_id || null,
        notes,
        return_type: form.return_type || 'customer',
      };
      if (isSupplier) {
        payload.supplier_name = (form.supplier_name || '').trim();
        payload.supplier_phone = (form.supplier_phone || '').trim();
        payload.reason = (form.reason || '').trim();
      }

      if (editing) {
        await supabase.from('returns').update(payload).eq('id', editing.id);
        toast({ title: 'تم تعديل المرتجع' });
      } else {
        const id = crypto.randomUUID();
        await supabase.from('returns').insert({ ...payload, id });
        if (product_id) {
          if (isSupplier) {
            await supabase.from('stock_movements').insert({
              id: crypto.randomUUID(),
              product_id,
              branch: branch || 'فرع الإسكندرية',
              type: 'sale',
              quantity,
              reference_type: 'supplier_return',
              reference_id: id,
              notes: `مرتجع مورد ${return_number}`,
            });
            const prod = products.find(p => p.id === product_id);
            if (prod) {
              const newStock = Math.max(0, (Number(prod.stock) || 0) - quantity);
              await supabase.from('products').update({ stock: newStock }).eq('id', product_id);
            }
          } else {
            await supabase.from('stock_movements').insert({
              id: crypto.randomUUID(),
              product_id,
              branch: branch || 'فرع الإسكندرية',
              type: 'purchase',
              quantity,
              reference_type: isStock ? 'stock_return' : 'return',
              reference_id: id,
              notes: isStock ? `مرتجع مخزون ${return_number}` : `مرتجع ${return_number}`,
            });
            const prod = products.find(p => p.id === product_id);
            if (prod) {
              const newStock = (Number(prod.stock) || 0) + quantity;
              await supabase.from('products').update({ stock: newStock }).eq('id', product_id);
            }
          }
        }
        toast({
          title: isSupplier
            ? 'تم تسجيل مرتجع المورد وتحديث المخزون'
            : isStock
              ? 'تم تسجيل مرتجع المخزون وتحديث الرصيد'
              : 'تم تسجيل المرتجع وتحديث المخزون',
        });
      }
      setAddOpen(false);
      setEditing(null);
      setForm({ ...emptyForm, return_number: `RET-${Date.now().toString().slice(-6)}`, return_date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r: ReturnRecord) => {
    setEditing(r);
    const rt = (r as any).return_type || 'customer';
    setCustomerSearch(rt === 'supplier' ? '' : r.customer_name);
    setProductSearch(r.product_name);
    setForm({
      return_number: r.return_number,
      return_type: rt,
      customer_name: r.customer_name,
      supplier_name: (r as any).supplier_name || '',
      supplier_phone: (r as any).supplier_phone || '',
      reason: (r as any).reason || '',
      product_id: r.product_id || '',
      product_name: r.product_name,
      quantity: String(r.quantity),
      amount: String(r.amount),
      return_date: r.return_date,
      invoice_id: r.invoice_id || '',
      rep_name: r.rep_name || '',
      notes: r.notes || '',
    });
    setAddOpen(true);
  };

  const handleDelete = async (r: ReturnRecord) => {
    if (!confirm(`حذف المرتجع ${r.return_number}؟ (لن يتم عكس حركة المخزون تلقائياً)`)) return;
    if (!promptDeletePassword()) return;
    try {
      await supabase.from('returns').delete().eq('id', r.id);
      toast({ title: 'تم حذف المرتجع' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handlePrint = (r: ReturnRecord) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html dir="rtl"><head><title>مرتجع ${r.return_number}</title>
      <style>body{font-family:Cairo,sans-serif;padding:20px;}</style></head><body>
      <h1>مرتجع ${r.return_number}</h1>
      <p>التاريخ: ${formatDateDisplay(r.return_date)} | العميل: ${r.customer_name}</p>
      <p>المنتج: ${r.product_name} | الكمية: ${r.quantity} | المبلغ: ${formatEGP(r.amount)}</p>
      ${r.notes ? `<p>ملاحظات: ${r.notes}</p>` : ''}
      <p style="margin-top:30px;font-size:12px;color:#666">${companyInfo.branches.join(' | ')}</p>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">المرتجعات</h1>
          <p className="text-muted-foreground text-sm">مرتبط بالمخزون والفواتير والمالية</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setCustomerSearch(''); setProductSearch(''); setInvoiceSearch(''); setForm({ ...emptyForm, return_number: `RET-${Date.now().toString().slice(-6)}`, return_date: new Date().toISOString().split('T')[0] }); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> مرتجع جديد
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث برقم المرتجع أو العميل أو المنتج..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <Card>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{r.return_number}</span>
                      <Badge
                        variant={(r as any).return_type === 'supplier' ? 'destructive' : (r as any).return_type === 'stock' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {(r as any).return_type === 'supplier'
                          ? 'مرتجع مورد'
                          : (r as any).return_type === 'stock'
                            ? 'مرتجع مخزون'
                            : 'مرتجع عميل'}
                      </Badge>
                    </div>
                    <p className="text-sm">{r.customer_name} – {r.product_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateDisplay(r.return_date)} | الكمية: {r.quantity}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-green-700">{formatEGP(r.amount)}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(r)}><Printer className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد مرتجعات</p>}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل مرتجع' : 'مرتجع جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>رقم المرتجع *</Label>
                <Input
                  value={form.return_number}
                  onChange={e => setForm(f => ({ ...f, return_number: e.target.value }))}
                  placeholder="RET-000001"
                />
              </div>
              <div>
                <Label>نوع المرتجع</Label>
                <Select value={form.return_type} onValueChange={v => setForm(f => ({ ...f, return_type: v as 'customer' | 'supplier' | 'stock' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">مرتجع عميل</SelectItem>
                    <SelectItem value="supplier">مرتجع مورد</SelectItem>
                    <SelectItem value="stock">مرتجع مخزون (تسوية / رد بضاعة للمخزن)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.return_type === 'stock' && (
              <div>
                <Label>البيان (اختياري)</Label>
                <Input
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="مثال: تسوية جرد، رد من فني..."
                />
              </div>
            )}
            {form.return_type === 'supplier' ? (
              <>
                <div>
                  <Label>اسم المورد *</Label>
                  <Input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="اسم المورد..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>هاتف المورد</Label>
                    <Input value={form.supplier_phone} onChange={e => setForm(f => ({ ...f, supplier_phone: e.target.value }))} placeholder="رقم الهاتف" />
                  </div>
                  <div>
                    <Label>سبب الإرجاع</Label>
                    <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="عيب صناعة، خطأ توريد..." />
                  </div>
                </div>
              </>
            ) : form.return_type === 'customer' ? (
              <div className="relative">
                <Label>اسم العميل</Label>
                <div className="relative">
                  <Input
                    value={customerSearch || form.customer_name}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustDropdown(true); setForm(f => ({ ...f, customer_name: e.target.value })); }}
                    onFocus={() => setShowCustDropdown(!!(customerSearch || form.customer_name).trim())}
                    onBlur={() => setTimeout(() => setShowCustDropdown(false), 200)}
                    placeholder="ابحث عن العميل أو اكتب الاسم..."
                    className="pr-9"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                {showCustDropdown && filteredCusts.length > 0 && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
                    {filteredCusts.map(c => (
                      <button key={c.id} type="button" className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0" onClick={() => { setForm(f => ({ ...f, customer_name: c.name })); setCustomerSearch(c.name); setShowCustDropdown(false); }}>
                        <p className="font-medium">{c.name}</p>
                        {(c.phone1 || c.address) && <p className="text-muted-foreground">{[c.phone1, c.address].filter(Boolean).join(' • ')}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {form.return_type !== 'stock' && (
            <div>
              <Label>الفاتورة الأصلية (اختياري — بحث بالاسم أو الرقم)</Label>
              <Input
                placeholder="ابحث بالاسم أو رقم الفاتورة..."
                value={invoiceSearch}
                onChange={e => setInvoiceSearch(e.target.value)}
                className="mb-1"
              />
              <Select value={form.invoice_id || 'none'} onValueChange={v => setForm(f => ({ ...f, invoice_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="اختر فاتورة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— لا فاتورة —</SelectItem>
                  {filteredInvoicesForForm.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} – {inv.customer_name} ({formatDateDisplay(inv.date)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
            <div className="relative">
              <Label>المنتج *</Label>
              <div className="relative">
                <Input
                  value={productSearch || form.product_name}
                  onChange={e => { const v = e.target.value; setProductSearch(v); setShowProductDropdown(!!v.trim()); setForm(f => ({ ...f, product_name: v, product_id: '' })); }}
                  onFocus={() => setShowProductDropdown(!!(productSearch || form.product_name).trim())}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  placeholder="ابحث عن منتج أو اكتب الاسم..."
                  className="pr-9"
                />
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {showProductDropdown && filteredProductsForForm.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredProductsForForm.filter(p => !branch || (p as any).branch === branch || !(p as any).branch).map(p => (
                    <button key={p.id} type="button" className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0 flex justify-between items-center" onClick={() => { setForm(f => ({ ...f, product_id: p.id, product_name: p.name })); setProductSearch(p.name); setShowProductDropdown(false); }}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">رصيد: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>الكمية *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label>المبلغ</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>تاريخ المرتجع</Label>
              <Input
                type="date"
                value={form.return_date}
                onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
