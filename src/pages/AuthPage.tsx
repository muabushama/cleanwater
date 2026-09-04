import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authApi } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AuthPageProps {
  onAuth: (email: string, password: string) => Promise<{ error: any }>;
  onRegister: (
    email: string,
    password: string,
    fullName: string,
    role: 'admin' | 'sales_rep' | 'customer_service' | 'warehouse_keeper',
    branchId: string,
    phone?: string,
  ) => Promise<{ error: any }>;
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [branchId, setBranchId] = useState('1');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await authApi.getSetupStatus();
        if (!cancelled) setNeedsSetup(!!data?.needsSetup);
      } catch {
        if (!cancelled) setNeedsSetup(false);
      } finally {
        if (!cancelled) setCheckingSetup(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (needsSetup && !fullName)) return;
    setLoading(true);
    try {
      if (needsSetup) {
        const { error } = await authApi.setupAdmin({
          email,
          password,
          full_name: fullName,
          branch_id: branchId,
        });
        if (error) {
          toast({
            title: 'خطأ في إنشاء الأدمن',
            description: (error as any).message || String(error),
            variant: 'destructive',
          });
        } else {
          toast({ title: 'تم إنشاء الأدمن بنجاح' });
        }
      } else {
        const { error } = await onAuth(email, password);
        if (error) {
          toast({
            title: 'خطأ في تسجيل الدخول',
            description: error.message || String(error),
            variant: 'destructive',
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <img src={logo} alt="Clean Water" className="w-20 h-20 object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold">كلين ووتر</CardTitle>
            <p className="text-sm text-muted-foreground">
              {checkingSetup
                ? 'جاري فحص إعدادات النظام...'
                : needsSetup
                  ? 'إعداد الأدمن الأول للنظام'
                  : 'نظام إدارة متكامل لتكنولوجيا معالجة مياه الشرب'}
            </p>
          </CardHeader>
          <CardContent>
            {needsSetup ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">اسم الأدمن</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">فرع الإسكندرية</SelectItem>
                      <SelectItem value="2">فرع الجيزة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" type="email" placeholder="admin@cleanwater.com" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
                </div>
                <Button type="submit" className="w-full" disabled={loading || checkingSetup}>
                  {loading ? 'جاري إنشاء الأدمن...' : 'إنشاء الأدمن الأول'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" type="email" placeholder="admin@cleanwater.com" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
                </div>
                <Button type="submit" className="w-full" disabled={loading || checkingSetup}>
                  {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                </Button>
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  حسابات الموظفين (خدمة عملاء / مخازن / مناديب) يُنشئها الأدمن فقط من صفحة <strong>الموظفين</strong> بعد تسجيل الدخول.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
