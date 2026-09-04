import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP } from '@/data/demo-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { useRef } from 'react';
import { TrendingUp, Users, FileText, Wrench, DollarSign, Package, AlertTriangle, UserCheck, Activity, Calendar, Download, Printer, ShoppingCart } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { invoiceCustomerCredit, invoiceDebtRemaining } from '@/lib/invoiceBalance';

const formatDateDisplay = (v?: string | null) => { const s = String(v || ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch } from '@/lib/branchFilters';

const COLORS = ['hsl(210 80% 30%)', 'hsl(174 60% 40%)', 'hsl(38 92% 50%)', 'hsl(152 60% 40%)', 'hsl(0 72% 51%)'];

export default function ReportsPage() {
  const { branch } = useUserBranch();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [candleChanges, setCandleChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportCustomerId, setReportCustomerId] = useState<string>('none');
  const [reportProductId, setReportProductId] = useState<string>('none');
  const [reportVisitsCustomerId, setReportVisitsCustomerId] = useState<string>('none');
  const [reportCustomerSearch, setReportCustomerSearch] = useState('');
  const [reportProductSearch, setReportProductSearch] = useState('');
  const [reportVisitsCustomerSearch, setReportVisitsCustomerSearch] = useState('');
  const [statementDateFrom, setStatementDateFrom] = useState('');
  const [statementDateTo, setStatementDateTo] = useState('');
  const [productMovementDateFrom, setProductMovementDateFrom] = useState('');
  const [productMovementDateTo, setProductMovementDateTo] = useState('');
  const [visitsDateFrom, setVisitsDateFrom] = useState('');
  const [visitsDateTo, setVisitsDateTo] = useState('');
  const [visitsTechnician, setVisitsTechnician] = useState<string>('none');
  const [visitsTechnicianSearch, setVisitsTechnicianSearch] = useState('');
  const statementPrintRef = useRef<HTMLDivElement>(null);
  const productMovementPrintRef = useRef<HTMLDivElement>(null);
  const visitsPrintRef = useRef<HTMLDivElement>(null);
  const technicianOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...workOrders.map(w => w.technician), ...maintenance.map(m => m.technician), ...candleChanges.map(c => c.technician)].filter(Boolean),
        ),
      ) as string[],
    [workOrders, maintenance, candleChanges],
  );
  const filteredReportCustomers = useMemo(() => {
    const term = reportCustomerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(c => String(c.name || '').toLowerCase().includes(term) || String(c.phone1 || '').toLowerCase().includes(term));
  }, [customers, reportCustomerSearch]);
  const filteredReportProducts = useMemo(() => {
    const term = reportProductSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter(p => String(p.name || '').toLowerCase().includes(term));
  }, [products, reportProductSearch]);
  const filteredVisitsCustomers = useMemo(() => {
    const term = reportVisitsCustomerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(c => String(c.name || '').toLowerCase().includes(term) || String(c.phone1 || '').toLowerCase().includes(term));
  }, [customers, reportVisitsCustomerSearch]);
  const filteredTechnicians = useMemo(() => {
    const term = visitsTechnicianSearch.trim().toLowerCase();
    if (!term) return technicianOptions;
    return technicianOptions.filter(t => t.toLowerCase().includes(term));
  }, [technicianOptions, visitsTechnicianSearch]);

  useEffect(() => {
    const fetchAll = async () => {
      const db = supabase as any;
      const bVals = branchDbValuesForUiBranch(branch);
      const [invR, custR, maintR, woR, prodR, devR, movR, instR, ccR] = await Promise.all([
        supabase.from('invoices').select('*').in('branch', bVals),
        supabase.from('customers').select('*').in('branch', bVals),
        supabase.from('maintenance').select('*').in('branch', bVals),
        supabase.from('work_orders').select('*').in('branch', bVals),
        supabase.from('products').select('*').in('branch', bVals),
        db.from('customer_devices').select('*').in('branch', bVals),
        supabase.from('stock_movements').select('*').in('branch', bVals).order('created_at', { ascending: false }).limit(2000),
        supabase.from('installments').select('*').limit(2000),
        db.from('candle_changes').select('*').order('change_date', { ascending: false }).limit(2000),
      ]);
      setInvoices(invR.data || []);
      setCustomers(custR.data || []);
      setMaintenance(maintR.data || []);
      setWorkOrders(woR.data || []);
      setProducts(prodR.data || []);
      setDevices(devR.data || []);
      setStockMovements(movR.data || []);
      setInstallments(instR.data || []);
      setCandleChanges(ccR.data || []);
      setLoading(false);
    };
    fetchAll();
  }, [branch]);

  // Derived analytics
  const analytics = useMemo(() => {
    const activeInv = invoices.filter(i => i.status !== 'deleted');
    const totalSales = activeInv.reduce((s, i) => s + (i.amount || 0), 0);
    const totalPaid = activeInv.reduce((s, i) => s + (i.paid || 0), 0);
    const totalRemaining = activeInv.reduce((s, i) => s + invoiceDebtRemaining(i.amount, i.paid), 0);
    const totalCustomerCredit = activeInv.reduce((s, i) => s + invoiceCustomerCredit(i.amount, i.paid), 0);
    const paidInvoices = activeInv.filter(i => i.status === 'paid').length;
    const pendingInvoices = activeInv.filter(i => i.status === 'pending').length;
    const partialInvoices = activeInv.filter(i => i.status === 'partial').length;

    // Branch breakdown
    const branchMap: Record<string, { sales: number; customers: Set<string>; invoices: number; paid: number; remaining: number }> = {};
    activeInv.forEach(inv => {
      const b = inv.branch || 'غير محدد';
      if (!branchMap[b]) branchMap[b] = { sales: 0, customers: new Set(), invoices: 0, paid: 0, remaining: 0 };
      branchMap[b].sales += inv.amount || 0;
      branchMap[b].paid += inv.paid || 0;
      branchMap[b].remaining += invoiceDebtRemaining(inv.amount, inv.paid);
      branchMap[b].invoices++;
      if (inv.customer_name) branchMap[b].customers.add(inv.customer_name);
    });
    const branchData = Object.entries(branchMap).map(([branch, d]) => ({
      branch, sales: d.sales, customers: d.customers.size, invoices: d.invoices, paid: d.paid, remaining: d.remaining,
    }));

    // Monthly sales
    const monthMap: Record<string, { sales: number; paid: number; invoices: number }> = {};
    activeInv.forEach(inv => {
      const m = inv.date?.substring(0, 7) || 'غير محدد';
      if (!monthMap[m]) monthMap[m] = { sales: 0, paid: 0, invoices: 0 };
      monthMap[m].sales += inv.amount || 0;
      monthMap[m].paid += inv.paid || 0;
      monthMap[m].invoices++;
    });
    const monthlyData = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
      month, ...d,
    }));

    // Invoice status pie
    const statusPie = [
      { name: 'مدفوعة', value: paidInvoices },
      { name: 'جزئية', value: partialInvoices },
      { name: 'معلقة', value: pendingInvoices },
    ].filter(s => s.value > 0);

    // Product sales
    const productMap: Record<string, { count: number; total: number }> = {};
    activeInv.forEach(inv => {
      const p = inv.product_name || 'غير محدد';
      if (!productMap[p]) productMap[p] = { count: 0, total: 0 };
      productMap[p].count++;
      productMap[p].total += inv.amount || 0;
    });
    const productData = Object.entries(productMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total);

    // Rep performance
    const repMap: Record<string, { sales: number; invoices: number; collected: number }> = {};
    activeInv.forEach(inv => {
      const r = inv.rep_name || 'غير محدد';
      if (!repMap[r]) repMap[r] = { sales: 0, invoices: 0, collected: 0 };
      repMap[r].sales += inv.amount || 0;
      repMap[r].invoices++;
      repMap[r].collected += inv.paid || 0;
    });
    const repData = Object.entries(repMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.sales - a.sales);

    // Maintenance stats
    const overdueMaint = maintenance.filter(m => m.status === 'overdue').length;
    const upcomingMaint = maintenance.filter(m => m.status === 'upcoming').length;
    const completedMaint = maintenance.filter(m => m.status === 'completed').length;

    // Work order stats
    const pendingWO = workOrders.filter(w => w.status === 'pending').length;
    const completedWO = workOrders.filter(w => w.status === 'completed').length;
    const inProgressWO = workOrders.filter(w => w.status === 'in_progress').length;

    // Low stock
    const lowStock = products.filter(p => p.stock <= p.min_stock);

    // مشتريات الفروع (من حركات المخزون نوع purchase)
    const productById: Record<string, { cost?: number }> = {};
    products.forEach((p: any) => { productById[p.id] = { cost: p.cost ?? 0 }; });
    let purchasesAlex = 0;
    let purchasesCairo = 0;
    (stockMovements || []).forEach((m: any) => {
      if (m.type !== 'purchase') return;
      const cost = productById[m.product_id]?.cost ?? 0;
      const value = (Number(m.quantity) || 0) * cost;
      const branch = (m.branch || '').trim();
      if (branch.includes('الإسكندرية')) purchasesAlex += value;
      if (branch.includes('القاهرة') || branch.includes('الجيزة')) purchasesCairo += value;
    });

    return {
      totalSales, totalPaid, totalRemaining, totalCustomerCredit, paidInvoices, pendingInvoices, partialInvoices,
      branchData, monthlyData, statusPie, productData, repData,
      overdueMaint, upcomingMaint, completedMaint,
      pendingWO, completedWO, inProgressWO,
      lowStock,
      totalCustomers: customers.length,
      totalDevices: devices.length,
      purchasesAlex,
      purchasesCairo,
    };
  }, [invoices, customers, maintenance, workOrders, products, devices, stockMovements]);

  if (loading) return <p className="text-muted-foreground text-center py-12">جاري تحميل التقارير...</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h1 className="text-2xl font-bold">التقارير والتحليلات</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { icon: DollarSign, label: 'إجمالي المبيعات', value: formatEGP(analytics.totalSales), color: 'gradient-card-blue' },
          { icon: DollarSign, label: 'المحصل', value: formatEGP(analytics.totalPaid), color: 'gradient-card-success' },
          { icon: AlertTriangle, label: 'متبقي على العملاء', value: formatEGP(analytics.totalRemaining), color: 'gradient-card-warning' },
          { icon: TrendingUp, label: 'رصيد عملاء (+)', value: formatEGP(analytics.totalCustomerCredit), color: 'bg-emerald-700 border-0' },
          { icon: Users, label: 'العملاء', value: analytics.totalCustomers.toString(), color: 'gradient-card-teal' },
          { icon: FileText, label: 'الفواتير', value: invoices.filter(i => i.status !== 'deleted').length.toString(), color: 'gradient-card-blue' },
          { icon: Package, label: 'الأجهزة', value: analytics.totalDevices.toString(), color: 'gradient-card-teal' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={`${s.color} text-primary-foreground`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1 opacity-90"><s.icon className="h-3.5 w-3.5" /><span className="text-[10px]">{s.label}</span></div>
                <p className="text-lg font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="sales" className="text-xs">المبيعات</TabsTrigger>
          <TabsTrigger value="branches" className="text-xs">الفروع</TabsTrigger>
          <TabsTrigger value="products" className="text-xs">المنتجات</TabsTrigger>
          <TabsTrigger value="reps" className="text-xs">المناديب</TabsTrigger>
          <TabsTrigger value="operations" className="text-xs">العمليات</TabsTrigger>
          <TabsTrigger value="financial" className="text-xs gap-1"><DollarSign className="h-3 w-3" /> المالية</TabsTrigger>
          <TabsTrigger value="client-statement" className="text-xs gap-1"><UserCheck className="h-3 w-3" /> كشف حساب عميل</TabsTrigger>
          <TabsTrigger value="product-movement" className="text-xs gap-1"><Activity className="h-3 w-3" /> كشف حركة منتج</TabsTrigger>
          <TabsTrigger value="client-visits" className="text-xs gap-1"><Calendar className="h-3 w-3" /> كشف زيارات عميل</TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-sm">المبيعات الشهرية</CardTitle></CardHeader>
              <CardContent>
                {analytics.monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analytics.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 20% 90%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatEGP(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="sales" fill="hsl(210 80% 30%)" name="المبيعات" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paid" fill="hsl(152 60% 40%)" name="المحصل" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>}
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-sm">حالة الفواتير</CardTitle></CardHeader>
              <CardContent>
                {analytics.statusPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={analytics.statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {analytics.statusPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Branches Tab */}
        <TabsContent value="branches" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-sm">مبيعات الفروع</CardTitle></CardHeader>
              <CardContent>
                {analytics.branchData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analytics.branchData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 20% 90%)" />
                      <XAxis dataKey="branch" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatEGP(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="sales" fill="hsl(210 80% 30%)" name="المبيعات" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paid" fill="hsl(152 60% 40%)" name="المحصل" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="remaining" fill="hsl(0 72% 51%)" name="متبقي على العملاء" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>}
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-sm">تفاصيل الفروع</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.branchData.map((b, i) => (
                    <div key={b.branch} className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{b.branch}</span>
                        <Badge variant="outline">{b.invoices} فاتورة</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-muted-foreground">المبيعات: </span><span className="font-bold">{formatEGP(b.sales)}</span></div>
                        <div><span className="text-muted-foreground">المحصل: </span><span className="font-bold text-secondary">{formatEGP(b.paid)}</span></div>
                        <div><span className="text-muted-foreground">متبقي على العملاء: </span><span className="font-bold text-destructive">{formatEGP(b.remaining)}</span></div>
                      </div>
                      <div className="text-xs text-muted-foreground">{b.customers} عميل</div>
                    </div>
                  ))}
                  {analytics.branchData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-sm">المنتجات الأكثر مبيعاً</CardTitle></CardHeader>
              <CardContent>
                {analytics.productData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analytics.productData.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 20% 90%)" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} />
                      <Tooltip formatter={(v: number) => formatEGP(v)} />
                      <Bar dataKey="total" fill="hsl(174 60% 40%)" name="الإجمالي" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>}
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-sm">تفاصيل المنتجات</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50"><th className="p-2 text-right">المنتج</th><th className="p-2 text-center">العدد</th><th className="p-2 text-right">الإجمالي</th></tr></thead>
                    <tbody>
                      {analytics.productData.map(p => (
                        <tr key={p.name} className="border-b hover:bg-muted/30">
                          <td className="p-2">{p.name}</td>
                          <td className="p-2 text-center">{p.count}</td>
                          <td className="p-2 font-bold">{formatEGP(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {analytics.productData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low stock alert */}
          {analytics.lowStock.length > 0 && (
            <Card className="card-shadow border-destructive/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> منتجات منخفضة المخزون</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {analytics.lowStock.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-2 bg-destructive/5 rounded text-sm">
                      <span>{p.name}</span>
                      <Badge variant="destructive">{p.stock} / {p.min_stock}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reps Tab */}
        <TabsContent value="reps" className="space-y-4">
          <Card className="card-shadow">
            <CardHeader className="pb-2"><CardTitle className="text-sm">أداء المناديب</CardTitle></CardHeader>
            <CardContent>
              {analytics.repData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.repData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 20% 90%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatEGP(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="sales" fill="hsl(210 80% 30%)" name="المبيعات" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="collected" fill="hsl(152 60% 40%)" name="المحصل" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {analytics.repData.map((r, i) => (
                      <div key={r.name} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary w-6 text-center">{i + 1}</span>
                          <span className="font-medium">{r.name}</span>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span>{r.invoices} فاتورة</span>
                          <span className="font-bold">{formatEGP(r.sales)}</span>
                          <span className="text-secondary">{formatEGP(r.collected)} محصل</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* كشف حساب عميل */}
        <TabsContent value="client-statement" className="space-y-4">
          <Card className="card-shadow">
            <CardHeader className="pb-2"><CardTitle className="text-sm">كشف حساب عميل</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">العميل</Label>
                  <Input value={reportCustomerSearch} onChange={e => setReportCustomerSearch(e.target.value)} placeholder="بحث عميل..." className="w-[180px]" />
                  <Select value={reportCustomerId} onValueChange={setReportCustomerId}>
                    <SelectTrigger className="w-[240px]"><SelectValue placeholder="اختر عميلاً" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر عميلاً</SelectItem>
                      {filteredReportCustomers.map(c => (<SelectItem key={c.id} value={c.id}>{c.name} - {c.phone1}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input type="date" value={statementDateFrom} onChange={e => setStatementDateFrom(e.target.value)} className="w-[140px]" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input type="date" value={statementDateTo} onChange={e => setStatementDateTo(e.target.value)} className="w-[140px]" />
                </div>
              </div>
              {reportCustomerId && reportCustomerId !== 'none' && (() => {
                const cust = customers.find(c => c.id === reportCustomerId);
                const custInvoices = invoices.filter(i => i.status !== 'deleted' && (i.customer_id === reportCustomerId || i.customer_name === cust?.name));
                const custInstallments = installments.filter(inst => inst.customer_id === reportCustomerId);
                const inRange = (d: string) => (!statementDateFrom || d >= statementDateFrom) && (!statementDateTo || d <= statementDateTo);
                type Row = { date: string; ref: string; type: string; debit: number; credit: number; balance: number };
                const rows: Row[] = [];
                custInvoices.filter(i => inRange(i.date)).forEach(inv => {
                  rows.push({ date: inv.date, ref: inv.invoice_number, type: 'فاتورة', debit: inv.amount || 0, credit: 0, balance: 0 });
                });
                custInstallments.forEach(inst => {
                  const payDate = (inst.collection_date || inst.installment_date || '').toString().slice(0, 10);
                  if (!payDate || !inRange(payDate)) return;
                  rows.push({ date: payDate, ref: 'قسط', type: 'دفعة', debit: 0, credit: Number(inst.amount) || 0, balance: 0 });
                });
                rows.sort((a, b) => a.date.localeCompare(b.date));
                let running = 0;
                rows.forEach(r => { running += r.debit - r.credit; r.balance = running; });
                const totalIn = custInvoices.reduce((s, i) => s + (i.amount || 0), 0);
                const totalPaid = custInvoices.reduce((s, i) => s + (i.paid || 0), 0);
                const debtOnCustomer = Math.max(0, Math.round((totalIn - totalPaid) * 100) / 100);
                const creditForCustomer = Math.max(0, Math.round((totalPaid - totalIn) * 100) / 100);
                const exportCsv = () => {
                  const BOM = '\uFEFF';
                  const header = 'التاريخ,الرقم,النوع,مدين,دائن,الرصيد\n';
                  const body = rows.map(r => `${r.date},${r.ref},${r.type},${r.debit},${r.credit},${r.balance}`).join('\n');
                  const blob = new Blob([BOM + header + body], { type: 'text/csv;charset=utf-8' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `كشف-حساب-${cust?.name || 'عميل'}.csv`; a.click(); URL.revokeObjectURL(a.href);
                };
                const doPrint = () => { const w = window.open('', '_blank'); if (w && statementPrintRef.current) { w.document.write('<html dir="rtl"><head><title>كشف حساب ' + (cust?.name || '') + '</title><style>table{border-collapse:collapse;width:100%} th,td{border:1px solid #333;padding:6px;text-align:right}</style></head><body>' + statementPrintRef.current.innerHTML + '</body></html>'); w.document.close(); w.print(); w.close(); } };
                return (
                  <div className="space-y-2 border rounded-lg p-4">
                    <p className="font-bold">{cust?.name}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-2">
                      <div><span className="text-muted-foreground">إجمالي الفواتير:</span> <span className="font-bold">{formatEGP(totalIn)}</span></div>
                      <div><span className="text-muted-foreground">المدفوع:</span> <span className="font-bold text-secondary">{formatEGP(totalPaid)}</span></div>
                      <div><span className="text-muted-foreground">متبقي على العميل:</span> <span className="font-bold text-destructive">{formatEGP(debtOnCustomer)}</span></div>
                      <div><span className="text-muted-foreground">رصيد للعميل (+):</span> <span className="font-bold text-emerald-700">{formatEGP(creditForCustomer)}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv}><Download className="h-4 w-4" /> تصدير Excel</Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={doPrint}><Printer className="h-4 w-4" /> طباعة / PDF</Button>
                    </div>
                    <div ref={statementPrintRef} className="overflow-x-auto">
                      <table className="w-full text-xs mt-2">
                        <thead><tr className="bg-muted/50"><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">رقم الفاتورة</th><th className="p-2 text-right">النوع</th><th className="p-2 text-right">مدين</th><th className="p-2 text-right">دائن</th><th className="p-2 text-right">الرصيد</th></tr></thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i} className="border-b"><td className="p-2">{formatDateDisplay(r.date)}</td><td className="p-2">{r.ref}</td><td className="p-2">{r.type}</td><td className="p-2">{r.debit ? formatEGP(r.debit) : '-'}</td><td className="p-2">{r.credit ? formatEGP(r.credit) : '-'}</td><td className="p-2 font-medium">{formatEGP(r.balance)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
              {(!reportCustomerId || reportCustomerId === 'none') && <p className="text-muted-foreground text-sm">اختر عميلاً لعرض كشف حسابه</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* كشف حركة منتج */}
        <TabsContent value="product-movement" className="space-y-4">
          <Card className="card-shadow">
            <CardHeader className="pb-2"><CardTitle className="text-sm">كشف حركة منتج</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">المنتج</Label>
                  <Input value={reportProductSearch} onChange={e => setReportProductSearch(e.target.value)} placeholder="بحث منتج..." className="w-[180px]" />
                  <Select value={reportProductId} onValueChange={setReportProductId}>
                    <SelectTrigger className="w-[240px]"><SelectValue placeholder="اختر منتجاً" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر منتجاً</SelectItem>
                      {filteredReportProducts.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} (مخزون: {p.stock})</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input type="date" value={productMovementDateFrom} onChange={e => setProductMovementDateFrom(e.target.value)} className="w-[140px]" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input type="date" value={productMovementDateTo} onChange={e => setProductMovementDateTo(e.target.value)} className="w-[140px]" />
                </div>
              </div>
              {reportProductId && reportProductId !== 'none' && (() => {
                const prod = products.find(p => p.id === reportProductId);
                const inRange = (d: string) => (!productMovementDateFrom || d >= productMovementDateFrom) && (!productMovementDateTo || d <= productMovementDateTo);
                const movements = stockMovements.filter(m => m.product_id === reportProductId && inRange((m.created_at || '').slice(0, 10)));
                const invForProduct = invoices.filter(i => i.status !== 'deleted' && i.product_id === reportProductId && inRange(i.date));
                const rows = movements.map(m => ({ date: m.created_at?.slice(0, 10), type: m.type === 'sale' ? 'مبيعات' : m.type === 'purchase' ? 'مشتريات' : m.type === 'adjustment' ? 'تعديل' : m.type, qtyIn: m.type === 'purchase' ? m.quantity : '', qtyOut: m.type === 'sale' ? m.quantity : '', ref: m.reference_type === 'invoice' ? `فاتورة ${m.reference_id}` : m.reference_type || '-', user: '' }));
                if (movements.length === 0 && invForProduct.length > 0) invForProduct.slice(0, 100).forEach(inv => rows.push({ date: inv.date, type: 'مبيعات', qtyIn: '', qtyOut: String(inv.quantity ?? 1), ref: `فاتورة ${inv.invoice_number}`, user: '' }));
                rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                const exportCsv = () => {
                  const BOM = '\uFEFF';
                  const header = 'التاريخ,النوع,كمية داخلة,كمية خارجة,مرجع,المستخدم\n';
                  const body = rows.map(r => `${r.date},${r.type},${r.qtyIn},${r.qtyOut},${r.ref},${r.user}`).join('\n');
                  const blob = new Blob([BOM + header + body], { type: 'text/csv;charset=utf-8' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `حركة-منتج-${prod?.name || 'product'}.csv`; a.click(); URL.revokeObjectURL(a.href);
                };
                const doPrint = () => { const w = window.open('', '_blank'); if (w && productMovementPrintRef.current) { w.document.write('<html dir="rtl"><head><title>حركة منتج ' + (prod?.name || '') + '</title><style>table{border-collapse:collapse;width:100%} th,td{border:1px solid #333;padding:6px;text-align:right}</style></head><body>' + productMovementPrintRef.current.innerHTML + '</body></html>'); w.document.close(); w.print(); w.close(); } };
                return (
                  <div className="space-y-2 border rounded-lg p-4">
                    <p className="font-bold">{prod?.name}</p>
                    <p className="text-sm text-muted-foreground">المخزون الحالي: {prod?.stock ?? 0}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv}><Download className="h-4 w-4" /> تصدير Excel</Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={doPrint}><Printer className="h-4 w-4" /> طباعة / PDF</Button>
                    </div>
                    <div ref={productMovementPrintRef} className="overflow-x-auto">
                      <table className="w-full text-xs mt-2">
                        <thead><tr className="bg-muted/50"><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">المنتج</th><th className="p-2 text-right">نوع الحركة</th><th className="p-2 text-right">كمية داخلة</th><th className="p-2 text-right">كمية خارجة</th><th className="p-2 text-right">مرجع</th><th className="p-2 text-right">المستخدم</th></tr></thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2">{formatDateDisplay(r.date)}</td><td className="p-2">{prod?.name}</td><td className="p-2">{r.type}</td>
                              <td className="p-2">{r.qtyIn}</td><td className="p-2">{r.qtyOut}</td><td className="p-2">{r.ref}</td><td className="p-2">{r.user || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
              {(!reportProductId || reportProductId === 'none') && <p className="text-muted-foreground text-sm">اختر منتجاً لعرض حركته</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* كشف زيارات عميل */}
        <TabsContent value="client-visits" className="space-y-4">
          <Card className="card-shadow">
            <CardHeader className="pb-2"><CardTitle className="text-sm">كشف زيارات عميل</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">العميل</Label>
                  <Input value={reportVisitsCustomerSearch} onChange={e => setReportVisitsCustomerSearch(e.target.value)} placeholder="بحث عميل..." className="w-[180px]" />
                  <Select value={reportVisitsCustomerId} onValueChange={setReportVisitsCustomerId}>
                    <SelectTrigger className="w-[240px]"><SelectValue placeholder="اختر عميلاً" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">الكل</SelectItem>
                      {filteredVisitsCustomers.map(c => (<SelectItem key={c.id} value={c.id}>{c.name} - {c.phone1}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">الفني</Label>
                  <Input value={visitsTechnicianSearch} onChange={e => setVisitsTechnicianSearch(e.target.value)} placeholder="بحث فني..." className="w-[150px]" />
                  <Select value={visitsTechnician} onValueChange={setVisitsTechnician}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">الكل</SelectItem>
                      {filteredTechnicians.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input type="date" value={visitsDateFrom} onChange={e => setVisitsDateFrom(e.target.value)} className="w-[140px]" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input type="date" value={visitsDateTo} onChange={e => setVisitsDateTo(e.target.value)} className="w-[140px]" />
                </div>
              </div>
              {(() => {
                const inRange = (d: string) => (!visitsDateFrom || d >= visitsDateFrom) && (!visitsDateTo || d <= visitsDateTo);
                const techMatch = (t: string) => visitsTechnician === 'none' || !visitsTechnician || t === visitsTechnician;
                const custMatch = (name: string) => reportVisitsCustomerId === 'none' || customers.find(c => c.id === reportVisitsCustomerId)?.name === name;
                type VisitRow = { date: string; customer: string; technician: string; type: string; notes: string; nextVisit: string };
                const rows: VisitRow[] = [];
                workOrders.filter(wo => inRange(wo.visit_date) && techMatch(wo.technician || '') && custMatch(wo.customer_name)).forEach(wo => {
                  rows.push({ date: wo.visit_date, customer: wo.customer_name, technician: wo.technician || '', type: 'أمر عمل', notes: wo.notes || '', nextVisit: '' });
                });
                maintenance.filter(m => inRange(m.next_date) && techMatch(m.technician || '') && custMatch(m.customer_name)).forEach(m => {
                  rows.push({ date: m.next_date, customer: m.customer_name, technician: m.technician || '', type: m.type || 'صيانة', notes: m.notes || '', nextVisit: (() => { const d = m.next_dates; const arr = Array.isArray(d) ? d : (typeof d === 'string' ? (() => { try { return JSON.parse(d); } catch { return []; } })() : []); return arr[1] || ''; })() });
                });
                candleChanges.filter(cc => inRange(cc.change_date) && techMatch(cc.technician || '')).forEach(cc => {
                  const dev = devices.find(d => d.id === cc.device_id);
                  const custName = dev ? customers.find(c => c.id === dev.customer_id)?.name : '';
                  if (reportVisitsCustomerId !== 'none' && custName !== customers.find(c => c.id === reportVisitsCustomerId)?.name) return;
                  rows.push({ date: cc.change_date, customer: custName || '', technician: cc.technician || '', type: 'تغيير شمعات', notes: cc.notes || '', nextVisit: '' });
                });
                rows.sort((a, b) => a.date.localeCompare(b.date));
                const exportCsv = () => {
                  const BOM = '\uFEFF';
                  const header = 'التاريخ,العميل,الفني,نوع الزيارة,ملاحظات,الزيارة القادمة\n';
                  const body = rows.map(r => `${r.date},${r.customer},${r.technician},${r.type},${r.notes},${r.nextVisit}`).join('\n');
                  const blob = new Blob([BOM + header + body], { type: 'text/csv;charset=utf-8' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'كشف-زيارات.csv'; a.click(); URL.revokeObjectURL(a.href);
                };
                const doPrint = () => { const w = window.open('', '_blank'); if (w && visitsPrintRef.current) { w.document.write('<html dir="rtl"><head><title>كشف زيارات</title><style>table{border-collapse:collapse;width:100%} th,td{border:1px solid #333;padding:6px;text-align:right}</style></head><body>' + visitsPrintRef.current.innerHTML + '</body></html>'); w.document.close(); w.print(); w.close(); } };
                return (
                  <div className="space-y-2 border rounded-lg p-4">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv}><Download className="h-4 w-4" /> تصدير Excel</Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={doPrint}><Printer className="h-4 w-4" /> طباعة / PDF</Button>
                    </div>
                    <div ref={visitsPrintRef} className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-muted/50"><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">العميل</th><th className="p-2 text-right">الفني</th><th className="p-2 text-right">نوع الزيارة</th><th className="p-2 text-right">ملاحظات</th><th className="p-2 text-right">الزيارة القادمة</th></tr></thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i} className="border-b"><td className="p-2">{formatDateDisplay(r.date)}</td><td className="p-2">{r.customer}</td><td className="p-2">{r.technician}</td><td className="p-2">{r.type}</td><td className="p-2">{r.notes}</td><td className="p-2">{formatDateDisplay(r.nextVisit)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {rows.length === 0 && <p className="text-muted-foreground text-sm py-4">لا توجد زيارات تطابق الفلتر</p>}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Maintenance Summary */}
            <Card className="card-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4" /> ملخص الصيانة</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-secondary">{analytics.completedMaint}</p>
                    <p className="text-xs text-muted-foreground">مكتملة</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{analytics.upcomingMaint}</p>
                    <p className="text-xs text-muted-foreground">قادمة</p>
                  </div>
                  <div className="text-center p-3 bg-destructive/10 rounded-lg">
                    <p className="text-2xl font-bold text-destructive">{analytics.overdueMaint}</p>
                    <p className="text-xs text-muted-foreground">متأخرة</p>
                  </div>
                </div>
                {maintenance.length > 0 && (
                  <div className="space-y-1">
                    {maintenance.slice(0, 5).map(m => (
                      <div key={m.id} className="flex justify-between items-center text-xs p-1.5 hover:bg-muted/30 rounded">
                        <span>{m.customer_name} - {m.type}</span>
                        <Badge variant={m.status === 'overdue' ? 'destructive' : m.status === 'completed' ? 'default' : 'outline'} className="text-[9px]">
                          {m.status === 'overdue' ? 'متأخرة' : m.status === 'completed' ? 'مكتملة' : 'قادمة'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Orders Summary */}
            <Card className="card-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> ملخص أوامر العمل</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-secondary">{analytics.completedWO}</p>
                    <p className="text-xs text-muted-foreground">مكتمل</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{analytics.inProgressWO}</p>
                    <p className="text-xs text-muted-foreground">قيد التنفيذ</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{analytics.pendingWO}</p>
                    <p className="text-xs text-muted-foreground">معلق</p>
                  </div>
                </div>
                {workOrders.length > 0 && (
                  <div className="space-y-1">
                    {workOrders.slice(0, 5).map(w => (
                      <div key={w.id} className="flex justify-between items-center text-xs p-1.5 hover:bg-muted/30 rounded">
                        <span>{w.order_code} - {w.customer_name}</span>
                        <div className="flex gap-1">
                          <Badge variant={w.status === 'completed' ? 'default' : 'outline'} className="text-[9px]">
                            {w.status === 'completed' ? 'مكتمل' : w.status === 'in_progress' ? 'جاري' : 'معلق'}
                          </Badge>
                          {w.total > 0 && <span className="text-muted-foreground">{formatEGP(w.total)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* المالية: مشتريات الفروع */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="card-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> مشتريات فرع الإسكندرية</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatEGP(analytics.purchasesAlex)}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي قيمة حركات المشتريات (وارد) للفرع</p>
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> مشتريات فرع القاهرة</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatEGP(analytics.purchasesCairo)}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي قيمة حركات المشتريات (وارد) للفرع — يشمل فرع الجيزة إن وُجد</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
