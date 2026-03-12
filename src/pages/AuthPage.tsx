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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AuthPageProps {
  onAuth: (email: string, password: string) => Promise<{ error: any }>;
  onRegister: (
    email: string,
    password: string,
    fullName: string,
    role: 'admin' | 'sales_rep' | 'customer_service',
    branchId: string,
    phone?: string,
  ) => Promise<{ error: any }>;
}

export default function AuthPage({ onAuth, onRegister }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerRole, setRegisterRole] = useState<'admin' | 'sales_rep' | 'customer_service'>('customer_service');
  const [registerBranchId, setRegisterBranchId] = useState('1');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [branchId, setBranchId] = useState('1');
  const { toast } = useToast();

  useEffect(() => {
    const checkSetup = async () => {
      const { data } = await authApi.getSetupStatus();
      setNeedsSetup(!!data?.needsSetup);
      setCheckingSetup(false);
    };

    checkSetup();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (needsSetup && !fullName)) return;
    setLoading(true);
    try {
      const { error } = needsSetup
        ? await authApi.setupAdmin({
            email,
            password,
            full_name: fullName,
            branch_id: branchId,
          })
        : await onAuth(email, password);
      if (error) {
        toast({
          title: needsSetup ? 'خطأ في إنشاء الأدمن' : 'خطأ في تسجيل الدخول',
          description: error.message,
          variant: 'destructive',
        });
      } else if (needsSetup) {
        toast({ title: 'تم إنشاء الأدمن الأول بنجاح' });
      }
    } catch (err) {
      toast({ title: 'خطأ غير متوقع', description: 'حاول مرة أخرى', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail || !registerPassword || !registerName) return;

    setLoading(true);
    try {
      const { error } = await onRegister(
        registerEmail,
        registerPassword,
        registerName,
        registerRole,
        registerBranchId,
        registerPhone,
      );

      if (error) {
        toast({ title: 'خطأ في إنشاء الحساب', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'تم إنشاء الحساب بنجاح' });
      }
    } catch {
      toast({ title: 'خطأ غير متوقع', description: 'حاول مرة أخرى', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
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
              <Tabs defaultValue="login" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                  <TabsTrigger value="register">إنشاء حساب</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
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
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="registerName">الاسم الكامل</Label>
                      <Input id="registerName" value={registerName} onChange={e => setRegisterName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>نوع الحساب</Label>
                      <Select value={registerRole} onValueChange={value => setRegisterRole(value as 'admin' | 'sales_rep' | 'customer_service')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">أدمن</SelectItem>
                          <SelectItem value="sales_rep">مندوب</SelectItem>
                          <SelectItem value="customer_service">خدمة عملاء</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>الفرع</Label>
                      <Select value={registerBranchId} onValueChange={setRegisterBranchId}>
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
                      <Label htmlFor="registerPhone">رقم الهاتف</Label>
                      <Input id="registerPhone" value={registerPhone} onChange={e => setRegisterPhone(e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registerEmail">البريد الإلكتروني</Label>
                      <Input id="registerEmail" type="email" value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registerPassword">كلمة المرور</Label>
                      <Input id="registerPassword" type="password" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} dir="ltr" />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading || checkingSetup}>
                      {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
