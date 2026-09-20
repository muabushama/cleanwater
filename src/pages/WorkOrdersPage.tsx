import { motion } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { workOrders as demoWorkOrders, formatEGP, companyInfo } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Eye, Printer, X, Truck, Edit, Search, Trash2 } from 'lucide-react';
import logo from '@/assets/logo.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { WorkOrderAddDialog, type CustomerForSuggest } from '@/components/WorkOrderAddDialog';
import { joinWorkOrderPhoneFields, splitWorkOrderPhoneFields, workOrderPhonesForPrint } from '@/lib/workOrderPrintPhones';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDateDayMonthYear } from '@/lib/dateDisplay';
import { promptDeletePassword } from '@/lib/deletePassword';
import { matchesAnyLooseSearch } from '@/lib/searchText';
import { computeWarrantyStatus, findCustomerDevice, resolveWorkOrderWarranty, type WarrantyDeviceHint } from '@/lib/warrantyStatus';

interface WorkOrder {
  id: string;
  order_code: string;
  customer_code?: string;
  customer_id_num?: number;
  customer_name: string;
  address: string;
  location_url?: string;
  phone: string;
  region?: string;
  product_name: string;
  install_date?: string;
  warranty_until?: string;
  warranty_status?: string;
  visit_date: string;
  visit_time?: string;
  technician?: string;
  notes?: string;
  items: { description: string; value: number }[];
  transport_cost: number;
  total: number;
  previous_visits: { date: string; details: string }[];
  status: string;
  branch: string;
  assigned_rep?: string;
  delivery_status?: string;
}

const formatDateDisplay = (v: any) => formatDateDayMonthYear(v);

const ensureHttpUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const escapeHtml = (s: string) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const printAssetUrl = (asset: string) => {
  const u = String(asset || '');
  if (!u) return u;
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  if (u.startsWith('/')) return `${window.location.origin}${u}`;
  return u;
};

const openExternalLink = (url: string) => {
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!newWindow || newWindow.closed) {
    try {
      if (window.self !== window.top && window.top) {
        window.top.location.href = url;
        return;
      }
    } catch { /* cross-origin */ }
    window.location.href = url;
  }
};

type ProductLine = { product_id?: string; product_name: string; quantity: number; unit_price: number; line_total: number };

const parseProductLinesFromValues = (values: Record<string, string>): ProductLine[] => {
  try {
    const parsed = JSON.parse(String(values.product_lines || '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => {
        const quantity = Math.max(1, Number(x.quantity) || 1);
        const unitPrice = Math.max(0, Number(x.unit_price) || 0);
        const name = String(x.product_name || '').trim();
        if (!name) return null;
        return {
          product_id: x.product_id ? String(x.product_id) : undefined,
          product_name: name,
          quantity,
          unit_price: unitPrice,
          line_total: quantity * unitPrice,
        };
      })
      .filter(Boolean) as ProductLine[];
  } catch {
    return [];
  }
};

const buildWorkOrderItemsFromLines = (lines: ProductLine[]) =>
  lines.map((ln) => ({ description: `المنتج: ${ln.product_name} × ${ln.quantity}`, value: ln.line_total }));

const extractProductLinesFromItems = (items?: { description: string; value: number }[]): ProductLine[] =>
  (Array.isArray(items) ? items : [])
    .map((it) => {
      const d = String(it.description || '').trim();
      const m = d.match(/^المنتج:\s*(.*?)\s*×\s*([0-9]+)$/);
      if (!m) return null;
      const qty = Math.max(1, Number(m[2]) || 1);
      const total = Math.max(0, Number(it.value) || 0);
      return {
        product_name: String(m[1] || '').trim(),
        quantity: qty,
        unit_price: qty > 0 ? total / qty : total,
        line_total: total,
      };
    })
    .filter(Boolean) as ProductLine[];

const productLineSignature = (ln: ProductLine) =>
  `${ln.product_id || ''}|${ln.product_name}|${ln.quantity}|${ln.unit_price}|${ln.line_total}`;

const productLinesUnchanged = (a: ProductLine[], b: ProductLine[]) => {
  if (a.length !== b.length) return false;
  const sigA = a.map(productLineSignature).sort().join(';;');
  const sigB = b.map(productLineSignature).sort().join(';;');
  return sigA === sigB;
};

const computeWorkOrderTotal = (wo: WorkOrder) => {
  const saved = Number(wo.total) || 0;
  if (saved > 0) return saved;
  const transport = Number(wo.transport_cost) || 0;
  const itemsSum = (Array.isArray(wo.items) ? wo.items : []).reduce((s, i) => s + (Number(i.value) || 0), 0);
  return transport + itemsSum;
};

const extractProductNameFromItemDescription = (description?: string): string => {
  const d = String(description || '').trim();
  const m = d.match(/^المنتج:\s*(.*?)\s*×\s*([0-9]+)$/);
  return m ? String(m[1] || '').trim() : '';
};

