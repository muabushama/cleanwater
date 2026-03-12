import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { formatEGP } from '@/data/demo-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, FileText, AlertTriangle } from 'lucide-react';

export default function FinancePage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { branch } = useUserBranch();

  useEffect(() => {
    const fetchAll = async () => {
      const db = supabase as any;
      const [invR, maintR, devR, instR, prodR] = await Promise.all([
        supabase.from('invoices').select('*').eq('branch', branch),
        supabase.from('maintenance').select('*').eq('branch', branch),
        db.from('customer_devices').select('*').eq('branch', branch),
        db.from('installments').select('*'),
        supabase.from('products').select('*'),
      ]);
      setInvoices(invR.data || []);
      setMaintenance(maintR.data || []);
      setDevices(devR.data || []);
      setInstallments(instR.data || []);
      setProducts(prodR.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const finance = useMemo(() => {
    const activeInv = invoices.filter(i => i.status !== 'deleted');
    const totalSales = activeInv.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalPaid = activeInv.reduce((s, i) => s + (Number(i.paid) || 0), 0);
    const totalRemaining = activeInv.reduce((s, i) => s + (Number(i.remaining) || 0), 0);

    // Cost of goods (from products)
    const costOfGoods = activeInv.reduce((s, inv) => {
      const product = products.find(p => p.name === inv.product_name);
      return s + (product ? product.cost : 0);
    }, 0);

    // Maintenance revenue
    const maintenanceRevenue = maintenance.reduce((s, m) => s + (m.cost || 0), 0);

    // Installments
    const totalInstallments = installments.reduce((s, i) => s + (i.amount || 0), 0);
    const paidInstallments = installments.filter(i => i.status === 'مدفوع').reduce((s, i) => s + (i.amount || 0), 0);
    const pendingInstallments = totalInstallments - paidInstallments;
    const overdueInstallments = installments.filter(i => i.status === 'معلق' && new Date(i.installment_date) < new Date());

    // Device values
    const totalDeviceValue = devices.reduce((s: number, d: any) => s + (d.total_price || 0), 0);

    // Gross profit
    const grossProfit = totalSales - costOfGoods;

    // By branch
    const branchFinance: Record<string, { sales: number; paid: number; remaining: number; invoices: number }> = {};
    activeInv.forEach(inv => {
      const b = inv.branch || 'غير محدد';
      if (!branchFinance[b]) branchFinance[b] = { sales: 0, paid: 0, remaining: 0, invoices: 0 };
      branchFinance[b].sales += Number(inv.amount) || 0;
      branchFinance[b].paid += Number(inv.paid) || 0;
      branchFinance[b].remaining += Number(inv.remaining) || 0;
      branchFinance[b].invoices++;
    });

    // By payment type
    const cashSales = activeInv.filter(i => i.type === 'cash').reduce((s, i) => s + (i.amount || 0), 0);
    const installmentSales = activeInv.filter(i => i.type === 'installment').reduce((s, i) => s + (i.amount || 0), 0);

    // Recent invoices (unpaid/partial)
    const unpaidInvoices = activeInv.filter(i => i.status !== 'paid').sort((a, b) => (b.remaining || 0) - (a.remaining || 0));

    return {
      totalSales, totalPaid, totalRemaining, costOfGoods, grossProfit,
      maintenanceRevenue, totalInstallments, paidInstallments, pendingInstallments,
      overdueInstallments, totalDeviceValue,
      branchFinance: Object.entries(branchFinance).map(([branch, d]) => ({ branch, ...d })),
      cashSales, installmentSales, unpaidInvoices,
    };
  }, [invoices, maintenance, devices, installments, products]);

  if (loading) return <p className="text-muted-foreground text-center py-12">جاري التحميل...</p>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h1 className="text-2xl font-bold">المالية</h1>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: DollarSign, label: 'إجمالي المبيعات', value: formatEGP(finance.totalSales), color: 'gradient-card-blue' },
          { icon: TrendingUp, label: 'المحصل', value: formatEGP(finance.totalPaid), color: 'gradient-card-success' },
          { icon: TrendingDown, label: 'المتبقي', value: formatEGP(finance.totalRemaining), color: 'gradient-card-warning' },
          { icon: CreditCard, label: 'أقساط معلقة', value: formatEGP(finance.pendingInstallments), color: 'gradient-card-warning' },
          { icon: FileText, label: 'إيرادات الصيانة', value: formatEGP(finance.maintenanceRevenue), color: 'gradient-card-teal' },
          { icon: TrendingUp, label: 'مجمل الربح', value: formatEGP(finance.grossProfit), color: 'gradient-card-success' },
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
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="summary" className="text-xs">الملخص</TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">المديونيات</TabsTrigger>
          <TabsTrigger value="installments" className="text-xs">الأقساط</TabsTrigger>
          <TabsTrigger value="branches" className="text-xs">الفروع</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <Card className="card-shadow">
            <CardHeader><CardTitle className="text-sm">ملخص الحساب التفصيلي</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between p-2.5 bg-primary/5 rounded font-bold">
                <span>إجمالي المبيعات</span><span>{formatEGP(finance.totalSales)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">↳ مبيعات نقدية</span><span>{formatEGP(finance.cashSales)}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">↳ مبيعات تقسيط</span><span>{formatEGP(finance.installmentSales)}</span>
              </div>
              <div className="border-t my-1" />
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">- تكلفة البضاعة (تقديرية)</span><span>{formatEGP(finance.costOfGoods)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-secondary/10 rounded font-bold">
                <span>مجمل الربح</span><span className="text-secondary">{formatEGP(finance.grossProfit)}</span>
              </div>
              <div className="border-t my-1" />
              <div className="flex justify-between p-2.5 rounded">
                <span className="text-muted-foreground">+ إيرادات الصيانة</span><span>{formatEGP(finance.maintenanceRevenue)}</span>
              </div>
              <div className="border-t my-1" />
              <div className="flex justify-between p-2.5 rounded">
                <span>إجمالي المحصل</span><span className="font-bold text-secondary">{formatEGP(finance.totalPaid)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-destructive/5 rounded">
                <span>إجمالي المتبقي</span><span className="font-bold text-destructive">{formatEGP(finance.totalRemaining)}</span>
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
                          <td className="p-2 font-bold text-destructive">{formatEGP(inv.remaining)}</td>
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
                        <td className="p-2 text-destructive">{formatEGP(finance.unpaidInvoices.reduce((s, i) => s + i.remaining, 0))}</td>
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
                  <Badge variant="default">{installments.filter(i => i.status === 'مدفوع').length} مدفوع</Badge>
                  <Badge variant="outline">{installments.filter(i => i.status === 'معلق').length} معلق</Badge>
                  {finance.overdueInstallments.length > 0 && <Badge variant="destructive">{finance.overdueInstallments.length} متأخر</Badge>}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {installments.length === 0 ? (
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
                      {installments.map((inst, i) => {
                        const isOverdue = inst.status === 'معلق' && new Date(inst.installment_date) < new Date();
                        return (
                          <tr key={inst.id} className={`border-b hover:bg-muted/30 ${isOverdue ? 'bg-destructive/5' : ''}`}>
                            <td className="p-2">{i + 1}</td>
                            <td className="p-2">{inst.installment_date}</td>
                            <td className="p-2 font-bold">{formatEGP(inst.amount)}</td>
                            <td className="p-2">{inst.collection_date || '-'}</td>
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
    </motion.div>
  );
}
