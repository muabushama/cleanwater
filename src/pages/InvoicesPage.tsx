import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP, companyInfo } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search, Eye, Printer, Edit, Trash2, X, FileText, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import logo from '@/assets/logo.png';
import { invoiceCustomerCredit, invoiceDebtRemaining } from '@/lib/invoiceBalance';
import { promptDeletePassword, promptConfirmPassword } from '@/lib/deletePassword';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id: string | null;
  product_name: string;
  product_id?: string | null;
  quantity?: number;
  subtotal?: number;
  amount: number;
  paid: number;
  remaining: number;
  type: string;
  status: string;
  branch: string;
  rep_name: string;
  rep_names?: string[] | null;
  date: string;
  due_date?: string | null;
  delivery_status?: string | null;
  notes?: string | null;
  invoice_direction?: string | null; // مبيعات | وارد | منصرف
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  image?: string | null;
  branch?: string;
  sku_code?: string | null;
  barcode?: string | null;
}

export interface InvoiceLineView {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_id?: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone1: string;
  phone2?: string;
  whatsapp?: string;
  address: string;
  region?: string;
}

/** سعر الوحدة للسطر الأول × الكمية + بنود إضافية (قبل خصم/ضريبة) */
function computeSubtotalBeforeTax(
  form: { quantity: string; amount: string },
  lineItems: { quantity: string; unit_price: string }[],
): number {
  const q1 = Math.max(1, Number(form.quantity) || 1);
  const unitFirst = Number(form.amount) || 0;
  const firstLine = q1 * unitFirst;
  const extras = lineItems.reduce((acc, li) => {
    const q = Math.max(1, Number(li.quantity) || 1);
    const up = Number(li.unit_price) || 0;
    return acc + q * up;
  }, 0);
  return Math.round((firstLine + extras) * 100) / 100;
}

function productMatchesInvoiceSearch(p: Product, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return true;
  const name = (p.name || '').toLowerCase();
  const sku = String(p.sku_code || '').toLowerCase();
  const bc = String(p.barcode || '').toLowerCase();
  return name.includes(t) || name.startsWith(t) || sku.includes(t) || bc.includes(t);
}

