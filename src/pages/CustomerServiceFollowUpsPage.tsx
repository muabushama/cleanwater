import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Wrench, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserBranch } from '@/hooks/useUserBranch';
import { formatEGP } from '@/data/demo-data';

type Invoice = { id: string; customer_name: string; remaining: number; status: string; date: string };
type Maintenance = { id: string; customer_name: string; next_date: string; type: string; status: string };
type WorkOrder = { id: string; customer_name: string; order_code: string; visit_date: string; status: string };

export default function CustomerServiceFollowUpsPage() {
  const { branch } = useUserBranch();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [invoicesRes, maintenanceRes, workOrdersRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(50),
        supabase.from('maintenance').select('*').eq('branch', branch).order('next_date', { ascending: true }).limit(50),
        supabase.from('work_orders').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(50),
      ]);

      setInvoices((invoicesRes.data || []) as Invoice[]);
      setMaintenance((maintenanceRes.data || []) as Maintenance[]);
      setWorkOrders((workOrdersRes.data || []) as WorkOrder[]);
      setLoading(false);
    };

    fetchData();
  }, [branch]);

  const pendingInvoices = useMemo(
    () => invoices.filter(item => item.status !== 'paid' && item.status !== 'deleted'),
    [invoices],
  );

  const pendingMaintenance = useMemo(
    () => maintenance.filter(item => item.status !== 'completed'),
    [maintenance],
  );

  const activeWorkOrders = useMemo(
    () => workOrders.filter(item => item.status !== 'completed'),
    [workOrders],
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">متابعة خدمة العملاء</h1>
        <p className="text-muted-foreground text-sm">قائمة العمل اليومية لفريق خدمة العملاء</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-10">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" /> تحصيل ومتابعة الفواتير
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvoices.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد فواتير معلقة</p> : pendingInvoices.slice(0, 10).map((invoice) => (
                <div key={invoice.id} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{invoice.customer_name}</p>
                    <Badge variant={invoice.status === 'partial' ? 'secondary' : 'outline'}>{invoice.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                    <span>{invoice.date}</span>
                    <span>{formatEGP(invoice.remaining || 0)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" /> صيانة ومكالمات التذكير
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingMaintenance.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد صيانات تحتاج متابعة</p> : pendingMaintenance.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{item.customer_name}</p>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                    <span>{item.next_date}</span>
                    <span>{item.type}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> أوامر العمل المفتوحة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeWorkOrders.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد أوامر عمل مفتوحة</p> : activeWorkOrders.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{item.customer_name}</p>
                    <Badge variant={item.status === 'in_progress' ? 'secondary' : 'outline'}>{item.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                    <span>{item.order_code}</span>
                    <span>{item.visit_date}</span>
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
