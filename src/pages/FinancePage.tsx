import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch } from '@/lib/branchFilters';
import { formatEGP } from '@/data/demo-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, FileText, AlertTriangle, FileStack, Plus, Search, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { invoiceCustomerCredit, invoiceDebtRemaining } from '@/lib/invoiceBalance';

const formatDateDisplay = (v: any) => {
  const s = String(v || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

/** فواتير المبيعات فقط (تُستبعد وارد/منصرف من أرصدة العملاء والمبيعات) */
const invoiceDirection = (i: any) => (String(i?.invoice_direction ?? 'مبيعات').trim() || 'مبيعات');
const isSalesInvoice = (i: any) => invoiceDirection(i) === 'مبيعات';

const EXPENSE_CATEGORIES = ['عام', 'شراء بضاعة', 'إيجار', 'رواتب', 'مرافق', 'نقل', 'صيانة', 'مخزون', 'أخرى'];

export default function FinancePage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [receiptVouchers, setReceiptVouchers] = useState<any[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [stationMaintenanceRows, setStationMaintenanceRows] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [financeDirection, setFinanceDirection] = useState<'داخلة' | 'خارجة'>('داخلة');
  const [financeCategory, setFinanceCategory] = useState<'عملاء' | 'مشتريات' | 'مخزون' | 'مصروفات' | 'بدون ربط'>('عملاء');
  const [financeSaving, setFinanceSaving] = useState(false);
  const [financeForm, setFinanceForm] = useState({
    customer_name: '', product_name: '', product_id: '', amount: '', paid: '0', notes: '',
    payee_name: '', expense_category: 'عام', expense_number: '', expense_date: new Date().toISOString().split('T')[0],
    supplier_name: '', purchase_quantity: '1', purchase_unit_price: '', purchase_total: '', purchase_date: new Date().toISOString().split('T')[0],
    generic_amount: '', generic_description: '', generic_date: new Date().toISOString().split('T')[0],
  });
  const [financeCustSearch, setFinanceCustSearch] = useState('');
  const [showFinanceCustDrop, setShowFinanceCustDrop] = useState(false);
  const [financeProdSearch, setFinanceProdSearch] = useState('');
  const [showFinanceProdDrop, setShowFinanceProdDrop] = useState(false);
  const [financePayeeSearch, setFinancePayeeSearch] = useState('');
  const [showFinancePayeeDrop, setShowFinancePayeeDrop] = useState(false);
  const [financeSupplierSearch, setFinanceSupplierSearch] = useState('');
  const [showFinanceSupplierDrop, setShowFinanceSupplierDrop] = useState(false);
  const [financePurchaseProdSearch, setFinancePurchaseProdSearch] = useState('');
  const [showFinancePurchaseProdDrop, setShowFinancePurchaseProdDrop] = useState(false);
  const { branch } = useUserBranch();
  const { toast } = useToast();

  const fetchAll = async () => {
    const db = supabase as any;
    const bv = branchDbValuesForUiBranch(branch);
    const [invR, maintR, devR, instR, prodR, woR, expR, purR, custR, vouchR, payVouchR, retR, stMaintR, movR] = await Promise.all([
      supabase.from('invoices').select('*').in('branch', bv),
      supabase.from('maintenance').select('*').in('branch', bv),
      db.from('customer_devices').select('*').in('branch', bv),
      db.from('installments').select('*'),
      supabase.from('products').select('*').in('branch', bv).limit(500),
      supabase.from('work_orders').select('*').in('branch', bv),
      supabase.from('expenses').select('*').in('branch', bv).then(r => r).catch(() => ({ data: [] })),
      supabase.from('purchases').select('*').in('branch', bv).then(r => r).catch(() => ({ data: [] })),
      supabase.from('customers').select('id, name, phone1, address, customer_code').in('branch', bv).order('name'),
      supabase.from('receipt_vouchers').select('*').in('branch', bv).then(r => r).catch(() => ({ data: [] })),
      supabase.from('payment_vouchers').select('*').in('branch', bv).then(r => r).catch(() => ({ data: [] })),
      supabase.from('returns').select('*').in('branch', bv).then(r => r).catch(() => ({ data: [] })),
      supabase.from('station_maintenance').select('collected,branch').in('branch', bv).then(r => r).catch(() => ({ data: [] })),
      supabase.from('stock_movements').select('*').in('branch', bv).limit(8000).then(r => r).catch(() => ({ data: [] })),
    ]);
    setInvoices(invR.data || []);
    setMaintenance(maintR.data || []);
    setDevices(devR.data || []);
    setInstallments(instR.data || []);
    setProducts(prodR.data || []);
    setWorkOrders(woR.data || []);
    setExpenses(expR?.data || []);
    setPurchases(purR?.data || []);
    setCustomers(custR?.data || []);
    setReceiptVouchers(Array.isArray(vouchR?.data) ? vouchR.data : []);
    setPaymentVouchers(Array.isArray(payVouchR?.data) ? payVouchR.data : []);
    setReturnsList(Array.isArray(retR?.data) ? retR.data : []);
    setStationMaintenanceRows(Array.isArray(stMaintR?.data) ? stMaintR.data : []);
    setStockMovements(Array.isArray(movR?.data) ? movR.data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [branch]);

  const filteredFinanceCusts = useMemo(() => {
    const t = financeCustSearch.trim().toLowerCase();
    if (!t) return [];
    return customers
      .filter(
        (c: any) =>
          (c.name || '').toLowerCase().includes(t) ||
          (c.phone1 || '').includes(financeCustSearch.trim()) ||
          String(c.customer_code || '')
            .toLowerCase()
            .includes(t),
      )
      .slice(0, 15);
  }, [customers, financeCustSearch]);
  const filteredFinanceProds = useMemo(() => {
    const t = financeProdSearch.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p: any) => {
      const n = (p.name || '').toLowerCase();
      const sku = String(p.sku_code || '').toLowerCase();
      const bc = String(p.barcode || '').toLowerCase();
      return n.includes(t) || sku.includes(t) || bc.includes(t);
    }).slice(0, 15);
  }, [products, financeProdSearch]);
  const uniquePayees = useMemo(() => {
    const set = new Set<string>();
    (expenses || []).forEach((e: any) => { if ((e.payee_name || '').trim()) set.add((e.payee_name || '').trim()); });
    return Array.from(set).sort();
  }, [expenses]);
  const filteredFinancePayees = useMemo(() => {
    const t = financePayeeSearch.trim().toLowerCase();
    if (!t) return uniquePayees.slice(0, 15);
    return uniquePayees.filter(s => s.toLowerCase().includes(t)).slice(0, 15);
  }, [uniquePayees, financePayeeSearch]);
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    (purchases || []).forEach((p: any) => { if ((p.supplier_name || '').trim()) set.add((p.supplier_name || '').trim()); });
    return Array.from(set).sort();
  }, [purchases]);
  const filteredFinanceSuppliers = useMemo(() => {
    const t = financeSupplierSearch.trim().toLowerCase();
    if (!t) return uniqueSuppliers.slice(0, 15);
    return uniqueSuppliers.filter(s => s.toLowerCase().includes(t)).slice(0, 15);
  }, [uniqueSuppliers, financeSupplierSearch]);
  const filteredFinancePurchaseProds = useMemo(() => {
    const t = financePurchaseProdSearch.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p: any) => {
      const n = (p.name || '').toLowerCase();
      const sku = String(p.sku_code || '').toLowerCase();
      const bc = String(p.barcode || '').toLowerCase();
      return n.includes(t) || sku.includes(t) || bc.includes(t);
    }).slice(0, 15);
  }, [products, financePurchaseProdSearch]);

  const customerIdsInBranch = useMemo(() => new Set((customers || []).map((c: any) => c.id)), [customers]);
  const installmentsScoped = useMemo(() => {
    const list = Array.isArray(installments) ? installments : [];
    if (list.length === 0) return list;
    const filtered = list.filter((i: any) => customerIdsInBranch.has(i.customer_id));
    return filtered.length > 0 ? filtered : list;
  }, [installments, customerIdsInBranch]);

  const finance = useMemo(() => {
    const activeInv = invoices.filter((i) => i.status !== 'deleted');
    const salesInvoices = activeInv.filter(isSalesInvoice);

    const totalSales = salesInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalPaid = salesInvoices.reduce((s, i) => s + (Number(i.paid) || 0), 0);

    const receiptVouchersList = Array.isArray(receiptVouchers) ? receiptVouchers : [];
    const totalReceiptVouchersAll = receiptVouchersList.reduce((s: number, v: any) => s + (Number(v.amount) || 0), 0);
    const receiptVouchersStandalone = receiptVouchersList.filter((v: any) =>
      !v.invoice_id && !String(v.notes || '').includes('تحصيل قسط عقد محطة'),
    );
    const totalReceiptStandalone = receiptVouchersStandalone.reduce((s: number, v: any) => s + (Number(v.amount) || 0), 0);
    const totalCollectedCash = totalPaid + totalReceiptStandalone;

    const prodById = new Map((products || []).map((p: any) => [p.id, p]));
    let stockMovementValueEstimate = 0;
    (stockMovements || []).forEach((m: any) => {
      const p = prodById.get(m.product_id);
      const q = Math.abs(Number(m.quantity) || 0);
      const unit = Number((p as any)?.cost ?? (p as any)?.price ?? 0) || 0;
      stockMovementValueEstimate += q * unit;
    });
    const totalRemaining = salesInvoices.reduce((s, i) => s + invoiceDebtRemaining(i.amount, i.paid), 0);
    const totalCustomerCredit = salesInvoices.reduce((s, i) => s + invoiceCustomerCredit(i.amount, i.paid), 0);

    // تكلفة البضاعة: فواتير مبيعات فقط × الكمية × تكلفة الصنف (تقريب)
    const costOfGoods = salesInvoices.reduce((s, inv) => {
      const product = products.find((p) => p.name === inv.product_name);
      const q = Math.max(1, Number((inv as any).quantity) || 1);
      const unitCost = product ? Number(product.cost) || 0 : 0;
      return s + q * unitCost;
    }, 0);

    const stationMaintVisitCollected = (stationMaintenanceRows || []).reduce((s: number, r: any) => s + (Number(r.collected) || 0), 0);
    const stationMaintCollected = stationMaintVisitCollected;
    const maintenanceRevenue =
      maintenance.reduce((s, m) => s + (Number((m as any).cost) || 0), 0) + stationMaintCollected;

    const instList = installmentsScoped;
    const totalInstallments = instList.reduce((s, i) => s + (Number((i as any).amount) || 0), 0);
    const paidInstallments = instList.filter((i) => i.status === 'مدفوع').reduce((s, i) => s + (Number((i as any).amount) || 0), 0);
    const pendingInstallments = totalInstallments - paidInstallments;
    const overdueInstallments = instList.filter((i) => i.status === 'معلق' && new Date((i as any).installment_date) < new Date());

    const totalDeviceValue = devices.reduce((s: number, d: any) => s + (Number(d.total_price) || 0), 0);

    const grossProfit = totalSales - costOfGoods;

    const branchFinance: Record<string, { sales: number; paid: number; remaining: number; invoices: number }> = {};
    salesInvoices.forEach((inv) => {
      const b = inv.branch || 'غير محدد';
      if (!branchFinance[b]) branchFinance[b] = { sales: 0, paid: 0, remaining: 0, invoices: 0 };
      branchFinance[b].sales += Number(inv.amount) || 0;
      branchFinance[b].paid += Number(inv.paid) || 0;
      branchFinance[b].remaining += invoiceDebtRemaining(inv.amount, inv.paid);
      branchFinance[b].invoices++;
    });

    const cashSales = salesInvoices.filter((i) => i.type === 'cash').reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const installmentSales = salesInvoices.filter((i) => i.type === 'installment').reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const unpaidInvoices = salesInvoices
      .filter((i) => i.status !== 'paid')
      .sort((a, b) => invoiceDebtRemaining(b.amount, b.paid) - invoiceDebtRemaining(a.amount, a.paid));

    const incomingInvoices = salesInvoices;
    const incomingValue = totalSales + totalReceiptStandalone;

    const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    const totalPurchasesSum = (purchases || []).reduce((s: number, p: any) => s + (Number(p.total) || 0), 0);
    const totalPaymentVouchers = (paymentVouchers || []).reduce((s: number, v: any) => s + (Number(v.amount) || 0), 0);

    const invoiceDisbursementSum = activeInv
      .filter((i) => invoiceDirection(i) === 'منصرف')
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const invoiceInboundSum = activeInv
      .filter((i) => invoiceDirection(i) === 'وارد')
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);

    // المشتريات لا تدخل في المنصرف المالي — تُدار من قسم الموردين فقط
    const outgoingValue = totalExpenses + totalPaymentVouchers + invoiceDisbursementSum + invoiceInboundSum;

    const remainingValue = totalRemaining;
    const overdueInvoices = salesInvoices.filter((i) => i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date());
    const overdueValue = overdueInvoices.reduce((s, i) => s + invoiceDebtRemaining(i.amount, i.paid), 0);
    const overdueInstallmentsValue = overdueInstallments.reduce((s, i) => s + (Number((i as any).amount) || 0), 0);
    const disbursedValue = totalCollectedCash;
    const pendingInvoicesList = salesInvoices.filter((i) => i.status === 'pending' || i.status === 'partial');
    const pendingValue = pendingInvoicesList.reduce((s, i) => s + invoiceDebtRemaining(i.amount, i.paid), 0);
    const deliveredOrders = (workOrders as any[]).filter(
      (wo: any) => (wo.delivery_status || '').toLowerCase() === 'delivered' || (wo.delivery_status || '').toLowerCase() === 'تم التسليم',
    );
    const deliveredInvoices = salesInvoices.filter(
      (i: any) => (i.delivery_status || '').toLowerCase() === 'delivered' || (i.delivery_status || '').toLowerCase() === 'تم التسليم',
    );

    const totalCustomerReturns = (returnsList || [])
      .filter((r: any) => (r.return_type || 'customer') === 'customer')
      .reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    const netSalesAfterReturns = Math.max(0, totalSales - totalCustomerReturns);

    const workOrdersRevenueTotal = (workOrders as any[]).reduce((s, wo) => s + (Number(wo.total) || 0), 0);

    return {
      totalSales,
      totalPaid,
      totalRemaining,
      totalCustomerCredit,
      costOfGoods,
      grossProfit,
      maintenanceRevenue,
      stationMaintCollected,
      totalInstallments,
      paidInstallments,
      pendingInstallments,
      overdueInstallments,
      totalDeviceValue,
      branchFinance: Object.entries(branchFinance).map(([b, d]) => ({ branch: b, ...d })),
      cashSales,
      installmentSales,
      unpaidInvoices,
      incomingValue,
      outgoingValue,
      remainingValue,
      overdueValue,
      overdueInstallmentsValue,
      overdueInvoices,
      disbursedValue,
      pendingInvoicesList,
      pendingValue,
      deliveredOrders,
      deliveredInvoices,
      incomingInvoices,
      totalReceiptVouchersAll,
      totalReceiptStandalone,
      totalCollectedCash,
      stockMovementValueEstimate,
      totalPaymentVouchers,
      invoiceDisbursementSum,
      invoiceInboundSum,
      totalCustomerReturns,
      netSalesAfterReturns,
      workOrdersRevenueTotal,
    };
  }, [
    invoices,
    maintenance,
    devices,
    installmentsScoped,
    products,
    workOrders,
    expenses,
    purchases,
    receiptVouchers,
    paymentVouchers,
    returnsList,
    stationMaintenanceRows,
    stockMovements,
  ]);

  const navigate = useNavigate();

  const handleSaveFinanceEntry = async () => {
    const br = branch || 'فرع الإسكندرية';
    setFinanceSaving(true);
    try {
      if (financeDirection === 'داخلة') {
        if (financeCategory === 'عملاء') {
          const amount = Number(financeForm.amount) || 0;
          const paid = Number(financeForm.paid) || 0;
          const remaining = invoiceDebtRemaining(amount, paid);
          const status = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
          await supabase.from('invoices').insert({
            id: crypto.randomUUID(),
            invoice_number: `INV-${Date.now().toString().slice(-6)}`,
            customer_name: (financeForm.customer_name || '').trim() || 'عميل',
            product_name: (financeForm.product_name || '').trim() || 'منتج',
            amount, paid, remaining, status, type: 'cash', branch: br,
            date: financeForm.expense_date,
            invoice_direction: 'مبيعات',
          });
          toast({ title: 'تم إضافة فاتورة المبيعات', description: 'ستظهر في الفواتير والمالية' });
        } else {
          await supabase.from('receipt_vouchers').insert({
            id: crypto.randomUUID(),
            voucher_number: `RCV-${Date.now().toString().slice(-6)}`,
            voucher_date: financeForm.generic_date,
            amount: Number(financeForm.generic_amount) || 0,
            customer_name: (financeForm.generic_description || '').trim() || 'إيراد عام',
            payment_method: 'cash', branch: br, notes: financeForm.generic_description || null,
          });
          toast({ title: 'تم إضافة سند قبض (إيراد)', description: 'ستظهر في سندات القبض والمالية' });
        }
      } else {
        if (financeCategory === 'مصروفات') {
          await supabase.from('expenses').insert({
            id: crypto.randomUUID(),
            expense_number: (financeForm.expense_number || '').trim() || `EXP-${Date.now().toString().slice(-6)}`,
            category: financeForm.expense_category,
            payee_name: (financeForm.payee_name || '').trim() || 'مستفيد',
            amount: Number(financeForm.amount) || 0,
            expense_date: financeForm.expense_date,
            branch: br,
            notes: (financeForm.notes || '').trim() || null,
          });
          toast({ title: 'تم إضافة المصروف', description: 'ستظهر في المصروفات والمالية' });
        } else if (financeCategory === 'مشتريات') {
          const productId = financeForm.product_id || null;
          const product = products.find(p => p.id === productId);
          const qty = Math.max(1, Number(financeForm.purchase_quantity) || 1);
          const total = Number(financeForm.purchase_total) || Number(financeForm.purchase_unit_price) * qty || 0;
          const id = crypto.randomUUID();
          await supabase.from('purchases').insert({
            id,
            purchase_number: `PUR-${Date.now().toString().slice(-6)}`,
            supplier_name: (financeForm.supplier_name || '').trim() || 'مورد',
            product_id: productId,
            product_name: (financeForm.product_name || '').trim() || product?.name || 'منتج',
            quantity: qty,
            unit_price: Number(financeForm.purchase_unit_price) || 0,
            total,
            purchase_date: financeForm.purchase_date,
            branch: br,
            notes: (financeForm.notes || '').trim() || null,
          });
          if (productId && product) {
            await supabase.from('stock_movements').insert({
              id: crypto.randomUUID(),
              product_id: productId,
              branch: br,
              type: 'purchase',
              quantity: qty,
              reference_type: 'purchase',
              reference_id: id,
              notes: 'مشتريات من المالية',
            });
            const newStock = (Number(product.stock) || 0) + qty;
            await supabase.from('products').update({ stock: newStock }).eq('id', productId);
          }
          toast({ title: 'تم إضافة المشتريات', description: 'ستظهر في المشتريات والمخزون والمالية' });
        } else if (financeCategory === 'مخزون' || financeCategory === 'بدون ربط') {
          const category = financeCategory === 'مخزون' ? 'مخزون' : 'عام';
          await supabase.from('expenses').insert({
            id: crypto.randomUUID(),
            expense_number: `EXP-${Date.now().toString().slice(-6)}`,
            category,
            payee_name: (financeForm.generic_description || financeForm.payee_name || '').trim() || (financeCategory === 'مخزون' ? 'تكلفة مخزون' : 'حركة مالية'),
            amount: Number(financeForm.generic_amount || financeForm.amount) || 0,
            expense_date: financeForm.generic_date || financeForm.expense_date,
            branch: br,
            notes: (financeForm.notes || '').trim() || null,
          });
          toast({ title: financeCategory === 'مخزون' ? 'تم إضافة تكلفة مخزون' : 'تم إضافة حركة خارجة', description: 'ستظهر في المصروفات والمالية' });
        }
      }
      setAddDialogOpen(false);
      setFinanceForm({
        customer_name: '', product_name: '', product_id: '', amount: '', paid: '0', notes: '',
        payee_name: '', expense_category: 'عام', expense_number: '', expense_date: new Date().toISOString().split('T')[0],
        supplier_name: '', purchase_quantity: '1', purchase_unit_price: '', purchase_total: '', purchase_date: new Date().toISOString().split('T')[0],
        generic_amount: '', generic_description: '', generic_date: new Date().toISOString().split('T')[0],
      });
      fetchAll();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setFinanceSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">جاري التحميل...</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">المالية</h1>
        <div className="flex gap-2 flex-wrap">
          <Button className="gap-2" onClick={() => { setAddDialogOpen(true); setFinanceDirection('داخلة'); setFinanceCategory('عملاء'); }}>
            <Plus className="h-4 w-4" /> فاتورة داخلة
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setAddDialogOpen(true); setFinanceDirection('خارجة'); setFinanceCategory('مصروفات'); }}>
            <Plus className="h-4 w-4" /> فاتورة خارجة
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/invoices')}>
            <FileStack className="h-4 w-4" /> الفواتير
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/expenses')}>
            <TrendingDown className="h-4 w-4" /> المصروفات
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/receipt-vouchers')}>
            <FileText className="h-4 w-4" /> سندات القبض
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/returns')}>
            <TrendingDown className="h-4 w-4" /> المرتجعات
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        تُحسب المبيعات والمديونية من فواتير نوعها «مبيعات» فقط. فواتير «وارد / منصرف» تُحسب ضمن المنصرفات مع المصروفات وسندات الصرف. المشتريات تُدار من قسم الموردين ولا تدخل في المنصرف المالي. تُجمع أيضاً: المرتجعات (عملاء)، سندات القبض، سندات الصرف، وصيانة العملاء وزيارات المحطات. أقساط عقود المحطات منفصلة ولا تدخل في الإيراد.
      </p>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { icon: DollarSign, label: 'إجمالي مبيعات (فواتير مبيعات)', value: formatEGP(finance.totalSales), color: 'gradient-card-blue' },
          { icon: TrendingDown, label: 'مرتجعات عملاء', value: formatEGP(finance.totalCustomerReturns), color: 'bg-rose-800 border-0' },
          { icon: DollarSign, label: 'صافي المبيعات بعد المرتجعات', value: formatEGP(finance.netSalesAfterReturns), color: 'bg-blue-900 border-0' },
          { icon: TrendingUp, label: 'المحصل (مبيعات + سندات بدون فاتورة)', value: formatEGP(finance.totalCollectedCash), color: 'gradient-card-success' },
          { icon: FileText, label: 'سندات قبض إضافية', value: formatEGP(finance.totalReceiptStandalone), color: 'bg-slate-700 border-0' },
          { icon: FileText, label: 'سندات صرف', value: formatEGP(finance.totalPaymentVouchers), color: 'bg-orange-900 border-0' },
          { icon: TrendingDown, label: 'متبقي على العملاء', value: formatEGP(finance.totalRemaining), color: 'gradient-card-warning' },
          { icon: DollarSign, label: 'رصيد عملاء (+)', value: formatEGP(finance.totalCustomerCredit), color: 'bg-emerald-700 border-0' },
          { icon: CreditCard, label: 'أقساط معلقة', value: formatEGP(finance.pendingInstallments), color: 'gradient-card-warning' },
          { icon: FileText, label: 'إيرادات صيانة + محطات', value: formatEGP(finance.maintenanceRevenue), color: 'gradient-card-teal' },
          { icon: TrendingUp, label: 'مجمل الربح (مبيعات − تكلفة)', value: formatEGP(finance.grossProfit), color: 'gradient-card-success' },
          { icon: ClipboardList, label: 'إجمالي أوامر عمل (مرجعي)', value: formatEGP(finance.workOrdersRevenueTotal), color: 'bg-cyan-900 border-0' },
          { icon: AlertTriangle, label: 'قيمة حركة مخزون (تقديري)', value: formatEGP(finance.stockMovementValueEstimate), color: 'bg-zinc-700 border-0' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={`${s.color} text-primary-foreground`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1 opacity-90"><s.icon className="h-3.5 w-3.5" /><span className="text-[10px]">{s.label}</span></div>
                <p className="text-base font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="summary" className="text-xs">الملخص</TabsTrigger>
          <TabsTrigger value="scenarios" className="text-xs">السيناريوهات</TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">المديونيات</TabsTrigger>
          <TabsTrigger value="installments" className="text-xs">الأقساط</TabsTrigger>
          <TabsTrigger value="branches" className="text-xs">الفروع</TabsTrigger>
        </TabsList>

        {/* سيناريوهات الحسابات: داخلة، خارجة، متبقي، آجل، منصرف، معلق، تم التسليم */}
        <TabsContent value="scenarios" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">فواتير داخلة</p>
                <p className="text-lg font-bold">{formatEGP(finance.incomingValue)}</p>
                <p className="text-[10px] opacity-80">{finance.incomingInvoices.length} فاتورة</p>
              </CardContent>
            </Card>
            <Card className="bg-muted border cursor-pointer hover:border-primary/50" onClick={() => navigate('/expenses')}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">فواتير خارجة / مصروفات</p>
                <p className="text-lg font-bold">{formatEGP(finance.outgoingValue)}</p>
                <p className="text-[10px] opacity-80">اضغط للتفاصيل</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">متبقي</p>
                <p className="text-lg font-bold text-amber-700">{formatEGP(finance.remainingValue)}</p>
                <p className="text-[10px] opacity-80">إجمالي المتبقي</p>
              </CardContent>
            </Card>
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">آجل</p>
                <p className="text-lg font-bold text-destructive">{formatEGP(finance.overdueValue + finance.overdueInstallmentsValue)}</p>
                <p className="text-[10px] opacity-80">{finance.overdueInvoices.length + finance.overdueInstallments.length} فاتورة/قسط</p>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">منصرف</p>
                <p className="text-lg font-bold text-green-700">{formatEGP(finance.disbursedValue)}</p>
                <p className="text-[10px] opacity-80">المحصل</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/10 border-orange-500/30">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">معلق</p>
                <p className="text-lg font-bold text-orange-700">{formatEGP(finance.pendingValue)}</p>
                <p className="text-[10px] opacity-80">{finance.pendingInvoicesList.length} فاتورة</p>
              </CardContent>
            </Card>
            <Card className="bg-teal-500/10 border-teal-500/30">
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground mb-1">تم التسليم</p>
                <p className="text-lg font-bold text-teal-700">{finance.deliveredOrders.length + finance.deliveredInvoices.length}</p>
                <p className="text-[10px] opacity-80">أمر عمل + فاتورة</p>
              </CardContent>
            </Card>
          </div>
          <Card className="card-shadow">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">تفاصيل السيناريوهات (من الفواتير والحسابات)</CardTitle>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate('/invoices')}>الفواتير</Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">فواتير داخلة (إيرادات)</h4>
                <p className="text-muted-foreground">
                  مبيعات مسجلة: {formatEGP(finance.totalSales)} — سندات قبض بدون فاتورة: {formatEGP(finance.totalReceiptStandalone)} — إجمالي المعروض: {formatEGP(finance.incomingValue)} — عدد فواتير المبيعات: {finance.incomingInvoices.length}
                </p>
                <p className="text-muted-foreground text-xs mt-1">مرتجعات عملاء: {formatEGP(finance.totalCustomerReturns)} — صافي المبيعات: {formatEGP(finance.netSalesAfterReturns)}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">معلق</h4>
                <p className="text-muted-foreground">إجمالي المتبقي على الفواتير المعلقة: {formatEGP(finance.pendingValue)} — عدد: {finance.pendingInvoicesList.length}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">آجل (متأخر)</h4>
                <p className="text-muted-foreground">فواتير متأخرة: {formatEGP(finance.overdueValue)} — أقساط متأخرة: {formatEGP(finance.overdueInstallmentsValue)}</p>
                {finance.overdueInvoices.length > 0 && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs border rounded">
                      <thead><tr className="bg-muted/50"><th className="p-2 text-right">رقم الفاتورة</th><th className="p-2 text-right">العميل</th><th className="p-2 text-right">المتبقي</th><th className="p-2 text-right">استحقاق</th></tr></thead>
                      <tbody>
                        {finance.overdueInvoices.slice(0, 10).map((inv: any) => (
                          <tr key={inv.id} className="border-t"><td className="p-2">{inv.invoice_number}</td><td className="p-2">{inv.customer_name}</td><td className="p-2 font-bold text-destructive">{formatEGP(invoiceDebtRemaining(inv.amount, inv.paid))}</td><td className="p-2">{formatDateDisplay(inv.due_date) || '-'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {finance.overdueInvoices.length > 10 && <p className="text-muted-foreground mt-1">+ {finance.overdueInvoices.length - 10} أخرى</p>}
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-medium mb-2">تم التسليم</h4>
                <p className="text-muted-foreground">أوامر عمل: {finance.deliveredOrders.length} — فواتير تم تسليمها: {finance.deliveredInvoices.length}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <Card className="card-shadow mb-4">
            <CardHeader><CardTitle className="text-sm">قائمة الدخل (ملخص)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between p-2.5 bg-primary/5 rounded font-bold">
                <span>إجمالي الإيرادات (صافي مبيعات + صيانة)</span>
                <span>{formatEGP(finance.netSalesAfterReturns + finance.maintenanceRevenue)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded text-xs text-muted-foreground">
                <span>↳ صافي مبيعات بعد مرتجعات العملاء</span><span>{formatEGP(finance.netSalesAfterReturns)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded text-xs text-muted-foreground">
                <span>↳ صيانة (عملاء + محطات محصّلة)</span><span>{formatEGP(finance.maintenanceRevenue)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">− إجمالي المنصرف (مصروفات + سندات صرف + فواتير وارد/منصرف)</span>
                <span className="text-destructive">{formatEGP(finance.outgoingValue)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-secondary/10 rounded font-bold border-t">
                <span>صافي الدخل (تقديري)</span>
                <span className="text-secondary">{formatEGP(finance.netSalesAfterReturns + finance.maintenanceRevenue - finance.outgoingValue)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardHeader><CardTitle className="text-sm">ملخص الحساب التفصيلي</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between p-2.5 bg-primary/5 rounded font-bold">
                <span>إجمالي المبيعات (فواتير مبيعات)</span><span>{formatEGP(finance.totalSales)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded text-xs">
                <span className="text-muted-foreground">− مرتجعات عملاء</span><span className="text-rose-700">{formatEGP(finance.totalCustomerReturns)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded font-medium">
                <span>صافي المبيعات</span><span>{formatEGP(finance.netSalesAfterReturns)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">↳ مبيعات نقدية</span><span>{formatEGP(finance.cashSales)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">↳ مبيعات تقسيط</span><span>{formatEGP(finance.installmentSales)}</span>
              </div>
              <div className="border-t my-1" />
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">- تكلفة البضاعة (تقديرية، كمية × تكلفة)</span><span>{formatEGP(finance.costOfGoods)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-secondary/10 rounded font-bold">
                <span>مجمل الربح</span><span className="text-secondary">{formatEGP(finance.grossProfit)}</span>
              </div>
              <div className="border-t my-1" />
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">+ إيرادات الصيانة والمحطات</span><span>{formatEGP(finance.maintenanceRevenue)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded text-xs text-muted-foreground">
                <span>↳ تحصيل زيارات صيانة المحطات</span><span>{formatEGP(finance.stationMaintCollected)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded text-xs text-muted-foreground">
                <span>إجمالي مسجل أوامر عمل (مرجعي — قد يتداخل مع الفواتير)</span><span>{formatEGP(finance.workOrdersRevenueTotal)}</span>
              </div>
              <div className="border-t my-1" />
              <div className="flex justify-between p-2.5 rounded">
                <span>إجمالي المحصل (فواتير + سندات بدون فاتورة)</span><span className="font-bold text-secondary">{formatEGP(finance.totalCollectedCash)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-destructive/5 rounded">
                <span>متبقي على العملاء (بدون سالب)</span><span className="font-bold text-destructive">{formatEGP(finance.totalRemaining)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-emerald-500/10 rounded">
                <span>رصيد للعملاء (دفعات زائدة — بالموجب)</span><span className="font-bold text-emerald-800">{formatEGP(finance.totalCustomerCredit)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">إجمالي قيمة الأجهزة المباعة</span><span className="font-bold">{formatEGP(finance.totalDeviceValue)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unpaid Invoices */}
        <TabsContent value="invoices">
          <Card className="card-shadow">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> فواتير غير مسددة ({finance.unpaidInvoices.length})</CardTitle></CardHeader>
            <CardContent>
              {finance.unpaidInvoices.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">لا توجد فواتير معلقة 🎉</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50">
                      <th className="p-2 text-right">رقم الفاتورة</th>
                      <th className="p-2 text-right">العميل</th>
                      <th className="p-2 text-right">المنتج</th>
                      <th className="p-2 text-right">الإجمالي</th>
                      <th className="p-2 text-right">المدفوع</th>
                      <th className="p-2 text-right">المتبقي</th>
                      <th className="p-2 text-right">الفرع</th>
                      <th className="p-2 text-right">الحالة</th>
                    </tr></thead>
                    <tbody>
                      {finance.unpaidInvoices.map(inv => (
                        <tr key={inv.id} className="border-b hover:bg-muted/30">
                          <td className="p-2 font-medium">{inv.invoice_number}</td>
                          <td className="p-2">{inv.customer_name}</td>
                          <td className="p-2">{inv.product_name}</td>
                          <td className="p-2">{formatEGP(inv.amount)}</td>
                          <td className="p-2 text-secondary">{formatEGP(inv.paid)}</td>
                          <td className="p-2 font-bold text-destructive">{formatEGP(invoiceDebtRemaining(inv.amount, inv.paid))}</td>
                          <td className="p-2">{inv.branch}</td>
                          <td className="p-2">
                            <Badge variant={inv.status === 'partial' ? 'secondary' : 'outline'} className="text-[9px]">
                              {inv.status === 'partial' ? 'جزئي' : 'معلقة'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-destructive/5 font-bold">
                        <td colSpan={3} className="p-2">الإجمالي</td>
                        <td className="p-2">{formatEGP(finance.unpaidInvoices.reduce((s, i) => s + i.amount, 0))}</td>
                        <td className="p-2 text-secondary">{formatEGP(finance.unpaidInvoices.reduce((s, i) => s + i.paid, 0))}</td>
                        <td className="p-2 text-destructive">{formatEGP(finance.unpaidInvoices.reduce((s, i) => s + invoiceDebtRemaining(i.amount, i.paid), 0))}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Installments */}
        <TabsContent value="installments">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> الأقساط</span>
                <div className="flex gap-2 text-xs font-normal">
                  <Badge variant="default">{installmentsScoped.filter(i => i.status === 'مدفوع').length} مدفوع</Badge>
                  <Badge variant="outline">{installmentsScoped.filter(i => i.status === 'معلق').length} معلق</Badge>
                  {finance.overdueInstallments.length > 0 && <Badge variant="destructive">{finance.overdueInstallments.length} متأخر</Badge>}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {installmentsScoped.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">لا توجد أقساط</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50">
                      <th className="p-2 text-right">#</th>
                      <th className="p-2 text-right">تاريخ القسط</th>
                      <th className="p-2 text-right">المبلغ</th>
                      <th className="p-2 text-right">تاريخ التحصيل</th>
                      <th className="p-2 text-right">الحالة</th>
                    </tr></thead>
                    <tbody>
                      {installmentsScoped.map((inst, i) => {
                        const isOverdue = inst.status === 'معلق' && new Date(inst.installment_date) < new Date();
                        return (
                          <tr key={inst.id} className={`border-b hover:bg-muted/30 ${isOverdue ? 'bg-destructive/5' : ''}`}>
                            <td className="p-2">{i + 1}</td>
                            <td className="p-2">{formatDateDisplay(inst.installment_date)}</td>
                            <td className="p-2 font-bold">{formatEGP(inst.amount)}</td>
                            <td className="p-2">{inst.collection_date ? formatDateDisplay(inst.collection_date) : '-'}</td>
                            <td className="p-2">
                              <Badge variant={inst.status === 'مدفوع' ? 'default' : isOverdue ? 'destructive' : 'outline'} className="text-[9px]">
                                {isOverdue ? 'متأخر' : inst.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-bold">
                        <td colSpan={2} className="p-2">الإجمالي</td>
                        <td className="p-2">{formatEGP(finance.totalInstallments)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branches */}
        <TabsContent value="branches">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {finance.branchFinance.map((b, i) => (
              <motion.div key={b.branch} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <Card className="card-shadow">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between">
                    <span>{b.branch}</span><Badge variant="outline">{b.invoices} فاتورة</Badge>
                  </CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-primary/5 rounded">
                      <span>المبيعات</span><span className="font-bold">{formatEGP(b.sales)}</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span className="text-muted-foreground">المحصل</span><span className="font-bold text-secondary">{formatEGP(b.paid)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-destructive/5 rounded">
                      <span className="text-muted-foreground">المتبقي</span><span className="font-bold text-destructive">{formatEGP(b.remaining)}</span>
                    </div>
                    {b.sales > 0 && (
                      <div className="flex justify-between p-2 text-xs text-muted-foreground">
                        <span>نسبة التحصيل</span>
                        <span className="font-bold">{((b.paid / b.sales) * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {finance.branchFinance.length === 0 && (
              <p className="text-muted-foreground text-center py-4 col-span-2">لا توجد بيانات مالية</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* إضافة حركة مالية: فاتورة داخلة / خارجة */}
      <Dialog open={addDialogOpen} onOpenChange={open => { setAddDialogOpen(open); if (!open) { setFinanceCustSearch(''); setFinanceProdSearch(''); setFinancePayeeSearch(''); setFinanceSupplierSearch(''); setFinancePurchaseProdSearch(''); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة {financeDirection === 'داخلة' ? 'فاتورة داخلة (إيراد)' : 'فاتورة خارجة (منصرف)'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الاتجاه</Label>
                <Select value={financeDirection} onValueChange={v => setFinanceDirection(v as 'داخلة' | 'خارجة')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="داخلة">فاتورة داخلة (إيراد)</SelectItem>
                    <SelectItem value="خارجة">فاتورة خارجة (منصرف)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>نوع الربط</Label>
                <Select value={financeCategory} onValueChange={v => setFinanceCategory(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {financeDirection === 'داخلة' && (
                      <>
                        <SelectItem value="عملاء">عملاء (فواتير مبيعات)</SelectItem>
                        <SelectItem value="بدون ربط">بدون ربط (إيراد عام)</SelectItem>
                      </>
                    )}
                    {financeDirection === 'خارجة' && (
                      <>
                        <SelectItem value="مصروفات">مصروفات</SelectItem>
                        <SelectItem value="مشتريات">مشتريات</SelectItem>
                        <SelectItem value="مخزون">مخزون</SelectItem>
                        <SelectItem value="بدون ربط">بدون ربط</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* داخلة + عملاء */}
            {financeDirection === 'داخلة' && financeCategory === 'عملاء' && (
              <>
                <div className="relative">
                  <Label>اسم العميل *</Label>
                  <div className="relative">
                    <Input
                      value={financeCustSearch || financeForm.customer_name}
                      onChange={e => { setFinanceCustSearch(e.target.value); setShowFinanceCustDrop(true); setFinanceForm(f => ({ ...f, customer_name: e.target.value })); }}
                      onFocus={() => setShowFinanceCustDrop(!!(financeCustSearch || financeForm.customer_name).trim())}
                      onBlur={() => setTimeout(() => setShowFinanceCustDrop(false), 200)}
                      placeholder="ابحث عن العميل أو اكتب الاسم..."
                      className="pr-9"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {showFinanceCustDrop && filteredFinanceCusts.length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
                      {filteredFinanceCusts.map((c: any) => (
                        <button key={c.id} type="button" className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0" onClick={() => { setFinanceForm(f => ({ ...f, customer_name: c.name })); setFinanceCustSearch(c.name); setShowFinanceCustDrop(false); }}>
                          <p className="font-medium">{c.name}</p>
                          {(c.phone1 || c.address) && <p className="text-muted-foreground">{[c.phone1, c.address].filter(Boolean).join(' • ')}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <Label>المنتج / البيان</Label>
                  <div className="relative">
                    <Input
                      value={financeProdSearch || financeForm.product_name}
                      onChange={e => { setFinanceProdSearch(e.target.value); setShowFinanceProdDrop(!!e.target.value.trim()); setFinanceForm(f => ({ ...f, product_name: e.target.value })); }}
                      onFocus={() => setShowFinanceProdDrop(!!(financeProdSearch || financeForm.product_name).trim())}
                      onBlur={() => setTimeout(() => setShowFinanceProdDrop(false), 200)}
                      placeholder="ابحث عن منتج أو اكتب البيان..."
                      className="pr-9"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {showFinanceProdDrop && filteredFinanceProds.length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      {filteredFinanceProds.map((p: any) => (
                        <button key={p.id} type="button" className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0 flex justify-between" onClick={() => { setFinanceForm(f => ({ ...f, product_name: p.name, product_id: p.id })); setFinanceProdSearch(p.name); setShowFinanceProdDrop(false); }}>
                          <span className="font-medium">{p.name}</span>
                          {p.price != null && <span className="text-muted-foreground">{formatEGP(p.price)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>المبلغ *</Label><Input type="number" value={financeForm.amount} onChange={e => setFinanceForm(f => ({ ...f, amount: e.target.value }))} dir="ltr" /></div>
                  <div><Label>المدفوع</Label><Input type="number" value={financeForm.paid} onChange={e => setFinanceForm(f => ({ ...f, paid: e.target.value }))} dir="ltr" /></div>
                </div>
                <div><Label>التاريخ</Label><Input type="date" value={financeForm.expense_date} onChange={e => setFinanceForm(f => ({ ...f, expense_date: e.target.value }))} /></div>
                <div><Label>ملاحظات</Label><Textarea value={financeForm.notes} onChange={e => setFinanceForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري" rows={2} /></div>
              </>
            )}

            {/* داخلة + بدون ربط */}
            {financeDirection === 'داخلة' && financeCategory === 'بدون ربط' && (
              <>
                <div><Label>المبلغ *</Label><Input type="number" value={financeForm.generic_amount} onChange={e => setFinanceForm(f => ({ ...f, generic_amount: e.target.value }))} dir="ltr" /></div>
                <div><Label>البيان (إيراد عام)</Label><Input value={financeForm.generic_description} onChange={e => setFinanceForm(f => ({ ...f, generic_description: e.target.value }))} placeholder="وصف الإيراد" /></div>
                <div><Label>التاريخ</Label><Input type="date" value={financeForm.generic_date} onChange={e => setFinanceForm(f => ({ ...f, generic_date: e.target.value }))} /></div>
              </>
            )}

            {/* خارجة + مصروفات */}
            {financeDirection === 'خارجة' && financeCategory === 'مصروفات' && (
              <>
                <div><Label>رقم السند</Label><Input value={financeForm.expense_number} onChange={e => setFinanceForm(f => ({ ...f, expense_number: e.target.value }))} placeholder="EXP-000001" /></div>
                <div className="relative">
                  <Label>المستفيد *</Label>
                  <div className="relative">
                    <Input
                      value={financePayeeSearch || financeForm.payee_name}
                      onChange={e => { setFinancePayeeSearch(e.target.value); setShowFinancePayeeDrop(true); setFinanceForm(f => ({ ...f, payee_name: e.target.value })); }}
                      onFocus={() => setShowFinancePayeeDrop(!!(financePayeeSearch || financeForm.payee_name).trim())}
                      onBlur={() => setTimeout(() => setShowFinancePayeeDrop(false), 200)}
                      placeholder="ابحث عن مستفيد أو اكتب الاسم..."
                      className="pr-9"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {showFinancePayeeDrop && filteredFinancePayees.length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
                      {filteredFinancePayees.map(s => (
                        <button key={s} type="button" className="w-full text-right p-2 hover:bg-accent/50 text-xs font-medium" onClick={() => { setFinanceForm(f => ({ ...f, payee_name: s })); setFinancePayeeSearch(s); setShowFinancePayeeDrop(false); }}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div><Label>التصنيف</Label>
                  <Select value={financeForm.expense_category} onValueChange={v => setFinanceForm(f => ({ ...f, expense_category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>المبلغ *</Label><Input type="number" value={financeForm.amount} onChange={e => setFinanceForm(f => ({ ...f, amount: e.target.value }))} dir="ltr" /></div>
                <div><Label>التاريخ</Label><Input type="date" value={financeForm.expense_date} onChange={e => setFinanceForm(f => ({ ...f, expense_date: e.target.value }))} /></div>
                <div><Label>ملاحظات</Label><Textarea value={financeForm.notes} onChange={e => setFinanceForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري" rows={2} /></div>
              </>
            )}

            {/* خارجة + مشتريات */}
            {financeDirection === 'خارجة' && financeCategory === 'مشتريات' && (
              <>
                <div className="relative">
                  <Label>المورد *</Label>
                  <div className="relative">
                    <Input
                      value={financeSupplierSearch || financeForm.supplier_name}
                      onChange={e => { setFinanceSupplierSearch(e.target.value); setShowFinanceSupplierDrop(true); setFinanceForm(f => ({ ...f, supplier_name: e.target.value })); }}
                      onFocus={() => setShowFinanceSupplierDrop(!!(financeSupplierSearch || financeForm.supplier_name).trim())}
                      onBlur={() => setTimeout(() => setShowFinanceSupplierDrop(false), 200)}
                      placeholder="ابحث عن مورد أو اكتب الاسم..."
                      className="pr-9"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {showFinanceSupplierDrop && filteredFinanceSuppliers.length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
                      {filteredFinanceSuppliers.map(s => (
                        <button key={s} type="button" className="w-full text-right p-2 hover:bg-accent/50 text-xs font-medium" onClick={() => { setFinanceForm(f => ({ ...f, supplier_name: s })); setFinanceSupplierSearch(s); setShowFinanceSupplierDrop(false); }}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <Label>المنتج</Label>
                  <div className="relative">
                    <Input
                      value={financePurchaseProdSearch || financeForm.product_name}
                      onChange={e => { const v = e.target.value; setFinancePurchaseProdSearch(v); setShowFinancePurchaseProdDrop(!!v.trim()); setFinanceForm(f => ({ ...f, product_name: v, product_id: '' })); }}
                      onFocus={() => setShowFinancePurchaseProdDrop(!!(financePurchaseProdSearch || financeForm.product_name).trim())}
                      onBlur={() => setTimeout(() => setShowFinancePurchaseProdDrop(false), 200)}
                      placeholder="ابحث عن منتج أو اكتب الاسم..."
                      className="pr-9"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {showFinancePurchaseProdDrop && filteredFinancePurchaseProds.length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      {filteredFinancePurchaseProds.map((p: any) => {
                        const cost = Number(p.cost) || 0;
                        const q = Number(financeForm.purchase_quantity) || 1;
                        return (
                          <button key={p.id} type="button" className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0 flex justify-between items-center" onClick={() => { setFinanceForm(f => ({ ...f, product_id: p.id, product_name: p.name, purchase_unit_price: String(cost), purchase_total: String(cost * q) })); setFinancePurchaseProdSearch(p.name); setShowFinancePurchaseProdDrop(false); }}>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground">تكلفة: {formatEGP(cost)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>الكمية</Label><Input type="number" min={1} value={financeForm.purchase_quantity} onChange={e => { const q = Number(e.target.value) || 1; const u = Number(financeForm.purchase_unit_price) || 0; setFinanceForm(f => ({ ...f, purchase_quantity: e.target.value, purchase_total: String(q * u) })); }} dir="ltr" /></div>
                  <div><Label>سعر الوحدة</Label><Input type="number" value={financeForm.purchase_unit_price} onChange={e => { const u = Number(e.target.value) || 0; const q = Number(financeForm.purchase_quantity) || 1; setFinanceForm(f => ({ ...f, purchase_unit_price: e.target.value, purchase_total: String(q * u) })); }} dir="ltr" /></div>
                  <div><Label>الإجمالي</Label><Input type="number" value={financeForm.purchase_total} onChange={e => setFinanceForm(f => ({ ...f, purchase_total: e.target.value }))} dir="ltr" /></div>
                </div>
                <div><Label>التاريخ</Label><Input type="date" value={financeForm.purchase_date} onChange={e => setFinanceForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
                <div><Label>ملاحظات</Label><Textarea value={financeForm.notes} onChange={e => setFinanceForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري" rows={2} /></div>
              </>
            )}

            {/* خارجة + مخزون أو بدون ربط */}
            {financeDirection === 'خارجة' && (financeCategory === 'مخزون' || financeCategory === 'بدون ربط') && (
              <>
                <div><Label>المبلغ *</Label><Input type="number" value={financeForm.generic_amount} onChange={e => setFinanceForm(f => ({ ...f, generic_amount: e.target.value }))} dir="ltr" /></div>
                <div><Label>البيان</Label><Input value={financeForm.generic_description} onChange={e => setFinanceForm(f => ({ ...f, generic_description: e.target.value }))} placeholder={financeCategory === 'مخزون' ? 'تكلفة مخزون أو وصف' : 'وصف الحركة'} /></div>
                <div><Label>التاريخ</Label><Input type="date" value={financeForm.generic_date} onChange={e => setFinanceForm(f => ({ ...f, generic_date: e.target.value }))} /></div>
                <div><Label>ملاحظات</Label><Textarea value={financeForm.notes} onChange={e => setFinanceForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري" rows={2} /></div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleSaveFinanceEntry} disabled={financeSaving}>
                {financeSaving ? 'جاري الحفظ...' : 'حفظ وتظهر في المالية والقسم المرتبط'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