const formatDateDisplay = (v: any) => {
  const s = String(v || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

const emptyForm = {
  invoice_number: '',
  customer_name: '',
  customer_id: '',
  product_name: '',
  product_id: '' as string,
  quantity: '1',
  amount: '',
  discount_percent: '0',
  discount_amount: '0',
  tax_percent: '0',
  tax_amount: '0',
  paid: '0',
  type: 'cash',
  branch: 'فرع الإسكندرية',
  rep_name: '',
  rep_names_text: '',
  technician: '',
  date: new Date().toISOString().split('T')[0],
  due_date: '' as string,
  delivery_status: 'pending',
  notes: '',
  auto_stock_deduct: '1',
  invoice_direction: 'مبيعات' as string,
};

// ===== Printable Invoice Component =====
function PrintableInvoice({
  invoice,
  customer,
  product,
  lines,
  onClose,
}: {
  invoice: Invoice;
  customer?: Customer;
  product?: Product | null;
  lines?: InvoiceLineView[];
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.print(); return; }
    const invoiceHtml = content.innerHTML;
    printWindow.document.write(`
      <html dir="rtl"><head><title>فاتورة ${invoice.invoice_number}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
        body { padding: 2mm; color: #1a1a2e; font-size: 11px; }
        .invoice-copy {
          height: calc(50vh - 4mm);
          overflow: hidden;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }
        .invoice-copy .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          border: 2px solid #1a3a5c;
          padding: 6px 10px;
          font-size: 11px;
          transform: scale(0.58);
          transform-origin: top center;
          width: 172%;
        }
        .copy-separator { border: none; border-top: 2px dashed #999; margin: 1px 0; }
        .invoice-container { max-width: 800px; margin: 0 auto; border: 2px solid #1a3a5c; padding: 10px 16px; }
        table { width: 100%; border-collapse: collapse; margin: 3px 0; }
        th { background: #f0f4f8; padding: 4px 6px; border: 1px solid #ddd; font-size: 11px; text-align: right; }
        td { padding: 4px 6px; border: 1px solid #ddd; font-size: 11px; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 700; }
        .status-paid { background: #d4edda; color: #155724; }
        .status-partial { background: #fff3cd; color: #856404; }
        .status-pending { background: #f8d7da; color: #721c24; }
        @media print {
          @page { margin: 3mm; }
          body { padding: 0; }
          .invoice-copy { page-break-inside: avoid; }
        }
      </style></head><body>
      <div class="invoice-copy">${invoiceHtml}</div>
      <hr class="copy-separator" />
      <div class="invoice-copy">${invoiceHtml}</div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const statusClass = invoice.status === 'paid' ? 'status-paid' : invoice.status === 'partial' ? 'status-partial' : 'status-pending';
  const statusText = invoice.status === 'paid' ? 'مدفوعة' : invoice.status === 'partial' ? 'مدفوعة جزئياً' : 'معلقة';
  const typeText = invoice.type === 'cash' ? 'نقدي' : invoice.type === 'installment' ? 'تقسيط' : 'معلق';
  const productImage = product?.image || null;
  const debt = invoiceDebtRemaining(invoice.amount, invoice.paid);
  const credit = invoiceCustomerCredit(invoice.amount, invoice.paid);

  return (
    <div className="space-y-4">
      <div ref={printRef}>
        <div className="invoice-container" style={{ maxWidth: 800, margin: '0 auto', border: '2px solid hsl(210 80% 30%)', padding: 30, fontFamily: 'Cairo, sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid hsl(210 80% 30%)', paddingBottom: 12, marginBottom: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={logo} alt="Clean Water" style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #ccc', borderRadius: 8, padding: 2 }} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'hsl(210 80% 30%)' }}>كلين ووتر</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>لتكنولوجيا معالجة مياه الشرب</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>خدمة العملاء: {companyInfo.customerService.join(' - ')}</div>
                <div style={{ fontSize: 11, color: '#666' }}>الخط الساخن: {companyInfo.hotline}</div>
              </div>
            </div>
            <div>
              <div style={{ background: 'linear-gradient(135deg, hsl(210 80% 30%), hsl(210 70% 45%))', color: 'white', padding: '8px 30px', borderRadius: 8, fontSize: 22, fontWeight: 700 }}>
                فاتورة
              </div>
            </div>
          </div>

          {/* Invoice Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>رقم الفاتورة:</span><span style={{ fontWeight: 700 }}>{invoice.invoice_number}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>التاريخ:</span><span style={{ fontWeight: 600 }}>{formatDateDisplay(invoice.date)}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>الحالة:</span><span className={statusClass} style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{statusText}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>نوع الدفع:</span><span style={{ fontWeight: 600 }}>{typeText}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>نوع الفاتورة:</span><span style={{ fontWeight: 600 }}>{(invoice as any).invoice_direction || 'مبيعات'}</span></div>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>الفرع:</span><span style={{ fontWeight: 600 }}>{invoice.branch}</span></div>
            {(invoice as any).due_date && <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>تاريخ الاستحقاق:</span><span style={{ fontWeight: 600 }}>{formatDateDisplay((invoice as any).due_date)}</span></div>}
            {(invoice as any).delivery_status === 'delivered' && <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>حالة التسليم:</span><span style={{ fontWeight: 600, color: '#0d9488' }}>تم التسليم</span></div>}
            {invoice.rep_name && <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>المندوب:</span><span style={{ fontWeight: 600 }}>{invoice.rep_name}</span></div>}
            {(invoice as any).technician && <div style={{ display: 'flex', gap: 8 }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>الفني:</span><span style={{ fontWeight: 600 }}>{(invoice as any).technician}</span></div>}
            {(invoice as any).notes && <div style={{ display: 'flex', gap: 8, gridColumn: 'span 2' }}><span style={{ fontWeight: 600, color: '#666', minWidth: 80 }}>ملاحظات:</span><span style={{ fontSize: 12 }}>{(invoice as any).notes}</span></div>}
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
                <th style={{ background: '#f0f4f8', padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'center', width: 56 }}>الكمية</th>
                <th style={{ background: '#f0f4f8', padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'center', width: 88 }}>سعر الوحدة</th>
                <th style={{ background: '#f0f4f8', padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'right', width: 100 }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {(lines && lines.length > 0
                ? lines
                : (() => {
                    const q = Math.max(1, Number((invoice as any).quantity) || 1);
                    const sub = Number((invoice as any).subtotal);
                    const linePreTax = Number.isFinite(sub) && sub > 0 ? sub : Number(invoice.amount) || 0;
                    return [{
                      product_name: invoice.product_name,
                      quantity: q,
                      unit_price: Math.max(0, linePreTax / q),
                      line_total: linePreTax,
                    }];
                  })()
              ).map((row, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {idx === 0 && productImage && (
                        <img
                          src={productImage}
                          alt={row.product_name}
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid #ddd',
                          }}
                        />
                      )}
                      <span>{row.product_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'center' }}>{row.quantity}</td>
                  <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'center' }}>{formatEGP(row.unit_price)}</td>
                  <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>
                    {formatEGP(row.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Amount Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '10px 0' }}>
            <div style={{ textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: 'hsl(210 80% 30%)', color: 'white' }}>
              <div style={{ fontSize: 10, opacity: 0.9 }}>الإجمالي</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{formatEGP(invoice.amount)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 8px', borderRadius: 8, background: 'hsl(152 60% 35%)', color: 'white' }}>
              <div style={{ fontSize: 10, opacity: 0.9 }}>المدفوع</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{formatEGP(invoice.paid)}</div>
            </div>
            <div
              style={{
                textAlign: 'center',
                padding: '6px 8px',
                borderRadius: 8,
                background: credit > 0 ? 'hsl(142 55% 30%)' : 'hsl(0 72% 51%)',
                color: 'white',
              }}
            >
              <div style={{ fontSize: 10, opacity: 0.9 }}>{credit > 0 ? 'رصيد للعميل (بالموجب)' : 'المتبقي على العميل'}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{formatEGP(credit > 0 ? credit : debt)}</div>
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, textAlign: 'center', marginTop: 20, fontSize: 13, color: '#1a1a2e' }}>
            <div><div style={{ fontWeight: 800, fontSize: 13, marginBottom: 30 }}>توقيع العميل</div><div style={{ borderTop: '2px solid #333', paddingTop: 4, fontSize: 11, fontWeight: 600 }}>التوقيع والاسم</div></div>
            <div><div style={{ fontWeight: 800, fontSize: 13, marginBottom: 30 }}>توقيع الفني / المندوب</div><div style={{ borderTop: '2px solid #333', paddingTop: 4, fontSize: 11, fontWeight: 600 }}>التوقيع والاسم</div></div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 12, paddingTop: 8, borderTop: '2px solid hsl(210 80% 30%)', fontSize: 11, color: '#333', textAlign: 'center', lineHeight: 1.8 }}>
            <p style={{ fontWeight: 700, fontSize: 12 }}>{companyInfo.branches[0]}</p>
            <p style={{ fontWeight: 700, fontSize: 12 }}>{companyInfo.branches[1]}</p>
            <p style={{ fontWeight: 600 }}>خدمة العملاء: {companyInfo.customerService.join(' - ')}</p>
            <p style={{ fontWeight: 700 }}>الخط الساخن: {companyInfo.hotline} | إدارة الفنيين: {companyInfo.techManagement}</p>
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
  const [viewInvoiceLines, setViewInvoiceLines] = useState<InvoiceLineView[] | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [lineItems, setLineItems] = useState<{ product_id: string; product_name: string; quantity: string; unit_price: string; searchTerm: string; showDropdown: boolean }[]>([]);
  const [searchParams] = useSearchParams();
  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';
  const { toast } = useToast();
  const { branch } = useUserBranch();
  const navigate = useNavigate();

  const fetchData = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const bVals = branchDbValuesForUiBranch(branch);
      const [invRes, custRes, prodRes] = await Promise.all([
        supabase.from('invoices').select('*').in('branch', bVals).order('created_at', { ascending: false }),
        supabase.from('customers').select('*').in('branch', bVals).order('name'),
        supabase.from('products').select('*').in('branch', bVals).order('name').limit(5000),
      ]);
      // Silent refresh: never replace invoices with [] (avoids losing the row after save on API quirks).
      if (Array.isArray(invRes.data)) {
        if (silent && invRes.data.length === 0) {
          // keep previous invoices
        } else {
          setInvoices(invRes.data as Invoice[]);
        }
      } else if (!silent) {
        setInvoices([]);
      }
      if (Array.isArray(custRes.data)) {
        setCustomers(custRes.data as Customer[]);
      } else if (!silent) {
        setCustomers([]);
      }
      if (Array.isArray(prodRes.data)) {
        setProducts(prodRes.data as Product[]);
      } else if (!silent) {
        setProducts([]);
      }
    } catch (_e) {
      if (!silent) {
        setInvoices([]);
        setCustomers([]);
        setProducts([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /** بعد الحفظ: تحديث العملاء والمنتجات دائماً؛ الفواتير تُستبدل فقط إذا رجع الطلب صفوفاً (لا نمسح القائمة بـ []). */
  const refreshAfterInvoiceSave = async () => {
    const bVals = branchDbValuesForUiBranch(branch);
    try {
      const [custRes, prodRes, invRes] = await Promise.all([
        supabase.from('customers').select('*').in('branch', bVals).order('name'),
        supabase.from('products').select('*').in('branch', bVals).order('name').limit(5000),
        supabase.from('invoices').select('*').in('branch', bVals).order('created_at', { ascending: false }),
      ]);
      if (Array.isArray(custRes.data)) setCustomers(custRes.data as Customer[]);
      if (Array.isArray(prodRes.data)) setProducts(prodRes.data as Product[]);
      if (Array.isArray(invRes.data)) {
        setInvoices(invRes.data as Invoice[]);
      }
    } catch {
      /* الإبقاء على الحالة الحالية */
    }
  };

  useEffect(() => { fetchData(); }, [branch]);

  useEffect(() => {
    if (!viewInvoice) {
      setViewInvoiceLines(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', viewInvoice.id)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (data && data.length > 0) {
        setViewInvoiceLines(
          (data as any[]).map((row) => ({
            product_name: String(row.product_name || ''),
            quantity: Math.max(1, Number(row.quantity) || 1),
            unit_price: Number(row.unit_price) || 0,
            line_total:
              row.total != null && row.total !== ''
                ? Number(row.total)
                : Math.round(Number(row.quantity) * Number(row.unit_price) * 100) / 100,
            product_id: row.product_id,
          })),
        );
      } else {
        setViewInvoiceLines(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewInvoice]);

  const getCustomerByInv = (inv: Invoice) => customers.find(c => c.id === inv.customer_id || c.name === inv.customer_name);
  const getProductByInv = (inv: Invoice) =>
    products.find(
      (p) =>
        (inv as any).product_id
          ? p.id === (inv as any).product_id
          : (p.name || '').trim() === (inv.product_name || '').trim(),
    ) || null;
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
    ? products.filter(p => productMatchesInvoiceSearch(p, productSearch)).slice(0, 15)
    : products.slice(0, 15);

  const getCustomer = (inv: Invoice) => getCustomerByInv(inv);

  const statusLabel = (s: string) => s === 'paid' ? 'مدفوعة' : s === 'partial' ? 'جزئي' : 'معلقة';
  const typeLabel = (t: string) => t === 'cash' ? 'نقدي' : t === 'installment' ? 'تقسيط' : 'معلق';

  const getNextInvoiceNumber = () => {
    let maxNum = 0;
    invoices.forEach(inv => {
      const num = parseInt(String(inv.invoice_number).replace(/\D/g, ''), 10);
      if (Number.isFinite(num) && num > maxNum) maxNum = num;
    });
    return String(maxNum + 1);
  };

  const openAdd = () => {
    setForm({
      ...emptyForm,
      invoice_number: getNextInvoiceNumber(),
      branch: canonicalBranchForSave(branch),
      auto_stock_deduct: '1',
    });
    setCustomerSearch('');
    setProductSearch('');
    setLineItems([]);
    setEditInvoice(null);
    setAddOpen(true);
  };

  const openEdit = async (inv: Invoice) => {
    if (!promptConfirmPassword('تعديل الفاتورة')) return;
    const repNames = Array.isArray(inv.rep_names) ? inv.rep_names.join('، ') : (inv.rep_name || '');

    let lineRows: any[] = [];
    try {
      const { data } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', inv.id)
        .order('created_at', { ascending: true });
      lineRows = Array.isArray(data) ? data : [];
    } catch {
      lineRows = [];
    }

    const qHead = Math.max(1, Number((inv as any).quantity ?? 1));
    const subInv = Number((inv as any).subtotal);
    const amtInv = Number(inv.amount);
    let firstQty = qHead;
    let firstUnit = '';
    let firstName = inv.product_name;
    let firstPid = String((inv as any).product_id || '');
    let extraLines: typeof lineItems = [];

    if (lineRows.length > 0) {
      const [first, ...rest] = lineRows;
      firstQty = Math.max(1, Number(first.quantity) || 1);
      firstUnit = String(Number(first.unit_price) ?? 0);
      firstName = String(first.product_name || inv.product_name);
      firstPid = String(first.product_id || (inv as any).product_id || '');
      extraLines = rest.map((li) => ({
        product_id: li.product_id ? String(li.product_id) : '',
        product_name: String(li.product_name || ''),
        quantity: String(Math.max(1, Number(li.quantity) || 1)),
        unit_price: String(Number(li.unit_price) ?? 0),
        searchTerm: String(li.product_name || ''),
        showDropdown: false,
      }));
    } else {
      const preTax = Number.isFinite(subInv) && subInv > 0 ? subInv : amtInv;
      firstUnit = String(preTax / firstQty);
    }

    setForm({
      ...emptyForm,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      customer_id: inv.customer_id || '',
      product_name: firstName,
      product_id: firstPid,
      quantity: String(firstQty),
      amount: firstUnit || String((Number((inv as any).subtotal) || Number(inv.amount)) / qHead),
      discount_percent: String((inv as any).discount_percent ?? 0),
      discount_amount: String((inv as any).discount_amount ?? 0),
      tax_percent: String((inv as any).tax_percent ?? 0),
      tax_amount: String((inv as any).tax_amount ?? 0),
      paid: String(inv.paid),
      auto_stock_deduct: (inv as any).auto_stock_deduct !== 0 ? '1' : '0',
      type: inv.type,
      branch: inv.branch,
      rep_name: inv.rep_name || '',
      rep_names_text: repNames,
      date: inv.date,
      due_date: (inv as any).due_date || '',
      delivery_status: (inv as any).delivery_status || 'pending',
      notes: (inv as any).notes || '',
      invoice_direction: (inv as any).invoice_direction || 'مبيعات',
      technician: (inv as any).technician || '',
    });
    setCustomerSearch(inv.customer_name);
    setProductSearch(firstName);
    setLineItems(extraLines);
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
    const tl = trimmedName.toLowerCase();
    const matchedProduct = products.find((p) => {
      if (form.product_id && p.id === form.product_id) return true;
      if ((p.name || '').trim() === trimmedName) return true;
      const sku = (p.sku_code || '').trim().toLowerCase();
      const bc = (p.barcode || '').trim().toLowerCase();
      if (sku && sku === tl) return true;
      if (bc && bc === tl) return true;
      return false;
    });
    if (!trimmedName || !matchedProduct) {
      toast({
        title: 'خطأ في المنتج',
        description: 'يجب اختيار منتج من المنتجات المسجلة فقط ولا يمكن إدخال منتج غير مسجل.',
        variant: 'destructive',
      });
      return;
    }

    const directionEarly = String((form as any).invoice_direction || 'مبيعات');
    const qtyEarly = Math.max(1, Number(form.quantity) || 1);
    const autoEarly = form.auto_stock_deduct === '1';
    const pidEarly = matchedProduct.id || null;

    if (autoEarly && pidEarly && directionEarly !== 'وارد') {
      const { data: freshStockRow, error: stockFetchErr } = await supabase.from('products').select('stock').eq('id', pidEarly).single();
      if (stockFetchErr) {
        toast({ title: 'خطأ', description: stockFetchErr.message, variant: 'destructive' });
        return;
      }
      const available = Number((freshStockRow as any)?.stock ?? matchedProduct.stock) || 0;

      if (editInvoice) {
        const oldQty = Math.max(1, Number((editInvoice as any).quantity ?? 1));
        const oldDir = String((editInvoice as any).invoice_direction || 'مبيعات');
        const oldOut = oldDir === 'وارد' ? 0 : oldQty;
        const newOut = directionEarly === 'وارد' ? 0 : qtyEarly;
        const oldPid = String((editInvoice as any).product_id || editInvoice.product_id || '');
        const newPid = String(pidEarly);
        if (oldPid === newPid) {
          const extraNeeded = Math.max(0, newOut - oldOut);
          if (extraNeeded > available) {
            toast({
              title: 'مخزون غير كافٍ',
              description: `لا يوجد كمية كافية في المخزن (المتاح: ${available}). يرجى إضافة كمية أولاً.`,
              variant: 'destructive',
            });
            return;
          }
        } else if (newOut > available) {
          toast({
            title: 'مخزون غير كافٍ',
            description: `لا يوجد كمية كافية في المخزن (المتاح: ${available}). يرجى إضافة كمية أولاً.`,
            variant: 'destructive',
          });
          return;
        }
      } else if (qtyEarly > available) {
        toast({
          title: 'مخزون غير كافٍ',
          description: `لا يوجد كمية كافية في المخزن (المتاح: ${available}). يرجى إضافة كمية أولاً.`,
          variant: 'destructive',
        });
        return;
      }
    }

    if (autoEarly && directionEarly !== 'وارد' && lineItems.length > 0) {
      for (const li of lineItems) {
        if (!li.product_id) continue;
        const liQty = Math.max(1, Number(li.quantity) || 1);
        const { data: liStockRow, error: liErr } = await supabase.from('products').select('stock,name').eq('id', li.product_id).single();
        if (liErr) {
          toast({ title: 'خطأ', description: liErr.message, variant: 'destructive' });
          return;
        }
        const liAvail = Number((liStockRow as any)?.stock) || 0;
        if (!editInvoice && liQty > liAvail) {
          toast({
            title: 'مخزون غير كافٍ',
            description: `المنتج ${(liStockRow as any)?.name || ''}: المتاح ${liAvail}`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const subtotal = computeSubtotalBeforeTax(form, lineItems);
      const discountP = Number(form.discount_percent) || 0;
      const discountA = Number(form.discount_amount) || 0;
      const discount = discountA > 0 ? discountA : (subtotal * discountP / 100);
      const afterDiscount = subtotal - discount;
      const taxP = Number(form.tax_percent) || 0;
      const taxA = Number(form.tax_amount) || 0;
      const tax = taxA > 0 ? taxA : (afterDiscount * taxP / 100);
      const amount = Math.round((afterDiscount + tax) * 100) / 100;
      const paid = Number(form.paid) || 0;
      const remaining = invoiceDebtRemaining(amount, paid);
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
        subtotal,
        discount_percent: discountP,
        discount_amount: discount,
        tax_percent: taxP,
        tax_amount: tax,
        amount, paid, remaining,
        type: form.type || 'cash',
        status,
        branch: canonicalBranchForSave(branch),
        rep_name: repNameFirst,
        date: form.date || new Date().toISOString().split('T')[0],
        due_date: form.due_date && form.due_date.trim() ? form.due_date.trim() : null,
        delivery_status: form.delivery_status && form.delivery_status.trim() ? form.delivery_status : 'pending',
        notes: form.notes && form.notes.trim() ? form.notes.trim() : null,
        auto_stock_deduct: form.auto_stock_deduct === '1' ? 1 : 0,
        invoice_direction: (form as any).invoice_direction || 'مبيعات',
        technician: (form.technician || '').trim() || null,
      };
      let productId = matchedProduct.id || null;
      if (productId) payload.product_id = productId;
      const qty = Math.max(1, Number(form.quantity) || 1);
      payload.quantity = qty;
      if (repNamesArr.length > 0) {
        payload.rep_names = JSON.stringify(repNamesArr);
      }

      let newInvoiceId: string | null = null;
      const getSignedDelta = (direction: string, quantity: number) => {
        if (direction === 'وارد') return quantity;
        // مبيعات أو منصرف = خروج من المخزون
        if (direction === 'مبيعات' || direction === 'منصرف') return -quantity;
        return -quantity;
      };
      if (editInvoice) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', editInvoice.id);
        if (error) throw error;
        setInvoices((prev) =>
          prev.map((row) =>
            row.id === editInvoice.id ? ({ ...row, ...(payload as Partial<Invoice>) } as Invoice) : row,
          ),
        );
        toast({ title: 'تم تعديل الفاتورة بنجاح' });

        // Update stock only as a delta adjustment (prevents double-counting sale/purchase totals).
        const newAuto = (payload.auto_stock_deduct as any) === 1 || payload.auto_stock_deduct === '1' || payload.auto_stock_deduct === true;
        const oldAuto = Number((editInvoice as any).auto_stock_deduct ?? 0) !== 0;
        const newDir = String((payload.invoice_direction as any) || 'مبيعات');
        const oldDir = String((editInvoice as any).invoice_direction || 'مبيعات');
        const oldQty = Math.max(1, Number((editInvoice as any).quantity ?? 1));

        const oldProductId = (editInvoice as any).product_id || editInvoice.product_id || null;
        const newProductId = productId;

        const oldDelta = oldAuto && oldProductId ? getSignedDelta(oldDir, oldQty) : 0;
        const newDelta = newAuto && newProductId ? getSignedDelta(newDir, qty) : 0;

        if (oldProductId && newProductId && oldProductId === newProductId) {
          const delta = newDelta - oldDelta;
          if (delta !== 0) {
            const targetId = newProductId;
            const { data: prod } = await supabase.from('products').select('stock').eq('id', targetId).single();
            const current = Number((prod as any)?.stock) || 0;

            await supabase.from('stock_movements').insert({
              id: crypto.randomUUID(),
              product_id: targetId,
              branch: canonicalBranchForSave(branch),
              type: 'adjustment',
              quantity: delta,
              reference_type: 'invoice_edit',
              reference_id: editInvoice.invoice_number,
              notes: `تعديل فاتورة ${form.invoice_number}`,
            });

            await supabase.from('products').update({ stock: Math.max(0, current + delta) }).eq('id', targetId);
          }
        } else {
          // If product changed, revert old product and apply new product.
          if (oldProductId && oldDelta !== 0) {
            const revertDelta = -oldDelta;
            const { data: prodOld } = await supabase.from('products').select('stock').eq('id', oldProductId).single();
            const currentOld = Number((prodOld as any)?.stock) || 0;

            await supabase.from('stock_movements').insert({
              id: crypto.randomUUID(),
              product_id: oldProductId,
              branch: canonicalBranchForSave(branch),
              type: 'adjustment',
              quantity: revertDelta,
              reference_type: 'invoice_edit',
              reference_id: editInvoice.invoice_number,
              notes: `عكس فاتورة (تغيير المنتج) ${form.invoice_number}`,
            });
            await supabase.from('products').update({ stock: Math.max(0, currentOld + revertDelta) }).eq('id', oldProductId);
          }
          if (newProductId && newDelta !== 0) {
            const { data: prodNew } = await supabase.from('products').select('stock').eq('id', newProductId).single();
            const currentNew = Number((prodNew as any)?.stock) || 0;

            await supabase.from('stock_movements').insert({
              id: crypto.randomUUID(),
              product_id: newProductId,
              branch: canonicalBranchForSave(branch),
              type: 'adjustment',
              quantity: newDelta,
              reference_type: 'invoice_edit',
              reference_id: editInvoice.invoice_number,
              notes: `تطبيق فاتورة (تغيير المنتج) ${form.invoice_number}`,
            });
            await supabase.from('products').update({ stock: Math.max(0, currentNew + newDelta) }).eq('id', newProductId);
          }
        }

        await supabase.from('invoice_lines').delete().eq('invoice_id', editInvoice.id);
        const unitFirst = Number(form.amount) || 0;
        if (productId) {
          await (supabase as any).from('invoice_lines').insert({
            id: crypto.randomUUID(),
            invoice_id: editInvoice.id,
            product_id: productId,
            product_name: matchedProduct.name || '',
            quantity: qty,
            unit_price: unitFirst,
            total: Math.round(qty * unitFirst * 100) / 100,
          });
        }
        for (const li of lineItems) {
          if (!li.product_id && !li.product_name.trim()) continue;
          const liQty = Math.max(1, Number(li.quantity) || 1);
          const liPrice = Number(li.unit_price) || 0;
          await (supabase as any).from('invoice_lines').insert({
            id: crypto.randomUUID(),
            invoice_id: editInvoice.id,
            product_id: li.product_id || null,
            product_name: li.product_name.trim() || 'منتج',
            quantity: liQty,
            unit_price: liPrice,
            total: Math.round(liQty * liPrice * 100) / 100,
          });
        }
      } else {
        newInvoiceId = crypto.randomUUID();
        const insertPayload = { ...payload, id: newInvoiceId, created_by: user?.id };
        const { data: inserted, error } = await supabase.from('invoices').insert(insertPayload).select('*').single();
        if (error) throw error;
        const rowFromServer = inserted && typeof inserted === 'object' ? (inserted as Invoice) : null;
        if (rowFromServer?.id) newInvoiceId = rowFromServer.id;
        const optimistic: Invoice = rowFromServer || {
          id: newInvoiceId as string,
          created_at: new Date().toISOString(),
          customer_name: String(payload.customer_name || ''),
          customer_id: (payload.customer_id as string) || null,
          product_name: String(payload.product_name || ''),
          product_id: (payload.product_id as string) || null,
          quantity: Number(payload.quantity || 1),
          amount: Number(payload.amount || 0),
          paid: Number(payload.paid || 0),
          remaining: Number(payload.remaining || 0),
          type: String(payload.type || 'cash'),
          status: String(payload.status || 'pending'),
          branch: String(payload.branch || branch),
          rep_name: String(payload.rep_name || ''),
          rep_names: repNamesArr.length ? repNamesArr : null,
          date: String(payload.date || new Date().toISOString().slice(0, 10)),
          due_date: (payload.due_date as string) || null,
          delivery_status: (payload.delivery_status as string) || null,
          notes: (payload.notes as string) || null,
          invoice_number: String(payload.invoice_number || ''),
          invoice_direction: String((payload as any).invoice_direction || 'مبيعات'),
        };
        setInvoices((prev) => {
          const id = optimistic.id;
          const withoutDup = prev.filter((r) => r.id !== id);
          return [optimistic, ...withoutDup];
        });
        toast({ title: 'تم إضافة الفاتورة بنجاح' });
        const direction = String((payload.invoice_direction as any) || 'مبيعات');

        if (form.auto_stock_deduct === '1' && productId && newInvoiceId) {
          const delta = getSignedDelta(direction, qty);
          const rowType = delta >= 0 ? 'purchase' : 'sale';
          const absQty = Math.abs(delta);

          const { error: movErr } = await supabase.from('stock_movements').insert({
            id: crypto.randomUUID(),
            product_id: productId,
            branch: canonicalBranchForSave(branch),
            type: rowType,
            quantity: absQty,
            reference_type: 'invoice',
            reference_id: form.invoice_number,
            notes: `فاتورة ${form.invoice_number} (${direction})`,
          });

          if (!movErr) {
            const { data: prod } = await supabase.from('products').select('stock').eq('id', productId).single();
            const current = Number((prod as any)?.stock) || 0;
            await supabase.from('products').update({ stock: Math.max(0, current + delta) }).eq('id', productId);
          }
        }

        if (newInvoiceId && productId) {
          const unitFirst = Number(form.amount) || 0;
          await (supabase as any).from('invoice_lines').insert({
            id: crypto.randomUUID(),
            invoice_id: newInvoiceId,
            product_id: productId,
            product_name: matchedProduct.name || '',
            quantity: qty,
            unit_price: unitFirst,
            total: Math.round(qty * unitFirst * 100) / 100,
          });
        }
        if (newInvoiceId && lineItems.length > 0) {
          for (const li of lineItems) {
            if (!li.product_id && !li.product_name.trim()) continue;
            const liQty = Math.max(1, Number(li.quantity) || 1);
            const liPrice = Number(li.unit_price) || 0;
            await (supabase as any).from('invoice_lines').insert({
              id: crypto.randomUUID(),
              invoice_id: newInvoiceId,
              product_id: li.product_id || null,
              product_name: li.product_name.trim() || 'منتج',
              quantity: liQty,
              unit_price: liPrice,
              total: liQty * liPrice,
            });
            if (form.auto_stock_deduct === '1' && li.product_id) {
              const liDelta = getSignedDelta(direction, liQty);
              const liRowType = liDelta >= 0 ? 'purchase' : 'sale';
              await supabase.from('stock_movements').insert({
                id: crypto.randomUUID(),
                product_id: li.product_id,
                branch: canonicalBranchForSave(branch),
                type: liRowType,
                quantity: Math.abs(liDelta),
                reference_type: 'invoice_line',
                reference_id: form.invoice_number,
                notes: `بند فاتورة ${form.invoice_number} — ${li.product_name}`,
              });
              const { data: liProd } = await supabase.from('products').select('stock').eq('id', li.product_id).single();
              const liCurrent = Number((liProd as any)?.stock) || 0;
              await supabase.from('products').update({ stock: Math.max(0, liCurrent + liDelta) }).eq('id', li.product_id);
            }
          }
        }
      }
      setAddOpen(false);
      await refreshAfterInvoiceSave();
      const invDate = String(form.date || new Date().toISOString().slice(0, 10));
      if (dateFrom && invDate < dateFrom) {
        toast({
          title: 'تم الحفظ',
          description: 'تاريخ الفاتورة أقدم من «من تاريخ» المعروض؛ أزل التصفية أو وسّع النطاق لرؤيتها في القائمة.',
        });
      } else if (dateTo && invDate > dateTo) {
        toast({
          title: 'تم الحفظ',
          description: 'تاريخ الفاتورة أحدث من «إلى تاريخ» المعروض؛ أزل التصفية أو وسّع النطاق لرؤيتها في القائمة.',
        });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!confirm(`هل تريد حذف الفاتورة ${inv.invoice_number}؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('invoices').update({ status: 'deleted' }).eq('id', inv.id);
      if (error) throw error;

      // Revert stock movement if it was applied originally.
      const auto = Number((inv as any).auto_stock_deduct ?? 0) === 1;
      const productId = (inv as any).product_id || inv.product_id;
      const qty = Math.max(1, Number((inv as any).quantity ?? 1));
      const direction = String((inv as any).invoice_direction || 'مبيعات');
      if (auto && productId) {
        const getSignedDelta = (d: string, quantity: number) => {
          if (d === 'وارد') return quantity;
          if (d === 'مبيعات' || d === 'منصرف') return -quantity;
          return -quantity;
        };
        const delta = getSignedDelta(direction, qty); // + = وارد
        const revertDelta = -delta;
        if (revertDelta !== 0) {
          const { data: prod } = await supabase.from('products').select('stock').eq('id', productId).single();
          const current = Number((prod as any)?.stock) || 0;

          await supabase.from('stock_movements').insert({
            id: crypto.randomUUID(),
            product_id: productId,
            branch: inv.branch || 'فرع الإسكندرية',
            type: 'adjustment',
            quantity: revertDelta,
            reference_type: 'invoice_delete',
            reference_id: inv.invoice_number,
            notes: `حذف فاتورة ${inv.invoice_number}`,
          });
          await supabase.from('products').update({ stock: Math.max(0, current + revertDelta) }).eq('id', productId);
        }
      }
      setInvoices((prev) => prev.map((r) => (r.id === inv.id ? { ...r, status: 'deleted' } : r)));
      toast({ title: 'تم حذف الفاتورة' });
      await fetchData({ silent: true });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  // Totals (ensure numbers: API may return strings)
  const activeInvoices = invoices.filter(i => i.status !== 'deleted');
  const totalAmount = activeInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalPaid = activeInvoices.reduce((s, i) => s + (Number(i.paid) || 0), 0);
  const totalRemaining = activeInvoices.reduce((s, i) => s + invoiceDebtRemaining(i.amount, i.paid), 0);
  const totalCustomerCredit = activeInvoices.reduce((s, i) => s + invoiceCustomerCredit(i.amount, i.paid), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-muted-foreground text-sm">{activeInvoices.length} فاتورة — البيانات مرتبطة بالمالية والحسابات (داخلة، متبقي، آجل، منصرف، معلق، تم التسليم)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/finance')}>
            <DollarSign className="h-4 w-4" /> المالية
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> فاتورة جديدة
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <p className="text-xs opacity-90">متبقي على العملاء</p>
            <p className="text-lg font-bold">{formatEGP(totalRemaining)}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-700 text-primary-foreground border-0">
          <CardContent className="p-3 text-center">
            <p className="text-xs opacity-90">رصيد للعملاء (دفعات زائدة)</p>
            <p className="text-lg font-bold">{formatEGP(totalCustomerCredit)}</p>
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
                        {(inv as any).invoice_direction && (inv as any).invoice_direction !== 'مبيعات' && (
                          <Badge variant="outline" className="text-[10px]">{(inv as any).invoice_direction}</Badge>
                        )}
                        {(inv as any).delivery_status === 'delivered' && (
                          <Badge variant="secondary" className="text-[10px] bg-teal-500/20 text-teal-700">تم التسليم</Badge>
                        )}
                      </div>
                      <p className="text-sm">{inv.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{inv.product_name} {(inv as any).quantity > 1 ? ` × ${(inv as any).quantity}` : ''} • {inv.branch} • {formatDateDisplay(inv.date)}{(inv as any).due_date ? ` • استحقاق: ${formatDateDisplay((inv as any).due_date)}` : ''}</p>
                      {(Array.isArray(inv.rep_names) ? inv.rep_names.join('، ') : inv.rep_name) && (
                        <p className="text-xs text-muted-foreground">المندوب: {Array.isArray(inv.rep_names) ? inv.rep_names.join('، ') : inv.rep_name}</p>
                      )}
                      {(inv as any).technician && (
                        <p className="text-xs text-muted-foreground">الفني: {(inv as any).technician}</p>
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
                      <div className="text-center min-w-[100px]">
                        <p className="text-xs text-muted-foreground">الرصيد</p>
                        {invoiceCustomerCredit(inv.amount, inv.paid) > 0 ? (
                          <p className="text-sm font-semibold text-emerald-700">رصيد {formatEGP(invoiceCustomerCredit(inv.amount, inv.paid))}</p>
                        ) : (
                          <p className="text-sm font-semibold text-destructive">متبقي {formatEGP(invoiceDebtRemaining(inv.amount, inv.paid))}</p>
                        )}
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
          {viewInvoice && (
            <PrintableInvoice
              invoice={viewInvoice}
              customer={getCustomer(viewInvoice)}
              product={getProductByInv(viewInvoice)}
              lines={viewInvoiceLines ?? undefined}
              onClose={() => setViewInvoice(null)}
            />
          )}
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
                onFocus={() => setShowProductDropdown(true)}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                placeholder="اسم المنتج أو كود الصنف أو الباركود..."
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

            {/* Additional Line Items */}
            {lineItems.length > 0 && (
              <div className="border rounded-lg p-2 space-y-2 bg-muted/20">
                <p className="text-xs font-semibold">بنود إضافية</p>
                {lineItems.map((li, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1 items-end">
                    <div className="col-span-5 relative">
                      <Input
                        value={li.searchTerm || li.product_name}
                        onChange={e => {
                          const v = e.target.value;
                          setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, searchTerm: v, product_name: v, product_id: '', showDropdown: !!v.trim() } : item));
                        }}
                        onFocus={() => setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, showDropdown: !!(item.searchTerm || item.product_name).trim() } : item))}
                        onBlur={() => setTimeout(() => setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, showDropdown: false } : item)), 200)}
                        placeholder="المنتج..."
                        className="h-7 text-xs"
                      />
                      {li.showDropdown && (() => {
                        const term = (li.searchTerm || '').trim();
                        const matches = term.length >= 1
                          ? products.filter(p => productMatchesInvoiceSearch(p, term)).slice(0, 6)
                          : products.slice(0, 6);
                        return matches.length > 0 ? (
                          <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-32 overflow-y-auto">
                            {matches.map(p => (
                              <button key={p.id} type="button" className="w-full text-right p-1.5 hover:bg-accent/50 text-xs border-b last:border-0"
                                onClick={() => setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, product_id: p.id, product_name: p.name, searchTerm: p.name, unit_price: String(p.price || item.unit_price), showDropdown: false } : item))}
                              >{p.name} (مخزون: {p.stock})</button>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min={1} value={li.quantity} onChange={e => setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: e.target.value } : item))} placeholder="الكمية" className="h-7 text-xs" dir="ltr" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" value={li.unit_price} onChange={e => setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, unit_price: e.target.value } : item))} placeholder="السعر" className="h-7 text-xs" dir="ltr" />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}>
                        <span className="text-xs">✕</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" className="gap-1 text-xs w-full" onClick={() => setLineItems(prev => [...prev, { product_id: '', product_name: '', quantity: '1', unit_price: '0', searchTerm: '', showDropdown: false }])}>
              <Plus className="h-3 w-3" /> إضافة بند جديد
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">سعر وحدة المنتج (السطر الأول) *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="h-8 text-sm" dir="ltr" />
                <p className="text-[10px] text-muted-foreground mt-0.5">المجموع قبل الخصم = (الكمية × السعر) + البنود الإضافية</p>
              </div>
              <div>
                <Label className="text-xs">المدفوع</Label>
                <Input type="number" value={form.paid} onChange={e => setForm(p => ({ ...p, paid: e.target.value }))} className="h-8 text-sm" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">خصم %</Label>
                <Input type="number" min={0} max={100} value={form.discount_percent} onChange={e => setForm(p => ({ ...p, discount_percent: e.target.value }))} className="h-8 text-sm" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">خصم مبلغ</Label>
                <Input type="number" min={0} value={form.discount_amount} onChange={e => setForm(p => ({ ...p, discount_amount: e.target.value }))} className="h-8 text-sm" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">ضريبة %</Label>
                <Input type="number" min={0} value={form.tax_percent} onChange={e => setForm(p => ({ ...p, tax_percent: e.target.value }))} className="h-8 text-sm" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">ضريبة مبلغ</Label>
                <Input type="number" min={0} value={form.tax_amount} onChange={e => setForm(p => ({ ...p, tax_amount: e.target.value }))} className="h-8 text-sm" dir="ltr" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="auto_stock" checked={form.auto_stock_deduct === '1'} onChange={e => setForm(p => ({ ...p, auto_stock_deduct: e.target.checked ? '1' : '0' }))} />
              <Label htmlFor="auto_stock" className="text-xs">خصم الكمية من المخزون تلقائياً عند الحفظ</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">نوع الفاتورة (وارد / منصرف / مبيعات)</Label>
                <Select value={(form as any).invoice_direction || 'مبيعات'} onValueChange={v => setForm(p => ({ ...p, invoice_direction: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="مبيعات">مبيعات</SelectItem>
                    <SelectItem value="وارد">وارد</SelectItem>
                    <SelectItem value="منصرف">منصرف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">تاريخ الاستحقاق (للحسابات — آجل)</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">حالة التسليم (للحسابات — تم التسليم)</Label>
                <Select value={form.delivery_status} onValueChange={v => setForm(p => ({ ...p, delivery_status: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">معلق</SelectItem>
                    <SelectItem value="delivered">تم التسليم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات الفاتورة..." className="min-h-[60px] text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">المندوب / المندوبون (أكثر من مندوب: افصل بفاصلة)</Label>
                <Input
                  value={form.rep_names_text || form.rep_name}
                  onChange={e => setForm(p => ({ ...p, rep_names_text: e.target.value, rep_name: e.target.value }))}
                  placeholder="مثال: أحمد، محمد، خالد"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">الفني</Label>
                <Input
                  value={form.technician}
                  onChange={e => setForm(p => ({ ...p, technician: e.target.value }))}
                  placeholder="اسم الفني"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Remaining calculation preview */}
            {form.amount && (() => {
              const sub = computeSubtotalBeforeTax(form, lineItems);
              const dP = Number(form.discount_percent) || 0;
              const dA = Number(form.discount_amount) || 0;
              const discount = dA > 0 ? dA : sub * dP / 100;
              const afterD = sub - discount;
              const tP = Number(form.tax_percent) || 0;
              const tA = Number(form.tax_amount) || 0;
              const tax = tA > 0 ? tA : afterD * tP / 100;
              const total = Math.round((afterD + tax) * 100) / 100;
              const paid = Number(form.paid) || 0;
              const debt = invoiceDebtRemaining(total, paid);
              const credit = invoiceCustomerCredit(total, paid);
              return (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between"><span>المجموع:</span><span>{formatEGP(sub)}</span></div>
                  {(discount > 0) && <div className="flex justify-between text-destructive"><span>− خصم:</span><span>{formatEGP(discount)}</span></div>}
                  {(tax > 0) && <div className="flex justify-between text-green-600"><span>+ ضريبة:</span><span>{formatEGP(tax)}</span></div>}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>الإجمالي:</span><span>{formatEGP(total)}</span></div>
                  <div className="flex justify-between"><span>المدفوع:</span><span className="text-secondary font-bold">{formatEGP(paid)}</span></div>
                  <div className="flex justify-between border-t pt-1">
                    <span>{credit > 0 ? 'رصيد للعميل (بالموجب):' : 'المتبقي على العميل:'}</span>
                    <span className={`font-bold ${credit > 0 ? 'text-emerald-700' : 'text-destructive'}`}>{formatEGP(credit > 0 ? credit : debt)}</span>
                  </div>
                </div>
              );
            })()}

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
