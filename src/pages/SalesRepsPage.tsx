import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { topReps as demoReps, formatEGP } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, UserPlus } from 'lucide-react';
import { AddDialog } from '@/components/AddDialog';
import { useToast } from '@/hooks/use-toast';

interface Rep {
  id: string;
  full_name: string;
  branch_id: string;
  phone?: string;
}

const repFields = [
  { name: 'full_name', label: 'اسم المندوب', required: true },
  { name: 'email', label: 'البريد الإلكتروني', required: true },
  { name: 'password', label: 'كلمة المرور', required: true },
  { name: 'phone', label: 'رقم الهاتف' },
  { name: 'branch_id', label: 'الفرع', type: 'select' as const, options: [
    { value: '1', label: 'فرع الإسكندرية' },
    { value: '2', label: 'فرع الجيزة' },
  ], defaultValue: '1' },
];

export default function SalesRepsPage({ isAdmin }: { isAdmin?: boolean }) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchReps = async () => {
    // Get profiles that have sales_rep role
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'sales_rep');
    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
      if (profiles) {
        setReps(profiles as Rep[]);
        setLoading(false);
        return;
      }
    }
    // Fallback to demo data
    setReps(demoReps.map((r, i) => ({ id: String(i), full_name: r.name, branch_id: '1', phone: '' })));
    setLoading(false);
  };

  useEffect(() => { fetchReps(); }, []);

  const handleAddRep = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_rep',
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          branch_id: values.branch_id || '1',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'تم إنشاء حساب المندوب بنجاح', description: `الإيميل: ${values.email}` });
      setAddOpen(false);
      fetchReps();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const branchName = (id: string) => id === '1' ? 'الإسكندرية' : id === '2' ? 'الجيزة' : 'غير محدد';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المناديب</h1>
        {isAdmin && (
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> إضافة مندوب
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reps.map((rep, i) => (
            <motion.div key={rep.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="card-shadow">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                      {rep.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold">{rep.full_name}</h3>
                      <p className="text-xs text-muted-foreground">فرع {branchName(rep.branch_id)}</p>
                    </div>
                  </div>
                  {rep.phone && <p className="text-xs text-muted-foreground">{rep.phone}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="gap-1 text-[10px]"><Clock className="h-3 w-3" /> مندوب</Badge>
                    <Badge variant="outline" className="gap-1 text-[10px]"><MapPin className="h-3 w-3" /> {branchName(rep.branch_id)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {isAdmin && (
        <AddDialog open={addOpen} onOpenChange={setAddOpen} title="إضافة مندوب جديد" fields={repFields} onSubmit={handleAddRep} loading={saving} />
      )}
    </motion.div>
  );
}
