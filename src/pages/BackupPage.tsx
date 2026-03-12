import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Download, Trash2, Key, Shield, AlertTriangle, Database, HardDrive, Lock
} from 'lucide-react';

export default function BackupPage() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // ===== EXPORT DATA =====
  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-backup', {
        body: { action: 'export' },
      });

      if (error) throw error;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `clean-water-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'تم تحميل النسخة الاحتياطية',
        description: `تم تصدير ${data.total_records} سجل بنجاح`,
      });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // ===== DELETE ALL DATA =====
  const handleDelete = async () => {
    if (!deletePassword) {
      toast({ title: 'خطأ', description: 'أدخل كلمة السر', variant: 'destructive' });
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-backup', {
        body: { action: 'delete-all', password: deletePassword },
      });

      if (error) throw error;
      if (data.error) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'تم مسح جميع البيانات', description: 'تم حذف كل البيانات بنجاح' });
      setDeleteOpen(false);
      setDeletePassword('');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // ===== CHANGE PASSWORD =====
  const handleChangePassword = async () => {
    if (!currentPass || !newPass) {
      toast({ title: 'خطأ', description: 'أدخل كلمة السر الحالية والجديدة', variant: 'destructive' });
      return;
    }
    if (newPass !== confirmPass) {
      toast({ title: 'خطأ', description: 'كلمة السر الجديدة غير متطابقة', variant: 'destructive' });
      return;
    }
    setChangingPass(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-backup', {
        body: { action: 'change-password', password: currentPass, newPassword: newPass },
      });

      if (error) throw error;
      if (data.error) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'تم تغيير كلمة السر بنجاح' });
      setChangePassOpen(false);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> النسخ الاحتياطي
        </h1>
        <p className="text-muted-foreground text-sm">إدارة النسخ الاحتياطية وحماية البيانات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Download Backup */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="card-shadow hover:card-shadow-lg transition-shadow border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                تحميل نسخة احتياطية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                قم بتحميل نسخة كاملة من جميع بيانات النظام (العملاء، الأجهزة، الفواتير، الصيانة، أوامر العمل، المنتجات) كملف JSON يمكنك الاحتفاظ به على جهازك.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <HardDrive className="h-4 w-4 flex-shrink-0" />
                <span>يتم تحميل الملف مباشرة على جهازك بدون حاجة للإنترنت لاحقاً</span>
              </div>
              <Button className="w-full gap-2" onClick={handleExport} disabled={exporting}>
                <Download className="h-4 w-4" />
                {exporting ? 'جاري التحميل...' : 'تحميل النسخة الاحتياطية'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Delete All Data */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="card-shadow hover:card-shadow-lg transition-shadow border-destructive/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                مسح جميع البيانات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                حذف جميع البيانات من النظام بالكامل: العملاء، الأجهزة، الفواتير، الصيانة، أوامر العمل، وسجلات المناديب. هذا الإجراء لا يمكن التراجع عنه.
              </p>
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>تحذير: سيتم حذف جميع البيانات نهائياً! ننصح بعمل نسخة احتياطية أولاً.</span>
              </div>
              <Button variant="destructive" className="w-full gap-2" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                مسح جميع البيانات
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Change Password */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="card-shadow hover:card-shadow-lg transition-shadow border-accent/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-2 rounded-lg bg-accent/50">
                  <Key className="h-5 w-5 text-foreground" />
                </div>
                تغيير كلمة سر الحذف
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                قم بتغيير كلمة السر المطلوبة لعملية مسح البيانات. يجب إدخال كلمة السر الحالية أولاً قبل تعيين كلمة سر جديدة.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <Lock className="h-4 w-4 flex-shrink-0" />
                <span>كلمة السر تحمي عملية مسح البيانات من الاستخدام غير المصرح</span>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={() => setChangePassOpen(true)}>
                <Key className="h-4 w-4" />
                تغيير كلمة السر
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد مسح جميع البيانات
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-sm text-destructive space-y-2">
              <p className="font-bold">⚠️ تحذير خطير!</p>
              <p>سيتم حذف جميع البيانات التالية نهائياً:</p>
              <ul className="list-disc list-inside text-xs space-y-1 mr-2">
                <li>جميع العملاء وبياناتهم</li>
                <li>جميع الأجهزة وسجلات الصيانة</li>
                <li>جميع الفواتير والأقساط</li>
                <li>جميع أوامر العمل</li>
                <li>جميع سجلات المناديب والتتبع</li>
              </ul>
              <p className="font-bold">هذا الإجراء لا يمكن التراجع عنه!</p>
            </div>
            <div>
              <Label className="text-sm">أدخل كلمة السر للتأكيد</Label>
              <Input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="كلمة السر..."
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1 gap-2" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4" />
                {deleting ? 'جاري الحذف...' : 'تأكيد المسح'}
              </Button>
              <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeletePassword(''); }}>
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePassOpen} onOpenChange={setChangePassOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              تغيير كلمة سر الحذف
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">كلمة السر الحالية</Label>
              <Input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="أدخل كلمة السر الحالية" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">كلمة السر الجديدة</Label>
              <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="أدخل كلمة السر الجديدة" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">تأكيد كلمة السر الجديدة</Label>
              <Input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="أعد إدخال كلمة السر الجديدة" className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={handleChangePassword} disabled={changingPass}>
                <Key className="h-4 w-4" />
                {changingPass ? 'جاري التغيير...' : 'تغيير كلمة السر'}
              </Button>
              <Button variant="outline" onClick={() => { setChangePassOpen(false); setCurrentPass(''); setNewPass(''); setConfirmPass(''); }}>
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
