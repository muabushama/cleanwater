import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, FileText, Wrench, AlertTriangle, TrendingUp, Package, Calendar } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { formatEGP } from '@/data/demo-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  paid: number;
  remaining: number;
  status: string;
  date: string;
  branch: string;
}
interface MaintenanceRow {
  id: string;
  customer_name: string;
  type: string;
  next_date: string;
  status: string;
  branch: string;
}

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { branch } = useUserBranch();
  const [dateFrom, setDateFrom] = useState<Date>(() => subMonths(new Date(), 1));
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; stock: number; min_stock: number }[]>([]);
  const [installments, setInstallments] = useState<{ amount: number; installment_date: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [invRes, maintRes, prodRes, instRes] = await Promise.all([
          supabase.from('invoices').select('*').eq('branch', branch).order('date', { ascending: false }).limit(500),
          supabase.from('maintenance').select('*').eq('branch', branch).order('next_date', { ascending: true }).limit(100),
          supabase.from('products').select('id,name,stock,min_stock').limit(500),
          supabase.from('installments').select('amount,installment_date').limit(1000),
        ]);
        setInvoices(Array.isArray(invRes.data) ? (invRes.data as InvoiceRow[]) : []);
        setMaintenance(Array.isArray(maintRes.data) ? (maintRes.data as MaintenanceRow[]) : []);
        setProducts(Array.isArray(prodRes.data) ? (prodRes.data as any[]) : []);
        setInstallments(Array.isArray(instRes.data) ? (instRes.data as any[]) : []);
      } catch {
        setInvoices([]);
        setMaintenance([]);
        setProducts([]);
        setInstallments([]);
      }
      setLoading(false);
    };
    load();
  }, [branch]);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const rangeStart = dateFrom ? startOfDay(dateFrom) : todayStart;
  const rangeEnd = dateTo ? endOfDay(dateTo) : todayEnd;

  const inRange = (d: string) => {
    try {
      const date = typeof d === 'string' ? parseISO(d) : new Date(d);
      return isWithinInterval(date, { start: rangeStart, end: rangeEnd });
    } catch {
      return false;
    }
  };

  const activeInvoices = invoices.filter(i => i.status !== 'deleted');
  const invoicesInRange = activeInvoices.filter(i => inRange(i.date));
  const todaySales = activeInvoices.filter(i => {
    try {
      const date = parseISO(i.date);
      return isWithinInterval(date, { start: todayStart, end: todayEnd });
    } catch { return false; }
  }).reduce((s, i) => s + i.amount, 0);
  const monthlyAmount = activeInvoices.filter(i => {
    try {
      const date = parseISO(i.date);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    } catch { return false; }
  }).reduce((s, i) => s + i.amount, 0);
  const pendingInvoices = activeInvoices.filter(i => i.status === 'pending' || i.status === 'partial').length;
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const installmentsDue = installments
    .filter(inst => {
      try {
        const d = parseISO(inst.installment_date);
        return d <= nextMonth && d >= new Date();
      } catch { return false; }
    })
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const maintenanceDue = maintenance.filter(m => m.status === 'upcoming' || m.status === 'overdue').length;
  const lowStockItems = products.filter(p => Number(p.stock) <= Number(p.min_stock || 0)).length;

  const monthlyChartData = (() => {
    const months: Record<string, { sales: number; month: string }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      months[key] = { month: format(d, 'MMM', { locale: ar }), sales: 0 };
    }
    invoicesInRange.forEach(inv => {
      try {
        const key = format(parseISO(inv.date), 'yyyy-MM');
        if (months[key]) months[key].sales += Number(inv.amount);
      } catch { /* ignore parse error */ }
    });
    return Object.values(months);
  })();

  const branchData = (() => {
    const byBranch: Record<string, number> = {};
    activeInvoices.forEach(inv => {
      const b = inv.branch || branch;
      byBranch[b] = (byBranch[b] || 0) + Number(inv.amount);
    });
    return Object.entries(byBranch).map(([branchName, sales]) => ({ branch: branchName, sales }));
  })();

  const openInvoicesWithRange = () => {
    navigate(`/invoices?from=${format(rangeStart, 'yyyy-MM-dd')}&to=${format(rangeEnd, 'yyyy-MM-dd')}`);
  };

  const openMaintenance = () => navigate('/visits');
  const openInventory = () => navigate('/inventory');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm">ملخص الفترة المحددة</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              {format(dateFrom, 'yyyy-MM-dd', { locale: ar })} ← → {format(dateTo, 'yyyy-MM-dd', { locale: ar })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">من</p>
                <CalendarComponent mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">إلى</p>
                <CalendarComponent mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="مبيعات اليوم" value={todaySales} suffix=" ج.م" icon={<DollarSign className="h-5 w-5" />} gradient="gradient-card-blue" delay={0} />
        <StatCard title="مبيعات الشهر" value={monthlyAmount} suffix=" ج.م" icon={<TrendingUp className="h-5 w-5" />} gradient="gradient-card-teal" delay={0.1} />
        <div onClick={openInvoicesWithRange} className="cursor-pointer">
          <StatCard title="فواتير معلقة" value={pendingInvoices} icon={<FileText className="h-5 w-5" />} gradient="gradient-card-warning" delay={0.2} />
        </div>
        <StatCard title="أقساط مستحقة" value={installmentsDue} suffix=" ج.م" icon={<DollarSign className="h-5 w-5" />} gradient="gradient-card-blue" delay={0.3} />
        <div onClick={openMaintenance} className="cursor-pointer">
          <StatCard title="صيانة مستحقة" value={maintenanceDue} icon={<Wrench className="h-5 w-5" />} gradient="gradient-card-success" delay={0.4} />
        </div>
        <div onClick={openInventory} className="cursor-pointer">
          <StatCard title="مخزون منخفض" value={lowStockItems} icon={<AlertTriangle className="h-5 w-5" />} gradient="gradient-card-warning" delay={0.5} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base">المبيعات حسب الشهر (الفترة المحددة)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 20% 90%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatEGP(value)} />
                  <Area type="monotone" dataKey="sales" stroke="hsl(210 80% 30%)" fill="hsl(210 80% 30% / 0.15)" strokeWidth={2} name="المبيعات" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base">مقارنة الفروع</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={branchData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 20% 90%)" />
                  <XAxis dataKey="branch" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatEGP(value)} />
                  <Bar dataKey="sales" fill="hsl(210 80% 30%)" radius={[6, 6, 0, 0]} name="المبيعات" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="card-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">فواتير الفترة</CardTitle>
              <Button variant="ghost" size="sm" onClick={openInvoicesWithRange}>عرض الكل</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoicesInRange.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer" onClick={openInvoicesWithRange}>
                  <div>
                    <p className="text-sm font-medium">{inv.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{inv.invoice_number} • {inv.date}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{formatEGP(inv.amount)}</p>
                    <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'partial' ? 'secondary' : 'outline'} className="text-[10px]">
                      {inv.status === 'paid' ? 'مدفوعة' : inv.status === 'partial' ? 'جزئي' : 'معلقة'}
                    </Badge>
                  </div>
                </div>
              ))}
              {invoicesInRange.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد فواتير في هذه الفترة</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="card-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">صيانة مستحقة</CardTitle>
              <Button variant="ghost" size="sm" onClick={openMaintenance}>عرض الكل</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {maintenance.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer" onClick={openMaintenance}>
                  <div>
                    <p className="text-sm font-medium">{m.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{m.type}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">{m.next_date}</p>
                    <Badge variant={m.status === 'overdue' ? 'destructive' : 'outline'} className="text-[10px]">
                      {m.status === 'overdue' ? 'متأخرة' : 'قادمة'}
                    </Badge>
                  </div>
                </div>
              ))}
              {maintenance.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد صيانة</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="card-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">مخزون منخفض</CardTitle>
              <Button variant="ghost" size="sm" onClick={openInventory}>عرض المخزون</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {products.filter(p => Number(p.stock) <= Number(p.min_stock || 0)).slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer" onClick={openInventory}>
                  <p className="text-sm font-medium">{p.name}</p>
                  <Badge variant="destructive" className="text-[10px]">{p.stock} / {p.min_stock}</Badge>
                </div>
              ))}
              {lowStockItems === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا يوجد مخزون منخفض</p>}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
