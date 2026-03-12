import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP, companyInfo } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search, Eye, Printer, Edit, Trash2, X, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import logo from '@/assets/logo.png';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id: string | null;
  product_name: string;
  product_id?: string | null;
  quantity?: number;
  amount: number;
  paid: number;
  remaining: number;
  type: string;
  status: string;
  branch: string;
  rep_name: string;
  rep_names?: string[] | null;
  date: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  branch?: string;
}

interface Customer {
  id: string;
  name: string;
  phone1: string;
  phone2?: string;
  address: string;
  region?: string;
}

const emptyForm = {
  invoice_number: '',
  customer_name: '',
  customer_id: '',
  product_name: '',
  product_id: '' as string,
  quantity: '1',
  amount: '',
  paid: '0',
  type: 'cash',
  branch: 'فرع الإسكندرية',
  rep_name: '',
  rep_names_text: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

// ===== Printable Invoice Component =====
function PrintableInvoice({ invoice, customer, onClose }: { invoice: Invoice; customer?: Customer; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.print(); return; }
    printWindow.document.write(`
      <html dir="rtl"><head><title>فاتورة ${invoice.invoice_number}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
        body { padding: 20px; color: #1a1a2e; }
        .invoice-container { max-width: 800px; margin: 0 auto; border: 2px solid #1a3a5c; padding: 30px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a3a5c; padding-bottom: 15px; margin-bottom: 20px; }
        .logo-section { display: flex; align-items: center; gap: 10px; }
        .logo-section img { width: 60px; height: 60px; object-fit: contain; }
        .company-name { font-size: 22px; font-weight: 800; color: #1a3a5c; }
        .company-sub { font-size: 11px; color: #666; }
        .invoice-title { background: linear-gradient(135deg, #1a3a5c, #2d5f8a); color: white; padding: 8px 30px; border-radius: 8px; font-size: 20px; font-weight: 700; }
        .invoice-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 13px; }
        .meta-row { display: flex; gap: 8px; }
        .meta-label { font-weight: 600; color: #666; min-width: 80px; }
        .meta-value { font-weight: 600; }
        .section-title { font-weight: 700; font-size: 14px; color: #1a3a5c; margin: 15px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { background: #f0f4f8; padding: 8px; border: 1px solid #ddd; font-size: 12px; text-align: right; }
        td { padding: 8px; border: 1px solid #ddd; font-size: 12px; }
        .total-row { background: #e8f4f8; font-weight: 700; }
        .amount-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 15px 0; }
        .amount-box { text-align: center; padding: 10px; border-radius: 8px; }
        .amount-box.total { background: #1a3a5c; color: white; }
        .amount-box.paid { background: #2d8a6e; color: white; }
        .amount-box.remaining { background: #c0392b; color: white; }
        .amount-label { font-size: 11px; opacity: 0.9; }
        .amount-value { font-size: 18px; font-weight: 800; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; margin-top: 40px; font-size: 11px; color: #666; }
        .sig-line { border-top: 1px dashed #999; margin-top: 50px; padding-top: 5px; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #888; text-align: center; }
        .status-badge { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; }
        .status-paid { background: #d4edda; color: #155724; }
        .status-partial { background: #fff3cd; color: #856404; }
        .status-pending { background: #f8d7da; color: #721c24; }
      </style></head><body>${content.innerHTML}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const statusClass = invoice.status === 'paid' ? 'status-paid' : invoice.status === 'partial' ? 'status-partial' : 'status-pending';
  const statusText = invoice.status === 'paid' ? 'مدفوعة' : invoice.status === 'partial' ? 'مدفوعة جزئياً' : 'معلقة';
  const typeText = invoice.type === 'cash' ? 'نقدي' : invoice.type === 'installment' ? 'تقسيط' : 'معلق';

  return (
    <div className="space-y-4">
      <div ref={printRef}>
        <div className="invoice-container" style={{ maxWidth: 800, margin: '0 auto', border: '2px solid hsl(210 80% 30%)', padding: 30, fontFamily: 'Cairo, sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid hsl(210 80% 30%)', paddingBottom: 15, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={logo} alt="Clean Water" style={{ width: 60, height: 60, objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'hsl(210 80% 30%)' }}>كلين ووتر</div>
                <div style={{ fontSize: 11, color: '#666' }}>لتكنولوجيا معالجة مياه الشرب</div>
              </div>
            </div>
            <div>
              <div style={{ background: 'linear-gradient(135deg, hsl(210 80% 30%), hsl(210 70% 45%))', color: 'white', padding: '8px 30px', borderRadius: 8, fontSize: 20, fontWeight: 700 }}>
                فاتورة
              </div>
            </div>
          </div>

          {/* Invoice Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>رقم الفاتورة:</span><span style={{ fontWeight: 700 }}>{invoice.invoice_number}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>التاريخ:</span><span style={{ fontWeight: 600 }}>{invoice.date}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>الحالة:</span><span className={statusClass} style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{statusText}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>نوع الدفع:</span><span style={{ fontWeight: 600 }}>{typeText}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>الفرع:</span><span style={{ fontWeight: 600 }}>{invoice.branch}</span></div>
            {invoice.rep_name && <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>المندوب:</span><span style={{ fontWeight: 600 }}>{invoice.rep_name}</span></div>}
          </div>

          {/* Customer Info */}
          <div style={{ fontWeight: 700, fontSize: 14, color: 'hsl(210 80% 30%)', marginBottom: 8, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>بيانات العميل</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 15, fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>الاسم:</span><span style={{ fontWeight: 700 }}>{invoice.customer_name}</span></div>
            {customer && (
              <>
                <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>الهاتف:</span><span>{customer.phone1}</span></div>
                <div style={{ display: 'flex', gap: 8, gridColumn: 'span 2' }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>العنوان:</span><span>{customer.address}</span></div>
                {customer.region && <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>المنطقة:</span><span>{customer.region}</span></div>}
              </>
            )}
          </div>

          {/* Products Table */}
          <div style={{ fontWeight: 700, fontSize: 14, color: 'hsl(210 80% 30%)', marginBottom: 8, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>تفاصيل المنتجات</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
            <thead>
              <tr>
                <th style={{ background: '#f0f4f8', padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'right' }}>#</th>
                <th style={{ background: '#f0f4f8', padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'right' }}>البيان</th>
                <th style={{ background: '#f0f4f8', padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'right', width: 120 }}>القيمة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'center' }}>1</td>
                <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12 }}>{invoice.product_name}</td>
                <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>{formatEGP(invoice.amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Amount Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '15px 0' }}>
            <div style={{ textAlign: 'center', padding: 10, borderRadius: 8, background: 'hsl(210 80% 30%)', color: 'white' }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>الإجمالي</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{formatEGP(invoice.amount)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, borderRadius: 8, background: 'hsl(152 60% 35%)', color: 'white' }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>المدفوع</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{formatEGP(invoice.paid)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, borderRadius: 8, background: 'hsl(0 72% 51%)', color: 'white' }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>المتبقي</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{formatEGP(invoice.remaining)}</div>
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, textAlign: 'center', marginTop: 40, fontSize: 11, color: '#666' }}>
            <div><div style={{ fontWeight: 600, marginBottom: 50 }}>خدمة العملاء</div><div style={{ borderTop: '1px dashed #999', paddingTop: 5 }}>التوقيع</div></div>
            <div><div style={{ fontWeight: 600, marginBottom: 50 }}>توقيع العميل</div><div style={{ borderTop: '1px dashed #999', paddingTop: 5 }}>التوقيع</div></div>
            <div><div style={{ fontWeight: 600, marginBottom: 50 }}>المندوب / الفني</div><div style={{ borderTop: '1px dashed #999', paddingTop: 5 }}>التوقيع</div></div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #ddd', fontSize: 10, color: '#888', textAlign: 'center' }}>
            <p>{companyInfo.branches.join(' | ')}</p>
            <p>خدمة العملاء: {companyInfo.customerService.join(' - ')}</p>
            <p>الخط الساخن: {companyInfo.hotline} | إدارة الفنيين: {companyInfo.techManagement}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-2 print:hidden">
        <Button onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> طباعة</Button>
        <Button variant="outline" onClick={onClose}>إغلاق</Button>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [searchParams] = useSearchParams();
  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';
  const { toast } = useToast();
  const { branch } = useUserBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, custRes, prodRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('branch', branch).order('created_at', { ascending: false }),
        supabase.from('customers').select('*').eq('branch', branch).order('name'),
        supabase.from('products').select('*').limit(500),
      ]);
      setInvoices(Array.isArray(invRes.data) ? (invRes.data as Invoice[]) : []);
      setCustomers(Array.isArray(custRes.data) ? (custRes.data as Customer[]) : []);
      setProducts(Array.isArray(prodRes.data) ? (prodRes.data as Product[]) : []);
    } catch (_e) {
      setInvoices([]);
      setCustomers([]);
      setProducts([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [branch]);

  const getCustomerByInv = (inv: Invoice) => customers.find(c => c.id === inv.customer_id || c.name === inv.customer_name);
  const searchTrim = search.trim();
  const isPhoneSearch = /^[0-9]+$/.test(searchTrim.replace(/\s/g, ''));
  const customerIdsByPhone = isPhoneSearch
    ? new Set(customers.filter(c => (c.phone1 + (c.phone2 || '') + (c.whatsapp || '')).replace(/\s/g, '').includes(searchTrim)).map(c => c.id))
    : new Set<string>();

  const filtered = invoices.filter(inv => {
    if (inv.status === 'deleted') return false;
    if (dateFrom && inv.date < dateFrom) return false;
    if (dateTo && inv.date > dateTo) return false;
    if (searchTrim === '') return true;
    if (inv.customer_name.includes(searchTrim) || inv.invoice_number.includes(searchTrim) || inv.product_name.includes(searchTrim)) return true;
    if (isPhoneSearch && (inv.customer_id ? customerIdsByPhone.has(inv.customer_id) : getCustomerByInv(inv) && customerIdsByPhone.has(getCustomerByInv(inv)!.id))) return true;
    return false;
  });

  const filteredCusts = customerSearch
    ? customers.filter(c => c.name.includes(customerSearch) || (c.phone1 || '').includes(customerSearch)).slice(0, 10)
    : [];

  const filteredProducts = productSearch.trim()
    ? products
        .filter(p => {
          const name = (p.name || '').toLowerCase().trim();
          const term = productSearch.toLowerCase().trim();
          // يقترح من أول حرف: يبدأ بالمدخل أو يحتويه بعد مسافة
          return name.startsWith(term) || name.includes(` ${term}`);
        })
        .slice(0, 15)
    : [];

  const getCustomer = (inv: Invoice) => getCustomerByInv(inv);

  const statusLabel = (s: string) => s === 'paid' ? 'مدفوعة' : s === 'partial' ? 'جزئي' : 'معلقة';
  const typeLabel = (t: string) => t === 'cash' ? 'نقدي' : t === 'installment' ? 'تقسيط' : 'معلق';

  const openAdd = () => {
    setForm({ ...emptyForm, invoice_number: `INV-${Date.now().toString().slice(-6)}`, branch: branch || emptyForm.branch });
    setCustomerSearch('');
    setProductSearch('');
    setEditInvoice(null);
    setAddOpen(true);
  };

  const openEdit = async (inv: Invoice) => {
    const password = window.prompt('أدخل كلمة مرور التعديل:');
    if (password == null) return;
    try {
      const verify = await supabase.auth.verifyDeletePassword(password);
      if (verify.error || !verify.data?.ok) {
        toast({ title: 'خطأ', description: verify.error?.message || 'كلمة المرور غير صحيحة', variant: 'destructive' });
        return;
      }
    } catch (_e) {
      toast({ title: 'خطأ', description: 'فشل التحقق من كلمة المرور', variant: 'destructive' });
      return;
    }
    const repNames = Array.isArray(inv.rep_names) ? inv.rep_names.join('، ') : (inv.rep_name || '');
    setForm({
      ...emptyForm,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      customer_id: inv.customer_id || '',
      product_name: inv.product_name,
      product_id: (inv as any).product_id || '',
      quantity: String((inv as any).quantity ?? 1),
      amount: String(inv.amount),
      paid: String(inv.paid),
      type: inv.type,
      branch: inv.branch,
      rep_name: inv.rep_name || '',
      rep_names_text: repNames,
      date: inv.date,
      notes: '',
    });
    setCustomerSearch(inv.customer_name);
    setProductSearch(inv.product_name);
    setEditInvoice(inv);
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!form.invoice_number || !form.customer_name || !form.amount) {
      toast({ title: 'خطأ', description: 'يرجى ملء الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    // Ensure product exists and is selected from registered products only
    const trimmedName = (form.product_name || '').trim();
    const matchedProduct = products.find(
      p => p.id === form.product_id || (p.name || '').trim() === trimmedName,
    );
    if (!trimmedName || !matchedProduct) {
      toast({
        title: 'خطأ في المنتج',
        description: 'يجب اختيار منتج من المنتجات المسجلة فقط ولا يمكن إدخال منتج غير مسجل.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const amount = Number(form.amount) || 0;
      const paid = Number(form.paid) || 0;
      const remaining = amount - paid;
      const status = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
      const user = (await supabase.auth.getUser()).data.user;

      const repNamesText = (form.rep_names_text || form.rep_name || '').trim();
      const repNamesArr = repNamesText ? repNamesText.split(/[،,]+/).map(s => s.trim()).filter(Boolean) : [];
      const repNameFirst = repNamesArr[0] || form.rep_name || '';

      const payload: Record<string, unknown> = {
        invoice_number: form.invoice_number,
        customer_name: form.customer_name,
        customer_id: form.customer_id || null,
        product_name: matchedProduct.name || '',
        amount, paid, remaining,
        type: form.type || 'cash',
        status,
        branch: form.branch || 'فرع الإسكندرية',
        rep_name: repNameFirst,
        date: form.date || new Date().toISOString().split('T')[0],
      };
      let productId = matchedProduct.id || null;
      if (productId) payload.product_id = productId;
      payload.quantity = Math.max(1, Number(form.quantity) || 1);
      if (repNamesArr.length > 0) {
        payload.rep_names = JSON.stringify(repNamesArr);
      }

      if (editInvoice) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', editInvoice.id);
        if (error) throw error;
        toast({ title: 'تم تعديل الفاتورة بنجاح' });
      } else {
        const { error } = await supabase.from('invoices').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast({ title: 'تم إضافة الفاتورة بنجاح' });
      }
      setAddOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!confirm(`هل تريد حذف الفاتورة ${inv.invoice_number}؟`)) return;
    const password = window.prompt('أدخل كلمة مرور الحذف:');
    if (password == null) return;
    try {
      const verify = await supabase.auth.verifyDeletePassword(password);
      if (verify.error || !verify.data?.ok) {
        toast({ title: 'خطأ', description: verify.error?.message || 'كلمة المرور غير صحيحة', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.from('invoices').update({ status: 'deleted' }).eq('id', inv.id);
      if (error) throw error;
      toast({ title: 'تم حذف الفاتورة' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  // Totals (ensure numbers: API may return strings)
  const activeInvoices = invoices.filter(i => i.status !== 'deleted');
  const totalAmount = activeInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalPaid = activeInvoices.reduce((s, i) => s + (Number(i.paid) || 0), 0);
  const totalRemaining = activeInvoices.reduce((s, i) => s + (Number(i.remaining) || 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-muted-foreground text-sm">{activeInvoices.length} فاتورة</p>
        </div>
        <Button className="gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" /> فاتورة جديدة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="gradient-card-blue text-primary-foreground">
          <CardContent className="p-3 text-center">
            <p className="text-xs opacity-90">إجمالي الفواتير</p>
            <p className="text-lg font-bold">{formatEGP(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card className="gradient-card-success text-primary-foreground">
          <CardContent className="p-3 text-center">
            <p className="text-xs opacity-90">إجمالي المدفوع</p>
            <p className="text-lg font-bold">{formatEGP(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="gradient-card-warning text-primary-foreground">
          <CardContent className="p-3 text-center">
            <p className="text-xs opacity-90">إجمالي المتبقي</p>
            <p className="text-lg font-bold">{formatEGP(totalRemaining)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث برقم الفاتورة، اسم العميل، المنتج أو رقم التلفون..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="space-y-3">
          {filtered.filter(i => i.status !== 'deleted').map((inv, i) => (
            <motion.div key={inv.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="card-shadow hover:card-shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm">{inv.invoice_number}</h3>
                        <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'partial' ? 'secondary' : 'outline'} className="text-[10px]">
                          {statusLabel(inv.status)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{typeLabel(inv.type)}</Badge>
                      </div>
                      <p className="text-sm">{inv.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{inv.product_name} {(inv as any).quantity > 1 ? ` × ${(inv as any).quantity}` : ''} • {inv.branch} • {inv.date}</p>
                      {(Array.isArray(inv.rep_names) ? inv.rep_names.join('، ') : inv.rep_name) && (
                        <p className="text-xs text-muted-foreground">المندوب: {Array.isArray(inv.rep_names) ? inv.rep_names.join('، ') : inv.rep_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">الإجمالي</p>
                        <p className="text-sm font-bold">{formatEGP(inv.amount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">المدفوع</p>
                        <p className="text-sm font-semibold text-secondary">{formatEGP(inv.paid)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">المتبقي</p>
                        <p className="text-sm font-semibold text-destructive">{formatEGP(inv.remaining)}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setViewInvoice(inv)} title="عرض">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEdit(inv)} title="تعديل">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(inv)} title="حذف">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.filter(i => i.status !== 'deleted').length === 0 && (
            <p className="text-center text-muted-foreground py-8">لا توجد فواتير</p>
          )}
        </div>
      )}

      {/* View Invoice Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={open => !open && setViewInvoice(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>فاتورة {viewInvoice?.invoice_number}</DialogTitle></DialogHeader>
          {viewInvoice && <PrintableInvoice invoice={viewInvoice} customer={getCustomer(viewInvoice)} onClose={() => setViewInvoice(null)} />}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Invoice Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editInvoice ? 'تعديل الفاتورة' : 'فاتورة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">رقم الفاتورة *</Label>
                <Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">التاريخ</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>

            {/* Customer Search */}
            <div className="relative">
              <Label className="text-xs">العميل *</Label>
              <Input
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustDropdown(true); setForm(p => ({ ...p, customer_name: e.target.value, customer_id: '' })); }}
                onFocus={() => setShowCustDropdown(true)}
                placeholder="ابحث عن العميل..."
                className="h-8 text-sm"
              />
              {showCustDropdown && filteredCusts.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
                  {filteredCusts.map(c => (
                    <button key={c.id} className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0"
                      onClick={() => { setForm(p => ({ ...p, customer_name: c.name, customer_id: c.id })); setCustomerSearch(c.name); setShowCustDropdown(false); }}>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-muted-foreground">{c.phone1} • {c.address}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <Label className="text-xs">المنتج *</Label>
              <Input
                value={productSearch || form.product_name}
                onChange={e => {
                  const v = e.target.value;
                  setProductSearch(v);
                  setShowProductDropdown(!!v.trim());
                  setForm(p => ({ ...p, product_name: v, product_id: '' }));
                }}
                onFocus={() => setShowProductDropdown(!!productSearch.trim())}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                placeholder="ابحث عن منتج..."
                className="h-8 text-sm"
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0 flex justify-between"
                      onClick={() => {
                        setForm(prev => ({ ...prev, product_name: p.name, product_id: p.id, amount: String(p.price || prev.amount) }));
                        setProductSearch(p.name);
                        setShowProductDropdown(false);
                      }}
                    >
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">مخزون: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الكمية</Label>
                <Input type="number" min={1} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className="h-8 text-sm" dir="ltr" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الإجمالي *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="h-8 text-sm" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">المدفوع</Label>
                <Input type="number" value={form.paid} onChange={e => setForm(p => ({ ...p, paid: e.target.value }))} className="h-8 text-sm" dir="ltr" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">نوع الدفع</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="installment">تقسيط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الفرع</Label>
                <Select value={form.branch} onValueChange={v => setForm(p => ({ ...p, branch: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="فرع الإسكندرية">فرع الإسكندرية</SelectItem>
                    <SelectItem value="فرع الجيزة">فرع الجيزة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">المندوب / المندوبون (أكثر من مندوب: افصل بفاصلة)</Label>
              <Input
                value={form.rep_names_text || form.rep_name}
                onChange={e => setForm(p => ({ ...p, rep_names_text: e.target.value, rep_name: e.target.value }))}
                placeholder="مثال: أحمد، محمد، خالد"
                className="h-8 text-sm"
              />
            </div>

            {/* Remaining calculation preview */}
            {form.amount && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span>الإجمالي:</span><span className="font-bold">{formatEGP(Number(form.amount) || 0)}</span></div>
                <div className="flex justify-between"><span>المدفوع:</span><span className="text-secondary font-bold">{formatEGP(Number(form.paid) || 0)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span>المتبقي:</span><span className="text-destructive font-bold">{formatEGP((Number(form.amount) || 0) - (Number(form.paid) || 0))}</span></div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : editInvoice ? 'تعديل' : 'حفظ'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