function WorkOrderDetail({
  wo,
  onClose,
  customers,
  devices,
}: {
  wo: WorkOrder;
  onClose: () => void;
  customers: CustomerForSuggest[];
  devices: WarrantyDeviceHint[];
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const computedTotal = computeWorkOrderTotal(wo);
  const displayPhones = workOrderPhonesForPrint(
    { phone: wo.phone, customer_name: wo.customer_name },
    customers.map((c) => ({ name: c.name, phone1: c.phone1, phone2: c.phone2, whatsapp: c.whatsapp })),
  );
  const matchedCustomer = customers.find((c) => c.name === wo.customer_name || c.customer_code === wo.customer_code);
  const warrantyLabel = resolveWorkOrderWarranty(wo, devices, matchedCustomer?.id);
  const orderCodeLabel = wo.customer_code || wo.order_code || '-';
  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) {
      window.print();
      return;
    }
    const logoSrc = printAssetUrl(typeof logo === 'string' ? logo : String(logo));
    const tableRows = (Array.isArray(wo.items) ? wo.items : [])
      .map(
        (item) =>
          `<tr><td class="c1">${escapeHtml(item.description || '-')}</td><td class="c2">${escapeHtml(formatEGP(Number(item.value) || 0))}</td></tr>`,
      )
      .join('');
    const transportCost = Number(wo.transport_cost) || 0;
    const sheet = `
      <div class="work-form">
        <div class="head">
          <div class="logo-wrap">
            <img src="${escapeHtml(logoSrc)}" alt="logo" />
            <div class="small">
              <div class="brand">كلين ووتر</div>
              <div>لتكنولوجيا معالجة مياه الشرب</div>
              <div>خدمة العملاء: ${escapeHtml(companyInfo.customerService.join(' - '))}</div>
            </div>
          </div>
          <div class="title-wrap">
            <div class="title">أمر شغل</div>
            <div class="code">كود العميل: ${escapeHtml(orderCodeLabel)}</div>
          </div>
        </div>
        <table class="meta"><tbody>
          <tr><td><b>اسم العميل:</b> ${escapeHtml(wo.customer_name || '-')}</td><td class="phone-cell" dir="ltr"><b>التليفون:</b> ${escapeHtml(displayPhones)}</td><td><b>التاريخ:</b> ${escapeHtml(formatDateDisplay(wo.visit_date))}</td></tr>
          <tr><td><b>العنوان:</b> ${escapeHtml(wo.address || '-')}</td><td><b>المنطقة:</b> ${escapeHtml(wo.region || '-')}</td><td><b>الفني:</b> ${escapeHtml(wo.technician || '-')}</td></tr>
          <tr><td><b>المنتج:</b> ${escapeHtml(wo.product_name || '-')}</td><td><b>حالة الضمان:</b> ${escapeHtml(warrantyLabel)}</td><td><b>لينك الموقع:</b> ${escapeHtml(wo.location_url || '-')}</td></tr>
        </tbody></table>
        <table class="items"><thead><tr><th>البيان</th><th>القيمة</th></tr></thead><tbody>
          ${tableRows}
          ${transportCost > 0 ? `<tr><td class="c1"><b>مواصلات</b></td><td class="c2">${escapeHtml(formatEGP(transportCost))}</td></tr>` : ''}
          <tr><td class="c1"><b>الإجمالي</b></td><td class="c2"><b>${escapeHtml(formatEGP(computedTotal))}</b></td></tr>
        </tbody></table>
        <div class="notes"><b>ملاحظات:</b> ${escapeHtml(wo.notes || '-')}</div>
        <div class="signs">
          <div><p>خدمة العملاء</p><span>التوقيع</span></div>
          <div><p>توقيع العميل</p><span>التوقيع</span></div>
          <div><p>توقيع الفني</p><span>التوقيع</span></div>
        </div>
        <div class="foot">
          <p>${escapeHtml(companyInfo.branches.join(' | '))}</p>
          <p>خدمة العملاء: ${escapeHtml(companyInfo.customerService.join(' - '))}</p>
          <p>الخط الساخن: ${escapeHtml(companyInfo.hotline)} | إدارة الفنيين: ${escapeHtml(companyInfo.techManagement)}</p>
        </div>
      </div>`;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><title>أمر شغل ${escapeHtml(orderCodeLabel)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        * { box-sizing: border-box; font-family: Cairo, Tahoma, sans-serif; }
        body { margin: 0; padding: 6px; color: #000; font-weight: 600; font-size: 15px; }
        .wo-copy { height: calc(50vh - 7mm); overflow: hidden; display: flex; align-items: flex-start; justify-content: center; }
        .work-form { width: 100%; border: 2px solid #000; padding: 10px; transform: scale(0.92); transform-origin: top center; }
        .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
        .logo-wrap { display:flex; align-items:center; gap:12px; }
        .logo-wrap img { width: 88px; height: 88px; border: 2px solid #000; padding: 3px; object-fit: contain; }
        .small { font-size: 14px; line-height: 1.5; font-weight: 700; color: #000; }
        .brand { font-size: 20px; font-weight: 900; line-height: 1.15; color: #000; }
        .title-wrap { text-align:center; }
        .title { border:2px solid #000; padding:4px 24px; font-size:26px; font-weight:900; color: #000; }
        .code { font-size: 15px; margin-top:4px; font-weight: 800; color: #000; }
        table { width:100%; border-collapse:collapse; font-size: 15px; font-weight: 700; color: #000; }
        .meta td, .items td, .items th { border:1px solid #000; padding:6px 10px; }
        .meta .phone-cell { font-size: 16px; font-weight: 800; letter-spacing: 0.02em; unicode-bidi: plaintext; white-space: normal; word-break: break-word; }
        .items th { font-weight:700; text-align:right; }
        .items .c2 { width:120px; text-align:center; }
        .notes { border:1px solid #000; margin-top:5px; padding:6px 10px; font-size: 14px; min-height:28px; }
        .signs { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; text-align:center; margin-top:8px; font-size:13px; }
        .signs p { margin:0 0 22px; font-weight:600; }
        .signs span { display:block; border-top:1px dashed #000; padding-top:3px; }
        .foot { border-top:1px solid #000; margin-top:6px; padding-top:4px; text-align:center; font-size:11px; line-height:1.45; }
        .copy-separator { border: none; border-top: 2px dashed #999; margin: 6px 0; }
        @media print { @page { margin: 8mm; } body { padding: 0; } .wo-copy { page-break-inside: avoid; } }
      </style></head><body>
      <div class="wo-copy">${sheet}</div>
      <hr class="copy-separator" />
      <div class="wo-copy">${sheet}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  return (
    <div className="max-w-4xl mx-auto bg-card print:shadow-none" dir="rtl">
      <div ref={printRef} className="print-area">
      <div className="work-form border-2 border-black p-2 bg-white text-black">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Clean Water" className="h-24 w-24 shrink-0 object-contain border-2 border-black p-1" />
          <div className="text-xs leading-5">
            <div className="font-bold text-lg leading-tight">كلين ووتر</div>
            <div>لتكنولوجيا معالجة مياه الشرب</div>
            <div>خدمة العملاء: {companyInfo.customerService.join(' - ')}</div>
          </div>
        </div>
        <div className="text-center">
          <div className="border-2 border-black px-6 py-1 text-lg font-bold">أمر شغل</div>
          <div className="text-[10px] mt-1">كود العميل: {orderCodeLabel}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="print:hidden shrink-0"><X className="h-4 w-4" /></Button>
      </div>

      <div className="border border-black text-sm mb-2">
        <div className="grid grid-cols-3">
          <div className="p-1.5 border-l border-black"><span className="font-semibold">اسم العميل:</span> {wo.customer_name}</div>
          <div className="p-1.5 border-l border-black" dir="ltr"><span className="font-bold">التليفون:</span> <span className="font-extrabold text-black tracking-wide">{displayPhones}</span></div>
          <div className="p-1.5"><span className="font-semibold">التاريخ:</span> {formatDateDisplay(wo.visit_date)}</div>
        </div>
        <div className="grid grid-cols-3 border-t border-black">
          <div className="p-1.5 border-l border-black"><span className="font-semibold">العنوان:</span> {wo.address || '-'}</div>
          <div className="p-1.5 border-l border-black"><span className="font-semibold">المنطقة:</span> {wo.region || '-'}</div>
          <div className="p-1.5"><span className="font-semibold">الفني:</span> {wo.technician || '-'}</div>
        </div>
        <div className="grid grid-cols-3 border-t border-black">
          <div className="p-1.5 border-l border-black"><span className="font-semibold">المنتج:</span> {wo.product_name || '-'}</div>
          <div className="p-1.5 border-l border-black"><span className="font-semibold">حالة الضمان:</span> {warrantyLabel}</div>
          <div className="p-1.5"><span className="font-semibold">لينك الموقع:</span> {wo.location_url || '-'}</div>
        </div>
      </div>

      <table className="w-full text-sm border border-black mb-2">
        <thead>
          <tr>
            <th className="border border-black p-1.5 text-right font-semibold">البيان</th>
            <th className="border border-black p-1.5 text-center font-semibold w-28">القيمة</th>
          </tr>
        </thead>
        <tbody>
          {wo.items.map((item, i) => (
            <tr key={i}>
              <td className="border border-black p-1.5">{item.description}</td>
              <td className="border border-black p-1.5 text-center font-medium">{formatEGP(Number(item.value) || 0)}</td>
            </tr>
          ))}
          {(Number(wo.transport_cost) || 0) > 0 && (
            <tr><td className="border border-black p-1.5 font-semibold">مواصلات</td><td className="border border-black p-1.5 text-center">{formatEGP(Number(wo.transport_cost) || 0)}</td></tr>
          )}
          <tr><td className="border border-black p-1.5 font-bold">الإجمالي</td><td className="border border-black p-1.5 text-center font-bold">{formatEGP(computedTotal)}</td></tr>
        </tbody>
      </table>

      <div className="border border-black text-[13px] mb-2 p-1.5">
        <span className="font-semibold">ملاحظات:</span> {wo.notes || '-'}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[11px] mt-3">
        <div><p className="font-semibold mb-7">خدمة العملاء</p><div className="border-t border-dashed border-black pt-1">التوقيع</div></div>
        <div><p className="font-semibold mb-7">توقيع العميل</p><div className="border-t border-dashed border-black pt-1">التوقيع</div></div>
        <div><p className="font-semibold mb-7">توقيع الفني</p><div className="border-t border-dashed border-black pt-1">التوقيع</div></div>
      </div>

      <div className="mt-2 pt-2 border-t border-black text-[9px] text-center space-y-1">
        <p>{companyInfo.branches.join(' | ')}</p>
        <p>خدمة العملاء: {companyInfo.customerService.join(' - ')}</p>
        <p>الخط الساخن: {companyInfo.hotline} | إدارة الفنيين: {companyInfo.techManagement}</p>
      </div>
      </div>

      <div className="mt-4 flex justify-center print:hidden">
        <Button onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> طباعة (نسختان)</Button>
      </div>
      </div>
    </div>
  );
}

const deliveryStatusLabel = (s?: string) => {
  switch (s) {
    case 'accepted': return 'مقبول';
    case 'in_transit': return 'جاري التوصيل';
    case 'delivered': return 'تم التسليم';
    case 'rejected': return 'مرفوض';
    default: return 'في الانتظار';
  }
};

const getWorkOrderFields = (reps: { id: string; full_name: string }[], currentBranch: string, areas: { id: string; name: string }[] = [], nextOrderCode?: string) => {
  const base = [
  { name: 'order_code', label: 'كود الأمر (تسلسل تلقائي)', required: true, defaultValue: nextOrderCode || '' },
  { name: 'customer_name', label: 'اسم العميل', required: true },
  { name: 'phone', label: 'الهاتف', required: true },
  { name: 'address', label: 'العنوان', required: true },
  { name: 'location_url', label: 'لينك اللوكيشن (Google Maps)' },
  { name: 'region', label: 'المنطقة (نص حر)' },
  ...(areas.length > 0 ? [{ name: 'area_id', label: 'المنطقة (من القائمة)', type: 'select' as const, options: [{ value: 'none', label: 'بدون' }, ...areas.map(a => ({ value: a.id, label: a.name }))], defaultValue: 'none' }] : []),
  { name: 'product_name', label: 'المنتج', required: true },
  { name: 'transport_cost', label: 'تكلفة المواصلات', type: 'number' as const, defaultValue: '0' },
  { name: 'extra_products', label: 'منتجات إضافية (كل منتج في سطر)', type: 'textarea' as const },
  { name: 'assigned_rep', label: 'المندوب المسؤول', type: 'select' as const, options: [
    { value: 'none', label: 'بدون مندوب' },
    ...reps.map(r => ({ value: r.id, label: r.full_name })),
  ], defaultValue: 'none' },
  { name: 'visit_date', label: 'تاريخ الزيارة', type: 'date' as const, required: true },
  { name: 'maintenance_dates', label: 'التواريخ القادمة للصيانة (اختياري - مفصولة بفاصلة، مثال: 2026-04-15, 2026-07-20)', type: 'textarea' as const },
  { name: 'technician', label: 'الفني' },
  { name: 'warranty_status', label: 'الضمان', type: 'select' as const, options: [
    { value: 'ساري', label: 'ساري' },
    { value: 'منتهي', label: 'منتهي' },
  ], defaultValue: 'ساري' },
  { name: 'status', label: 'الحالة', type: 'select' as const, options: [
    { value: 'pending', label: 'معلق' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed', label: 'مكتمل' },
  ], defaultValue: 'pending' },
  { name: 'branch', label: 'الفرع', type: 'select' as const, options: [
    { value: 'فرع الإسكندرية', label: 'فرع الإسكندرية' },
    { value: 'فرع الجيزة', label: 'فرع الجيزة' },
  ], defaultValue: currentBranch },
  { name: 'notes', label: 'ملاحظات', type: 'textarea' as const },
];
  return base;
};

interface WorkOrdersPageProps {
  embedded?: boolean;
  /** عند العرض من محطة: تصفية أوامر العمل لنفس اسم عميل المحطة */
  customerNameFilter?: string;
  /** إذا لم يُربط عميل بالمحطة: لا تعرض أوامر (بدل كل الأوامر) */
  strictEmptyEmbedded?: boolean;
  /** تعبئة مسبقة لنموذج أمر الشغل (مثلاً من بيانات محطة) */
  prefillCustomer?: CustomerForSuggest | null;
}
export default function WorkOrdersPage({ embedded, customerNameFilter, strictEmptyEmbedded, prefillCustomer }: WorkOrdersPageProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingWO, setEditingWO] = useState<WorkOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reps, setReps] = useState<{ id: string; full_name: string }[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<CustomerForSuggest[]>([]);
  const [customerDevices, setCustomerDevices] = useState<WarrantyDeviceHint[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; price?: number; price1: number; price2: number; price3: number; stock?: number; sku_code?: string | null; barcode?: string | null }[]>([]);
  const [initialCustomerForOrder, setInitialCustomerForOrder] = useState<CustomerForSuggest | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const { toast } = useToast();
  const { branch } = useUserBranch();
  const location = useLocation();
  const navigate = useNavigate();

  const fetchWorkOrders = async () => {
    const bv = branchDbValuesForUiBranch(branch);
    const { data } = await supabase.from('work_orders').select('*').in('branch', bv).order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setWorkOrders(data.map((wo: any) => ({
        ...wo,
        items: Array.isArray(wo.items) ? wo.items : [],
        previous_visits: Array.isArray(wo.previous_visits) ? wo.previous_visits : [],
      })) as WorkOrder[]);
    } else {
      setWorkOrders(demoWorkOrders.map(wo => ({
        id: wo.id,
        order_code: wo.orderCode,
        customer_code: wo.customerCode,
        customer_id_num: wo.customerId,
        customer_name: wo.customer,
        address: wo.address,
        phone: wo.phone,
        region: wo.region,
        product_name: wo.product,
        install_date: wo.installDate,
        warranty_until: wo.warrantyUntil,
        warranty_status: wo.warrantyStatus,
        visit_date: wo.visitDate,
        visit_time: wo.visitTime,
        technician: wo.technician,
        notes: wo.notes,
        items: wo.items,
        transport_cost: wo.transportCost,
        total: wo.total,
        previous_visits: wo.previousVisits,
        status: wo.status,
        branch: wo.branch,
      })));
    }
    setLoading(false);
  };

  const fetchReps = async () => {
    const { data: roleData } = await supabase.from('user_roles').select('user_id').eq('role', 'sales_rep');
    if (roleData && roleData.length > 0) {
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      if (profiles) setReps(profiles);
    }
  };

  useEffect(() => {
    setSelectedWO(null);
    fetchWorkOrders();
    fetchReps();
    const bv = branchDbValuesForUiBranch(branch);
    supabase.from('areas').select('id,name').in('branch', bv).then(({ data }) => setAreas(Array.isArray(data) ? data : []));
    supabase
      .from('customers')
      .select('id,name,phone1,phone2,whatsapp,address,region,area_id,customer_code')
      .in('branch', bv)
      .limit(2000)
      .then(({ data }) => setCustomers(Array.isArray(data) ? data : []));
    supabase
      .from('customer_devices')
      .select('customer_id,install_date,warranty_months,warranty_status,customer_code')
      .limit(4000)
      .then(({ data }) => setCustomerDevices(Array.isArray(data) ? (data as WarrantyDeviceHint[]) : []));
    supabase.from('products').select('id,name,price,price1,price2,price3,stock,sku_code,barcode').in('branch', bv).limit(2000).then(({ data }) => setProducts(Array.isArray(data) ? data : []));
  }, [branch]);

  useEffect(() => {
    const c = (location.state as { newOrderForCustomer?: typeof initialCustomerForOrder })?.newOrderForCustomer;
    if (c) {
      setInitialCustomerForOrder(c);
      setAddOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const statusLabel = (s: string) => s === 'completed' ? 'مكتمل' : s === 'in_progress' ? 'قيد التنفيذ' : 'معلق';
  const statusVariant = (s: string) => s === 'completed' ? 'default' as const : s === 'in_progress' ? 'secondary' as const : 'outline' as const;

  const productLinesWithIds = (lines: ProductLine[]) =>
    lines.map((ln) => {
      const productId = ln.product_id || products.find((p) => String(p.name || '').trim() === String(ln.product_name || '').trim())?.id || '';
      return { ...ln, product_id: productId || undefined };
    });

  const currentOrderProductLines = (wo: WorkOrder) =>
    productLinesWithIds(extractProductLinesFromItems(wo.items));

  const applyWorkOrderStock = async (
    lines: ProductLine[],
    direction: 'deduct' | 'restore',
    woBranch: string,
    orderCode: string,
    note: string,
  ) => {
    for (const ln of lines) {
      if (!ln.product_id) continue;
      const prod = products.find((p) => p.id === ln.product_id);
      if (!prod) continue;
      const qty = Math.max(1, Number(ln.quantity) || 1);
      const signedQty = direction === 'deduct' ? qty : -qty;
      const movementPayload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        product_id: prod.id,
        branch: woBranch,
        type: direction === 'deduct' ? 'sale' : 'adjustment',
        quantity: direction === 'deduct' ? qty : qty,
        reference_type: 'work_order',
        reference_id: orderCode || null,
        notes: note,
      };
      await supabase.from('stock_movements').insert(movementPayload as any);
      const nextStock = Math.max(0, (Number((prod as any).stock) || 0) - signedQty);
      await supabase.from('products').update({ stock: nextStock } as any).eq('id', prod.id);
      (prod as any).stock = nextStock;
    }
  };

  const resolveWarrantyForValues = (values: Record<string, string>) => {
    const customer = customers.find((c) => c.name === values.customer_name || c.customer_code === values.order_code);
    const device = findCustomerDevice(customerDevices, {
      id: customer?.id,
      name: values.customer_name,
      customer_code: customer?.customer_code || values.order_code,
    });
    if (device) return computeWarrantyStatus(device);
    const stored = String(values.warranty_status || '').trim();
    if (stored === 'ساري' || stored === 'منتهي') return stored;
    return 'منتهي';
  };

  const assignRep = async (orderId: string, repId: string) => {
    setAssigningId(orderId);
    try {
      const { error } = await supabase.from('work_orders').update({ assigned_rep: repId, delivery_status: 'pending' } as any).eq('id', orderId);
      if (error) throw error;
      toast({ title: 'تم تعيين المندوب بنجاح' });
      fetchWorkOrders();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setAssigningId(null);
    }
  };

  const handleAdd = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const woBranch = canonicalBranchForSave(values.branch || branch);
      const productLines = parseProductLinesFromValues(values);
      const builtItems = buildWorkOrderItemsFromLines(productLines);
      const transportCost = Math.max(0, Number(values.transport_cost) || 0);
      const computedTotal = builtItems.reduce((s, i) => s + (Number(i.value) || 0), 0) + transportCost;
      const firstLine = productLines[0];
      const { phone2, phone3, ...valuesRest } = values as Record<string, string>;
      const phoneJoined = joinWorkOrderPhoneFields(
        String(valuesRest.phone || '').trim(),
        typeof phone2 === 'string' ? phone2 : undefined,
        typeof phone3 === 'string' ? phone3 : undefined,
      );
      const warrantyStatus = resolveWarrantyForValues(values);
      const customerMatch = customers.find((c) => c.name === values.customer_name || c.customer_code === values.order_code);
      const customerCode = String(customerMatch?.customer_code || values.order_code || '').trim();
      const payload: Record<string, unknown> = {
        order_code: customerCode || values.order_code,
        customer_code: customerCode || null,
        customer_name: values.customer_name,
        phone: phoneJoined,
        address: values.address,
        location_url: values.location_url || '',
        region: values.region || '',
        area_id: values.area_id && values.area_id !== 'none' ? values.area_id : null,
        product_name: firstLine?.product_name || values.product_name || '',
        visit_date: values.visit_date,
        technician: values.technician || '',
        warranty_status: warrantyStatus,
        status: values.status || 'pending',
        branch: woBranch,
        notes: values.notes || '',
        items: builtItems,
        transport_cost: transportCost,
        total: computedTotal,
        previous_visits: [],
        created_by: user?.id,
        assigned_rep: values.assigned_rep && values.assigned_rep !== 'none' ? values.assigned_rep : null,
        delivery_status: values.assigned_rep ? 'pending' : 'pending',
        price1: 0,
        price2: 0,
        price3: 0,
      };
      let { error } = await supabase.from('work_orders').insert(payload as any);
      if (error && /customer_code/i.test(error.message || '')) {
        delete payload.customer_code;
        ({ error } = await supabase.from('work_orders').insert(payload as any));
      }
      if (error) throw error;

      if ((values.status || 'pending') === 'completed') {
        await applyWorkOrderStock(
          productLines,
          'deduct',
          woBranch,
          customerCode || values.order_code,
          `أمر شغل مكتمل ${customerCode || values.order_code || ''} - ${values.customer_name || ''}`.trim(),
        );
      }

      const maintenanceDatesRaw = (values.maintenance_dates || '').trim();
      const maintenanceDates = maintenanceDatesRaw
        ? maintenanceDatesRaw.split(/[،,\s]+/).map(d => d.trim()).filter(Boolean)
        : [];
      if (maintenanceDates.length > 0) {
        const firstDate = maintenanceDates[0];
        const { error: maintErr } = await supabase.from('maintenance').insert({
          id: crypto.randomUUID(),
          customer_name: values.customer_name,
          product_name: firstLine?.product_name || values.product_name || '',
          phone: phoneJoined || '',
          type: 'تغيير شمعات',
          next_date: firstDate,
          next_dates: maintenanceDates,
          status: 'upcoming',
          technician: values.technician || '',
          cost: 0,
          branch: woBranch,
          created_by: user?.id,
        } as any);
        if (maintErr) {
          toast({ title: 'تم إضافة أمر العمل', description: 'لم يتم تسجيل تواريخ الصيانة: ' + maintErr.message, variant: 'destructive' });
        } else {
          toast({ title: 'تم إضافة أمر العمل وتسجيل تواريخ الصيانة في الصيانة والزيارات' });
        }
      } else {
        toast({ title: 'تم إضافة أمر العمل بنجاح' });
      }
      setAddOpen(false);
      setInitialCustomerForOrder(null);
      fetchWorkOrders();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (values: Record<string, string>) => {
    if (!editingWO) return;
    setSaving(true);
    try {
      const parsedLines = productLinesWithIds(parseProductLinesFromValues(values));
      const fallbackLines = currentOrderProductLines(editingWO);
      const productLines = parsedLines.length > 0 ? parsedLines : fallbackLines;
      let builtItems = buildWorkOrderItemsFromLines(productLines);
      const transportCost = Math.max(0, Number(values.transport_cost) || 0);
      let computedTotal = builtItems.reduce((s, i) => s + (Number(i.value) || 0), 0) + transportCost;
      if (builtItems.length === 0 && Array.isArray(editingWO.items) && editingWO.items.length > 0) {
        builtItems = editingWO.items;
        computedTotal = Number(editingWO.total) || computedTotal;
      }
      if (computedTotal <= 0 && Number(editingWO.total) > 0) {
        computedTotal = Number(editingWO.total);
      }
      const firstLine = productLines[0];
      const productsChanged = !productLinesUnchanged(productLines, fallbackLines);
      const { phone2, phone3, ...valuesRest } = values as Record<string, string>;
      const phoneJoined = joinWorkOrderPhoneFields(
        String(valuesRest.phone || '').trim(),
        typeof phone2 === 'string' ? phone2 : undefined,
        typeof phone3 === 'string' ? phone3 : undefined,
      );
      const warrantyStatus = resolveWarrantyForValues(values);
      const customerMatch = customers.find((c) => c.name === values.customer_name || c.customer_code === values.order_code);
      const customerCode = String(customerMatch?.customer_code || values.order_code || editingWO.customer_code || '').trim();
      const nextStatus = values.status || 'pending';
      const { error } = await supabase.from('work_orders').update({
        order_code: customerCode || values.order_code,
        customer_code: customerCode || null,
        customer_name: values.customer_name,
        phone: phoneJoined,
        address: values.address,
        location_url: values.location_url || '',
        region: values.region || '',
        area_id: values.area_id && values.area_id !== 'none' ? values.area_id : null,
        product_name: firstLine?.product_name || values.product_name || '',
        visit_date: values.visit_date,
        technician: values.technician || '',
        warranty_status: warrantyStatus,
        status: nextStatus,
        branch: canonicalBranchForSave(values.branch || branch),
        notes: values.notes || '',
        price1: firstLine?.unit_price ?? (Number((editingWO as any).price1) || 0),
        price2: Number((editingWO as any).price2) || 0,
        price3: Number((editingWO as any).price3) || 0,
        items: builtItems,
        transport_cost: transportCost,
        total: computedTotal,
        assigned_rep: values.assigned_rep && values.assigned_rep !== 'none' ? values.assigned_rep : null,
      } as any).eq('id', editingWO.id);
      if (error) throw error;

      const wasCompleted = editingWO.status === 'completed';
      const nowCompleted = nextStatus === 'completed';
      const woBranch = canonicalBranchForSave(values.branch || branch);
      const codeRef = customerCode || values.order_code || editingWO.order_code || '';
      if (!wasCompleted && nowCompleted) {
        await applyWorkOrderStock(productLines, 'deduct', woBranch, codeRef, `اكتمال أمر شغل ${codeRef}`);
      } else if (wasCompleted && !nowCompleted) {
        await applyWorkOrderStock(fallbackLines, 'restore', woBranch, codeRef, `إلغاء اكتمال أمر شغل ${codeRef}`);
      } else if (wasCompleted && nowCompleted && productsChanged) {
        await applyWorkOrderStock(fallbackLines, 'restore', woBranch, codeRef, `تعديل أمر شغل ${codeRef}`);
        await applyWorkOrderStock(productLines, 'deduct', woBranch, codeRef, `تعديل أمر شغل ${codeRef}`);
      }

      toast({ title: 'تم تعديل أمر العمل بنجاح' });
      setEditOpen(false);
      setEditingWO(null);
      setSelectedWO(null);
      fetchWorkOrders();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isDemoItem = (id: string) => id.startsWith('WO-');

  const openEdit = (wo: WorkOrder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isDemoItem(wo.id)) {
      toast({ title: 'بيانات تجريبية', description: 'لا يمكن تعديل البيانات التجريبية', variant: 'destructive' });
      return;
    }
    setEditingWO(wo);
    setEditOpen(true);
  };

  const handleDeleteWorkOrder = async (wo: WorkOrder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isDemoItem(wo.id)) {
      toast({ title: 'بيانات تجريبية', description: 'لا يمكن حذف البيانات التجريبية', variant: 'destructive' });
      return;
    }
    if (!confirm(`حذف أمر العمل "${wo.order_code || wo.customer_name}"؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      if (wo.status === 'completed') {
        await applyWorkOrderStock(
          currentOrderProductLines(wo),
          'restore',
          canonicalBranchForSave(wo.branch || branch),
          wo.order_code || '',
          `حذف أمر شغل مكتمل ${wo.order_code || ''}`,
        );
      }
      const { error } = await supabase.from('work_orders').delete().eq('id', wo.id);
      if (error) throw error;
      toast({ title: 'تم حذف أمر العمل' });
      setSelectedWO(null);
      await fetchWorkOrders();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const editInitialValues = useMemo(() => {
    if (!editingWO) return undefined;
    const extractedLines = currentOrderProductLines(editingWO);
    const phones = splitWorkOrderPhoneFields(editingWO.phone || '');
    return {
      order_code: editingWO.customer_code || editingWO.order_code || '',
      customer_name: editingWO.customer_name || '',
      phone: phones.phone,
      phone2: phones.phone2,
      phone3: phones.phone3,
      address: editingWO.address || '',
      location_url: editingWO.location_url || '',
      region: editingWO.region || '',
      area_id: (editingWO as any).area_id || 'none',
      product_name: editingWO.product_name || '',
      transport_cost: String(editingWO.transport_cost || 0),
      product_lines: JSON.stringify(extractedLines.length > 0 ? extractedLines : [{
        product_name: editingWO.product_name || '',
        quantity: 1,
        unit_price: Number((editingWO as any).price1) || 0,
        line_total: Number((editingWO as any).price1) || 0,
      }]),
      assigned_rep: editingWO.assigned_rep || 'none',
      visit_date: editingWO.visit_date || '',
      technician: editingWO.technician || '',
      warranty_status: resolveWorkOrderWarranty(editingWO, customerDevices),
      status: editingWO.status || 'pending',
      branch: editingWO.branch || branch,
      notes: editingWO.notes || '',
    };
  }, [editingWO, branch, customerDevices]);

  const getRepName = (repId?: string) => {
    if (!repId) return null;
    return reps.find(r => r.id === repId)?.full_name || 'مندوب';
  };

  const displayOrders = useMemo(() => {
    if (embedded && strictEmptyEmbedded) return [];
    const f = (customerNameFilter || '').trim();
    const base = f ? workOrders.filter((w) => (w.customer_name || '').trim() === f) : workOrders;
    const q = searchTerm.trim();
    if (!q) return base;
    return base.filter((w) =>
      matchesAnyLooseSearch(
        [w.order_code, w.customer_code, w.customer_id_num, w.customer_name, w.phone, w.region, w.product_name],
        q,
      ),
    );
  }, [workOrders, customerNameFilter, embedded, strictEmptyEmbedded, searchTerm]);

  const openAddDialog = () => {
    if (prefillCustomer) setInitialCustomerForOrder(prefillCustomer);
    setAddOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">أوامر العمل</h1>
            <p className="text-muted-foreground text-sm">{displayOrders.length} أمر عمل</p>
          </div>
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="h-4 w-4" /> أمر عمل جديد
          </Button>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="h-4 w-4" /> أمر عمل جديد
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 max-w-xl">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث باسم العميل أو رقم الهاتف أو كود العميل / كود الأمر"
          className="h-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : displayOrders.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {embedded && strictEmptyEmbedded ? 'اربط المحطة باسم عميل لعرض أوامر الشغل الخاصة به.' : 'لا توجد أوامر عمل.'}
        </p>
      ) : (
        <div className="space-y-4">
          {displayOrders.map((wo, i) => (
            <motion.div key={wo.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="card-shadow hover:card-shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold">{wo.customer_code || wo.order_code}</h3>
                        <Badge variant={statusVariant(wo.status)}>{statusLabel(wo.status)}</Badge>
                        {wo.order_code?.startsWith('صيانة-') && (
                          <Badge variant="secondary" className="text-[10px]">صيانة</Badge>
                        )}
                        {(() => {
                          const wStatus = resolveWorkOrderWarranty(wo, customerDevices);
                          return (
                            <Badge variant={wStatus === 'ساري' ? 'default' : 'destructive'} className="text-[10px]">
                              ضمان: {wStatus}
                            </Badge>
                          );
                        })()}
                        {wo.assigned_rep && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Truck className="h-3 w-3" />
                            {deliveryStatusLabel(wo.delivery_status)} - {getRepName(wo.assigned_rep)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">العميل: <span className="font-semibold">{wo.customer_name}</span></p>
                      <p className="text-xs text-muted-foreground">{wo.product_name} • {wo.region} • {wo.branch}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>الفني: {wo.technician}</span>
                        <span>الزيارة: {formatDateDisplay(wo.visit_date)}</span>
                        <span>الإجمالي: <strong className="text-secondary">{formatEGP(wo.total)}</strong></span>
                        {(Number(wo.transport_cost) || 0) > 0 && <span>مواصلات: {formatEGP(wo.transport_cost)}</span>}
                        {Array.isArray(wo.items) && wo.items.filter((it) => String(it.description || '').startsWith('المنتج:')).length > 1 && (
                          <span>عدد المنتجات: {wo.items.filter((it) => String(it.description || '').startsWith('المنتج:')).length}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedWO(wo)}>
                        <Eye className="h-4 w-4" /> عرض
                      </Button>
                      {!isDemoItem(wo.id) && (
                        <>
                          <Button variant="outline" size="sm" className="gap-2" onClick={(e) => openEdit(wo, e)}>
                            <Edit className="h-4 w-4" /> تعديل
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30" onClick={(e) => handleDeleteWorkOrder(wo, e)}>
                            <Trash2 className="h-4 w-4" /> حذف
                          </Button>
                        </>
                      )}
                      {!wo.assigned_rep && reps.length > 0 && (
                        <Select onValueChange={(repId) => assignRep(wo.id, repId)} disabled={assigningId === wo.id}>
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="تعيين مندوب" />
                          </SelectTrigger>
                          <SelectContent>
                            {reps.map(rep => (
                              <SelectItem key={rep.id} value={rep.id}>{rep.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedWO} onOpenChange={(open) => !open && setSelectedWO(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>أمر شغل {selectedWO?.order_code}</DialogTitle></DialogHeader>
          {selectedWO && (
            <div className="space-y-3">
              {!isDemoItem(selectedWO.id) && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(selectedWO)}>
                    <Edit className="h-4 w-4" /> تعديل أمر العمل
                  </Button>
                </div>
              )}
              <WorkOrderDetail wo={selectedWO} onClose={() => setSelectedWO(null)} customers={customers} devices={customerDevices} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <WorkOrderAddDialog
        open={addOpen}
        onOpenChange={(open) => { setAddOpen(open); if (!open) setInitialCustomerForOrder(null); }}
        reps={reps}
        branch={branch}
        areas={areas}
        customers={customers}
        products={products}
        customerDevices={customerDevices}
        initialCustomer={initialCustomerForOrder}
        onSubmit={handleAdd}
        onProductCreated={(p) => setProducts((prev) => [p, ...prev.filter((x) => x.id !== p.id)])}
        loading={saving}
      />
      <WorkOrderAddDialog
        open={editOpen}
        onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingWO(null); }}
        reps={reps}
        branch={branch}
        areas={areas}
        customers={customers}
        products={products}
        customerDevices={customerDevices}
        initialValues={editInitialValues}
        title="تعديل أمر العمل"
        submitLabel="تعديل"
        onSubmit={handleEdit}
        onProductCreated={(p) => setProducts((prev) => [p, ...prev.filter((x) => x.id !== p.id)])}
        loading={saving}
      />
    </motion.div>
  );
}
