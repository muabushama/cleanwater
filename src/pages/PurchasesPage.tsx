import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP, companyInfo } from '@/data/demo-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Search, Edit, Trash2, Printer, Wallet, Banknote, AlertCircle,
  ShoppingCart, Eye, ImageIcon, Building2, ArrowLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch } from '@/lib/branchFilters';
import { promptDeletePassword } from '@/lib/deletePassword';
import { ProductSearchCombobox } from '@/components/inventory/ProductSearchCombobox';
import {
  canonicalPurchaseFileUrl,
  isPurchaseImageFile,
  isPurchaseImageUrl,
  resolvePurchaseFileUrl,
} from '@/lib/purchaseFileUrl';

const formatDateDisplay = (v: any) => {
  const s = String(v || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

interface PurchaseLine {
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
}

interface PurchaseRecord {
  id: string;
  purchase_number: string;
  supplier_name: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  paid?: number;
  remaining?: number;
  items?: PurchaseLine[] | null;
  purchase_date: string;
  branch: string;
  invoice_file_url: string | null;
  rep_name: string | null;
  notes: string | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  branch?: string;
  cost?: number;
  sku_code?: string | null;
  barcode?: string | null;
}

interface SupplierCard {
  name: string;
  total: number;
  paid: number;
  due: number;
  credit: number;
  count: number;
}

const emptyLine = (): PurchaseLine => ({ product_id: '', product_name: '', quantity: '1', unit_price: '0' });

const emptyForm = {
  purchase_number: '',
  supplier_name: '',
  purchase_date: new Date().toISOString().split('T')[0],
  rep_name: '',
  notes: '',
  paid: '0',
};

function stripUnknownColumnFromPayload(errorMessage: string, payload: Record<string, unknown>): boolean {
  const m = String(errorMessage || '').match(/Unknown column '([^']+)'/i);
  if (!m?.[1] || !(m[1] in payload)) return false;
  delete payload[m[1]];
  return true;
}

const parsePurchaseLines = (record: PurchaseRecord): PurchaseLine[] => {
  const raw = record.items;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((x: any) => ({
      product_id: String(x.product_id || ''),
      product_name: String(x.product_name || ''),
      quantity: String(x.quantity ?? '1'),
      unit_price: String(x.unit_price ?? '0'),
    }));
  }
  return [{
    product_id: record.product_id || '',
    product_name: record.product_name || '',
    quantity: String(record.quantity || 1),
    unit_price: String(record.unit_price || 0),
  }];
};

const lineTotal = (ln: PurchaseLine) => Math.max(1, Number(ln.quantity) || 1) * Math.max(0, Number(ln.unit_price) || 0);

const purchasePaid = (p: PurchaseRecord) => Number(p.paid) || 0;
const purchaseDue = (p: PurchaseRecord) => {
  const rem = Number(p.remaining);
  if (Number.isFinite(rem) && rem >= 0) return rem;
  return Math.max(0, (Number(p.total) || 0) - purchasePaid(p));
};
const purchaseCredit = (p: PurchaseRecord) => Math.max(0, purchasePaid(p) - (Number(p.total) || 0));

function manualSuppliersKey(branch: string) {
  return `oasis_manual_suppliers_${branch || 'default'}`;
}

