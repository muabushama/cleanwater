import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, Wrench, ClipboardList, PhoneCall, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { formatEGP } from '@/data/demo-data';

type Customer = { id: string; name: string; phone1: string; created_at?: string };
type Invoice = { id: string; customer_name: string; amount: number; remaining: number; status: string; date: string };
type Maintenance = { id: string; customer_name: string; type: string; next_date: string; status: string };
type WorkOrder = { id: string; customer_name: string; order_code: string; visit_date: string; status: string };

export default function CustomerServiceDashboardPage() {
  const { branch } = useUserBranch();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [customersRes, invoicesRes, maintenanceRes, workOrdersRes] = await Promise.all([
        supabase.from('customers').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(6),
        supabase.from('invoices').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(8),
        supabase.from('maintenance').select('*').eq('branch', branch).order('next_date', { ascending: true }).limit(8),
        supabase.from('work_orders').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(8),
      ]);

      setCustomers((customersRes.data || []) as Customer[]);
      setInvoices((invoicesRes.data || []) as Invoice[]);
      setMaintenance((maintenanceRes.data || []) as Maintenance[]);
      setWorkOrders((workOrdersRes.data || []) as WorkOrder[]);
      setLoading(false);
    };

    fetchData();
  }, [branch]);

  const stats = useMemo(() => {
    const pendingInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'deleted');
    const upcomingMaintenance = maintenance.filter(item => item.status !== 'completed');
    const openOrders = workOrders.filter(order => order.status !== 'completed');

    return {
      customers: customers.length,
      pendingInvoices: pendingInvoices.length,
      pendingAmount: pendingInvoices.reduce((sum, inv) => sum + (inv.remaining || 0), 0),
      upcomingMaintenance: upcomingMaintenance.length,
      openOrders: openOrders.length,
    };
  }, [customers, invoices, maintenance, workOrders]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة خدمة العملاء</h1>
        <p className="text-muted-foreground text-sm">ملخص سريع للمتابعة اليومية في {branch}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { title: 'عملاء حديثون', value: stats.customers, icon: Users },
          { title: 'فواتير معلقة', value: stats.pendingInvoices, icon: FileText },
          { title: 'متبقي التحصيل', value: formatEGP(stats.pendingAmount), icon: PhoneCall },
          { title: 'صيانة قادمة', value: stats.upcomingMaintenance, icon: Wrench },
          { title: 'أوامر مفتوحة', value: stats.openOrders, icon: ClipboardList },
        ].map((item) => (
          <Card key={item.title} className="card-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{item.title}</p>
                <p className="text-xl font-bold mt-1">{item.value}</p>
              </div>
              <item.icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-10">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base">آخر العملاء</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customers.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد عملاء بعد</p> : customers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                  <div>
                    <p className="font-medium text-sm">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.phone1}</p>
                  </div>
                  <Badge variant="outline">عميل</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base">الفواتير التي تحتاج متابعة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'deleted').slice(0, 6).map((invoice) => (
                <div key={invoice.id} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{invoice.customer_name}</p>
                    <Badge variant={invoice.status === 'partial' ? 'secondary' : 'outline'}>{invoice.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{invoice.date}</span>
                    <span>المتبقي: {formatEGP(invoice.remaining || 0)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base">المتابعات القادمة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {maintenance.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{item.customer_name}</p>
                    <Badge variant={item.status === 'completed' ? 'default' : 'outline'}>{item.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{item.next_date}</span>
                    <span>•</span>
                    <span>{item.type}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