export default function PurchasesPage() {
  const [list, setList] = useState<PurchaseRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [savedInvoiceFileUrl, setSavedInvoiceFileUrl] = useState<string | null>(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [manualSuppliers, setManualSuppliers] = useState<string[]>([]);
  const { toast } = useToast();
  const { branch } = useUserBranch();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(manualSuppliersKey(branch));
      const parsed = raw ? JSON.parse(raw) : [];
      setManualSuppliers(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      setManualSuppliers([]);
    }
  }, [branch]);

  const persistManualSuppliers = (names: string[]) => {
    setManualSuppliers(names);
    try {
      localStorage.setItem(manualSuppliersKey(branch), JSON.stringify(names));
    } catch {
      /* ignore */
    }
  };

  const uniqueSuppliers = useMemo(() => {
    const names = new Set<string>();
    list.forEach((p) => {
      if ((p.supplier_name || '').trim()) names.add((p.supplier_name || '').trim());
    });
    manualSuppliers.forEach((n) => {
      if (n.trim()) names.add(n.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [list, manualSuppliers]);

  const filteredSuppliers = supplierSearch.trim()
    ? uniqueSuppliers.filter((s) => s.toLowerCase().includes(supplierSearch.toLowerCase().trim())).slice(0, 15)
    : [];

  const formTotal = useMemo(() => lines.reduce((s, ln) => s + lineTotal(ln), 0), [lines]);
  const formRemaining = useMemo(() => Math.max(0, formTotal - (Number(form.paid) || 0)), [formTotal, form.paid]);

  const supplierCards: SupplierCard[] = useMemo(() => {
    const map = new Map<string, SupplierCard>();
    uniqueSuppliers.forEach((name) => {
      map.set(name, { name, total: 0, paid: 0, due: 0, credit: 0, count: 0 });
    });
    list.forEach((p) => {
      const name = (p.supplier_name || '').trim() || 'مورد بدون اسم';
      const row = map.get(name) || { name, total: 0, paid: 0, due: 0, credit: 0, count: 0 };
      row.total += Number(p.total) || 0;
      row.paid += purchasePaid(p);
      row.due += purchaseDue(p);
      row.credit += purchaseCredit(p);
      row.count += 1;
      map.set(name, row);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [list, uniqueSuppliers]);

  const filteredSupplierCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return supplierCards;
    return supplierCards.filter((s) => s.name.toLowerCase().includes(q));
  }, [supplierCards, search]);

  const globalStats = useMemo(() => {
    const totalAll = supplierCards.reduce((s, c) => s + c.total, 0);
    const totalPaid = supplierCards.reduce((s, c) => s + c.paid, 0);
    const totalDue = supplierCards.reduce((s, c) => s + c.due, 0);
    const totalCredit = supplierCards.reduce((s, c) => s + c.credit, 0);
    return { totalAll, totalPaid, totalDue, totalCredit, count: supplierCards.length };
  }, [supplierCards]);

  const detailPurchases = useMemo(() => {
    if (!detailSupplier) return [];
    return list
      .filter((p) => (p.supplier_name || '').trim() === detailSupplier)
      .sort((a, b) => String(b.purchase_date).localeCompare(String(a.purchase_date)));
  }, [list, detailSupplier]);

  const detailStats = useMemo(() => {
    const card = supplierCards.find((c) => c.name === detailSupplier);
    return card || { name: detailSupplier || '', total: 0, paid: 0, due: 0, credit: 0, count: 0 };
  }, [supplierCards, detailSupplier]);

  const fetchData = async () => {
    setLoading(true);
    const bv = branchDbValuesForUiBranch(branch);
    const [purRes, prodRes] = await Promise.all([
      supabase.from('purchases').select('*').in('branch', bv).order('purchase_date', { ascending: false }),
      supabase.from('products').select('id, name, stock, branch, cost, sku_code, barcode').in('branch', bv).order('name').limit(5000),
    ]);
    setList((purRes.data || []) as PurchaseRecord[]);
    setProducts((prodRes.data || []) as Product[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [branch]);

  useEffect(() => {
    if (!invoiceFile) {
      setInvoicePreviewUrl(null);
      return;
    }
    const blobUrl = URL.createObjectURL(invoiceFile);
    setInvoicePreviewUrl(blobUrl);
    return () => URL.revokeObjectURL(blobUrl);
  }, [invoiceFile]);

  const openFilePreview = (url: string | null | undefined, title: string) => {
    const resolved = resolvePurchaseFileUrl(url);
    if (!resolved) return;
    setPreviewUrl(resolved);
    setPreviewTitle(title);
    setPreviewOpen(true);
  };

  const openAddPurchase = (supplierName?: string) => {
    setEditing(null);
    setInvoiceFile(null);
    setSavedInvoiceFileUrl(null);
    setInvoicePreviewUrl(null);
    const name = (supplierName || '').trim();
    setSupplierSearch(name);
    setLines([emptyLine()]);
    setForm({
      ...emptyForm,
      purchase_number: `PUR-${Date.now().toString().slice(-6)}`,
      purchase_date: new Date().toISOString().split('T')[0],
      supplier_name: name,
    });
    setAddOpen(true);
  };

  const handleRegisterSupplier = () => {
    const name = newSupplierName.trim();
    if (!name) {
      toast({ title: 'خطأ', description: 'اسم المورد مطلوب', variant: 'destructive' });
      return;
    }
    if (!manualSuppliers.includes(name) && !uniqueSuppliers.includes(name)) {
      persistManualSuppliers([...manualSuppliers, name]);
    }
    setRegisterOpen(false);
    setNewSupplierName('');
    setDetailSupplier(name);
    toast({ title: 'تم تسجيل المورد', description: 'يمكنك الآن تسجيل فواتير مشتريات لهذا المورد.' });
  };

  const handleSave = async () => {
    const normalizedLines = lines
      .map((ln) => {
        const prod = products.find((p) => p.id === ln.product_id);
        const product_name = (prod?.name || ln.product_name || '').trim();
        if (!product_name) return null;
        const quantity = Math.max(1, Number(ln.quantity) || 1);
        const unit_price = Math.max(0, Number(ln.unit_price) || 0);
        return {
          product_id: prod?.id || ln.product_id || null,
          product_name,
          quantity,
          unit_price,
          line_total: quantity * unit_price,
        };
      })
      .filter(Boolean) as Array<{ product_id: string | null; product_name: string; quantity: number; unit_price: number; line_total: number }>;

    if (normalizedLines.length === 0) {
      toast({ title: 'خطأ', description: 'أضف منتجاً واحداً على الأقل', variant: 'destructive' });
      return;
    }

    const first = normalizedLines[0];
    const total = normalizedLines.reduce((s, ln) => s + ln.line_total, 0);
    const paid = Math.max(0, Number(form.paid) || 0);
    const remaining = Math.max(0, total - paid);
    const purchase_date = form.purchase_date || new Date().toISOString().split('T')[0];
    const purchase_number = (form.purchase_number || '').trim() || `PUR-${Date.now().toString().slice(-6)}`;
    const supplier_name = (form.supplier_name || '').trim() || 'مورد';
    const notes = (form.notes || '').trim() || null;

    setSaving(true);
    try {
      let invoice_file_url: string | null = savedInvoiceFileUrl || editing?.invoice_file_url || null;
      if (invoiceFile) {
        setUploadingFile(true);
        const ext = invoiceFile.name.split('.').pop() || 'pdf';
        const path = `purchase-invoices/${crypto.randomUUID()}.${ext}`;
        const uploadRes = await supabase.storage.from('documents').upload(path, invoiceFile);
        if (uploadRes.error) throw uploadRes.error;
        invoice_file_url = canonicalPurchaseFileUrl(uploadRes.data) || invoice_file_url;
        setUploadingFile(false);
      }

      const payload: Record<string, unknown> = {
        purchase_number,
        supplier_name,
        product_id: first.product_id,
        product_name: normalizedLines.length > 1 ? `${first.product_name} +${normalizedLines.length - 1}` : first.product_name,
        quantity: normalizedLines.reduce((s, ln) => s + ln.quantity, 0),
        unit_price: first.unit_price,
        total,
        paid,
        remaining,
        items: normalizedLines,
        purchase_date,
        branch: branch || 'فرع الإسكندرية',
        invoice_file_url,
        rep_name: (form.rep_name || '').trim() || null,
        notes,
      };

      const upsertWithFallback = async (mode: 'insert' | 'update', id?: string) => {
        const body = { ...payload };
        for (let attempt = 0; attempt < 4; attempt++) {
          const res = mode === 'insert'
            ? await supabase.from('purchases').insert({ ...body, id: id! })
            : await supabase.from('purchases').update(body).eq('id', id!);
          if (!res.error) return;
          if (!stripUnknownColumnFromPayload(String(res.error.message || ''), body)) throw res.error;
        }
      };

      if (editing) {
        await upsertWithFallback('update', editing.id);
        toast({ title: 'تم تعديل فاتورة المشتريات' });
      } else {
        const id = crypto.randomUUID();
        await upsertWithFallback('insert', id);
        for (const ln of normalizedLines) {
          if (!ln.product_id) continue;
          await supabase.from('stock_movements').insert({
            id: crypto.randomUUID(),
            product_id: ln.product_id,
            branch: branch || 'فرع الإسكندرية',
            type: 'purchase',
            quantity: ln.quantity,
            reference_type: 'purchase',
            reference_id: id,
            notes: `مشتريات ${purchase_number} - ${ln.product_name}`,
          });
          const prod = products.find((p) => p.id === ln.product_id);
          if (prod) {
            const newStock = (Number(prod.stock) || 0) + ln.quantity;
            await supabase.from('products').update({ stock: newStock }).eq('id', ln.product_id);
          }
        }
        toast({ title: 'تم تسجيل المشتريات وتحديث المخزون' });
      }
      if (!manualSuppliers.includes(supplier_name) && !list.some((p) => (p.supplier_name || '').trim() === supplier_name)) {
        persistManualSuppliers([...manualSuppliers, supplier_name]);
      }
      setAddOpen(false);
      setEditing(null);
      setInvoiceFile(null);
      setSavedInvoiceFileUrl(null);
      setInvoicePreviewUrl(null);
      setLines([emptyLine()]);
      setForm({ ...emptyForm, purchase_number: `PUR-${Date.now().toString().slice(-6)}`, purchase_date: new Date().toISOString().split('T')[0] });
      if (detailSupplier) setDetailSupplier(supplier_name);
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
      setUploadingFile(false);
    }
  };

  const openEdit = (p: PurchaseRecord) => {
    setEditing(p);
    setSupplierSearch(p.supplier_name);
    setLines(parsePurchaseLines(p));
    setSavedInvoiceFileUrl(p.invoice_file_url || null);
    setForm({
      purchase_number: p.purchase_number,
      supplier_name: p.supplier_name,
      purchase_date: p.purchase_date,
      rep_name: p.rep_name || '',
      notes: p.notes || '',
      paid: String(p.paid ?? 0),
    });
    setInvoiceFile(null);
    setAddOpen(true);
  };

  const handleDelete = async (p: PurchaseRecord) => {
    if (!confirm(`حذف فاتورة المشتريات ${p.purchase_number}؟ (لن يتم عكس حركة المخزون تلقائياً)`)) return;
    if (!promptDeletePassword()) return;
    try {
      await supabase.from('purchases').delete().eq('id', p.id);
      toast({ title: 'تم حذف السجل' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handlePrint = (p: PurchaseRecord) => {
    const itemLines = parsePurchaseLines(p);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html dir="rtl"><head><title>فاتورة مشتريات ${p.purchase_number}</title>
      <style>body{font-family:Cairo,sans-serif;padding:20px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;text-align:right;}</style></head><body>
      <h1>فاتورة مشتريات ${p.purchase_number}</h1>
      <p>التاريخ: ${formatDateDisplay(p.purchase_date)} | المورد: ${p.supplier_name}</p>
      <table>
        <tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
        ${itemLines.map((ln) => `<tr><td>${ln.product_name}</td><td>${ln.quantity}</td><td>${formatEGP(Number(ln.unit_price))}</td><td>${formatEGP(lineTotal(ln))}</td></tr>`).join('')}
      </table>
      <p>الإجمالي: ${formatEGP(p.total)} | المسدد: ${formatEGP(p.paid || 0)} | المستحق: ${formatEGP(p.remaining ?? Math.max(0, (p.total || 0) - (p.paid || 0)))}</p>
      ${p.notes ? `<p>ملاحظات: ${p.notes}</p>` : ''}
      <p style="margin-top:30px;font-size:12px;color:#666">${companyInfo.branches.join(' | ')}</p>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const existingFileUrl = resolvePurchaseFileUrl(savedInvoiceFileUrl || editing?.invoice_file_url);
  const formDisplayFileUrl = invoicePreviewUrl || existingFileUrl;
  const formIsImage = isPurchaseImageFile(invoiceFile) || isPurchaseImageUrl(formDisplayFileUrl);

  const renderPurchaseRow = (p: PurchaseRecord, i: number) => {
    const paid = purchasePaid(p);
    const due = purchaseDue(p);
    const itemLines = parsePurchaseLines(p);
    const fileUrl = resolvePurchaseFileUrl(p.invoice_file_url);
    const hasImage = Boolean(p.invoice_file_url && isPurchaseImageUrl(fileUrl || p.invoice_file_url));
    return (
      <motion.div key={p.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{p.purchase_number}</span>
                <Badge variant="outline" className="text-xs">مشتريات</Badge>
              </div>
              <p className="text-sm">{itemLines.length > 1 ? `${itemLines.length} منتجات` : p.product_name}</p>
              <p className="text-xs text-muted-foreground">{formatDateDisplay(p.purchase_date)} | الكمية: {p.quantity}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary" className="gap-1 text-[10px]"><Wallet className="h-3 w-3" /> إجمالي: {formatEGP(p.total)}</Badge>
                <Badge className="gap-1 text-[10px] bg-green-600"><Banknote className="h-3 w-3" /> مسدد: {formatEGP(paid)}</Badge>
                <Badge variant="destructive" className="gap-1 text-[10px]"><AlertCircle className="h-3 w-3" /> مستحق: {formatEGP(due)}</Badge>
                {purchaseCredit(p) > 0 && (
                  <Badge className="gap-1 text-[10px] bg-emerald-700">لنا عنده: {formatEGP(purchaseCredit(p))}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {hasImage && fileUrl && (
                <button
                  type="button"
                  className="rounded-md border overflow-hidden bg-white shrink-0 hover:ring-2 hover:ring-primary/40 transition-shadow"
                  title="عرض صورة الفاتورة"
                  onClick={() => openFilePreview(p.invoice_file_url, p.purchase_number)}
                >
                  <img
                    src={fileUrl}
                    alt={`مرفق ${p.purchase_number}`}
                    className="h-16 w-16 object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </button>
              )}
              <div className="flex gap-1">
                {p.invoice_file_url && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="عرض مرفق الفاتورة" onClick={() => openFilePreview(p.invoice_file_url, p.purchase_number)}>
                    {isPurchaseImageUrl(fileUrl) ? <ImageIcon className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(p)}><Printer className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="rounded-2xl border bg-gradient-to-l from-primary/15 via-background to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" /> الموردين
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              كل مورد له كارت بإجمالي المشتريات والمسدد والمستحق ورصيدنا عنده — المشتريات لا تدخل في المالية.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setNewSupplierName(''); setRegisterOpen(true); }}>
              <Plus className="h-4 w-4" /> تسجيل مورد
            </Button>
            <Button size="sm" className="gap-2" onClick={() => openAddPurchase()}>
              <ShoppingCart className="h-4 w-4" /> تسجيل مشتريات
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">عدد الموردين</p><p className="text-xl font-bold">{globalStats.count}</p></CardContent></Card>
        <Card className="bg-primary/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">إجمالي المشتريات</p><p className="text-lg font-bold">{formatEGP(globalStats.totalAll)}</p></CardContent></Card>
        <Card className="bg-green-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">المسدد</p><p className="text-lg font-bold text-green-700">{formatEGP(globalStats.totalPaid)}</p></CardContent></Card>
        <Card className="bg-amber-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">المستحق</p><p className="text-lg font-bold text-amber-700">{formatEGP(globalStats.totalDue)}</p></CardContent></Card>
        <Card className="bg-emerald-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">لنا عندهم</p><p className="text-lg font-bold text-emerald-800">{formatEGP(globalStats.totalCredit)}</p></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث باسم المورد..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSupplierCards.map((s) => (
            <Card
              key={s.name}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setDetailSupplier(s.name)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  {s.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">{s.count} فاتورة مشتريات</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] text-muted-foreground">إجمالي المشتريات</p>
                    <p className="font-bold text-sm">{formatEGP(s.total)}</p>
                  </div>
                  <div className="rounded-md bg-green-500/10 p-2">
                    <p className="text-[10px] text-muted-foreground">المسدد</p>
                    <p className="font-bold text-sm text-green-700">{formatEGP(s.paid)}</p>
                  </div>
                  <div className="rounded-md bg-amber-500/10 p-2">
                    <p className="text-[10px] text-muted-foreground">المستحق عليه</p>
                    <p className="font-bold text-sm text-amber-700">{formatEGP(s.due)}</p>
                  </div>
                  <div className="rounded-md bg-emerald-500/10 p-2">
                    <p className="text-[10px] text-muted-foreground">لنا عنده</p>
                    <p className="font-bold text-sm text-emerald-800">{formatEGP(s.credit)}</p>
                  </div>
                </div>
                <div className="flex gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetailSupplier(s.name)}>عرض</Button>
                  <Button size="sm" className="flex-1 gap-1" onClick={() => openAddPurchase(s.name)}>
                    <Plus className="h-3 w-3" /> تسجيل مشتريات
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredSupplierCards.length === 0 && (
            <p className="text-center text-muted-foreground py-8 col-span-full">لا يوجد موردين — سجّل مورداً أو فاتورة مشتريات.</p>
          )}
        </div>
      )}

      {/* تفاصيل المورد */}
      <Dialog open={!!detailSupplier} onOpenChange={(o) => { if (!o) setDetailSupplier(null); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {detailSupplier}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-primary/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">إجمالي المشتريات</p><p className="font-bold">{formatEGP(detailStats.total)}</p></CardContent></Card>
              <Card className="bg-green-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">المسدد</p><p className="font-bold text-green-700">{formatEGP(detailStats.paid)}</p></CardContent></Card>
              <Card className="bg-amber-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">المستحق</p><p className="font-bold text-amber-700">{formatEGP(detailStats.due)}</p></CardContent></Card>
              <Card className="bg-emerald-500/5"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">لنا عنده</p><p className="font-bold text-emerald-800">{formatEGP(detailStats.credit)}</p></CardContent></Card>
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">سجل المشتريات</h3>
              <Button size="sm" className="gap-1" onClick={() => openAddPurchase(detailSupplier || undefined)}>
                <Plus className="h-3 w-3" /> تسجيل فاتورة مشتريات
              </Button>
            </div>
            <div className="space-y-2">
              {detailPurchases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد فواتير لهذا المورد بعد.</p>
              ) : (
                detailPurchases.map((p, i) => renderPurchaseRow(p, i))
              )}
            </div>
            <Button variant="outline" className="gap-2" onClick={() => setDetailSupplier(null)}>
              <ArrowLeft className="h-4 w-4" /> رجوع للموردين
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* تسجيل مورد */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تسجيل مورد جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم المورد / الشركة *</Label>
              <Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="مثال: أوشن — الترا بيور" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRegisterOpen(false)}>إلغاء</Button>
              <Button onClick={handleRegisterSupplier}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* فاتورة مشتريات */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل فاتورة مشتريات' : 'فاتورة مشتريات جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>رقم الفاتورة *</Label>
                <Input value={form.purchase_number} onChange={(e) => setForm((f) => ({ ...f, purchase_number: e.target.value }))} placeholder="PUR-000001" />
              </div>
              <div>
                <Label>تاريخ الشراء</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} />
              </div>
            </div>
            <div className="relative">
              <Label>اسم المورد *</Label>
              <div className="relative">
                <Input
                  value={supplierSearch || form.supplier_name}
                  onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); setForm((f) => ({ ...f, supplier_name: e.target.value })); }}
                  onFocus={() => setShowSupplierDropdown(!!(supplierSearch || form.supplier_name).trim())}
                  onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                  placeholder="ابحث عن مورد أو اكتب الاسم..."
                  className="pr-9"
                />
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {showSupplierDropdown && filteredSuppliers.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
                  {filteredSuppliers.map((s) => (
                    <button key={s} type="button" className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0 font-medium" onClick={() => { setForm((f) => ({ ...f, supplier_name: s })); setSupplierSearch(s); setShowSupplierDropdown(false); }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 border rounded-md p-2">
              <div className="flex items-center justify-between">
                <Label>المنتجات</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine()])}>إضافة منتج</Button>
              </div>
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-2 last:border-0">
                  <div className="col-span-5">
                    <Label className="text-xs">منتج {idx + 1}</Label>
                    <ProductSearchCombobox
                      products={products.map((p) => ({
                        id: p.id,
                        name: p.name,
                        stock: Number(p.stock) || 0,
                        sku_code: p.sku_code,
                        barcode: p.barcode,
                      }))}
                      value={ln.product_id}
                      onValueChange={(id) => setLines((prev) => prev.map((row, i) => i === idx ? {
                        ...row,
                        product_id: id,
                        product_name: products.find((p) => p.id === id)?.name || row.product_name,
                        unit_price: String(products.find((p) => p.id === id)?.cost ?? row.unit_price ?? '0'),
                      } : row))}
                      placeholder="ابحث عن منتج"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">الكمية</Label>
                    <Input type="number" min={1} value={ln.quantity} onChange={(e) => setLines((prev) => prev.map((row, i) => i === idx ? { ...row, quantity: e.target.value } : row))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">السعر</Label>
                    <Input type="number" min={0} value={ln.unit_price} onChange={(e) => setLines((prev) => prev.map((row, i) => i === idx ? { ...row, unit_price: e.target.value } : row))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">الإجمالي</Label>
                    <Input value={String(lineTotal(ln))} readOnly />
                  </div>
                  <div className="col-span-1">
                    {lines.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" className="text-destructive px-1" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>×</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-md border p-2 bg-muted/20">
              <div>
                <Label className="text-xs flex items-center gap-1"><Wallet className="h-3 w-3" /> الإجمالي</Label>
                <Input value={String(formTotal)} readOnly />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Banknote className="h-3 w-3" /> المسدد</Label>
                <Input type="number" min={0} value={form.paid} onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" /> المستحق</Label>
                <Input value={String(formRemaining)} readOnly />
              </div>
            </div>
            {Number(form.paid) > formTotal && (
              <p className="text-xs text-emerald-700">رصيد لنا عند المورد: {formatEGP(Number(form.paid) - formTotal)}</p>
            )}

            <div>
              <Label>المندوب (اختياري)</Label>
              <Input value={form.rep_name} onChange={(e) => setForm((f) => ({ ...f, rep_name: e.target.value }))} placeholder="اسم المندوب" />
            </div>
            <div>
              <Label>رفع صورة / مرفق الفاتورة (اختياري)</Label>
              <Input type="file" accept="image/*,.pdf,.heic,.heif" capture="environment" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
              <p className="text-[11px] text-muted-foreground mt-1">يمكن التقاط صورة للفاتورة من الكاميرا أو اختيار ملف.</p>
              {formDisplayFileUrl && (
                <div className="mt-2 space-y-2 rounded-md border p-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {invoiceFile ? 'معاينة الصورة قبل الحفظ' : 'الصورة المحفوظة'}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => openFilePreview(invoicePreviewUrl || savedInvoiceFileUrl || editing?.invoice_file_url, form.purchase_number || 'فاتورة مشتريات')}
                    >
                      <Eye className="h-3.5 w-3.5" /> عرض بالحجم الكامل
                    </Button>
                  </div>
                  {formIsImage ? (
                    <button
                      type="button"
                      className="block w-full text-right"
                      onClick={() => openFilePreview(invoicePreviewUrl || savedInvoiceFileUrl || editing?.invoice_file_url, form.purchase_number || 'فاتورة مشتريات')}
                    >
                      <img
                        src={formDisplayFileUrl}
                        alt="مرفق فاتورة المشتريات"
                        className="max-h-56 w-full rounded border object-contain bg-white cursor-zoom-in"
                      />
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => openFilePreview(invoicePreviewUrl || savedInvoiceFileUrl || editing?.invoice_file_url, form.purchase_number || 'فاتورة مشتريات')}>
                        <Eye className="h-3.5 w-3.5" /> عرض المرفق
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving || uploadingFile}>{saving || uploadingFile ? 'جاري الحفظ...' : 'حفظ'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>صورة فاتورة {previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && isPurchaseImageUrl(previewUrl) ? (
            <div className="space-y-3">
              <img src={previewUrl} alt={previewTitle} className="w-full max-h-[72vh] object-contain rounded border bg-white" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">فتح في تبويب جديد</a>
                </Button>
              </div>
            </div>
          ) : previewUrl ? (
            <div className="space-y-3 text-center py-6">
              <p className="text-sm text-muted-foreground">معاينة غير متاحة لهذا النوع — افتح الملف مباشرة.</p>
              <Button asChild><a href={previewUrl} target="_blank" rel="noopener noreferrer">فتح المرفق</a></Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
