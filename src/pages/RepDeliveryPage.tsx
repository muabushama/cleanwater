import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP, companyInfo } from '@/data/demo-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';
import {
  Package, MapPin, Phone, Check, X, Truck, Navigation, Clock, History,
  ShoppingCart, Plus, Printer, FileText, Search,
} from 'lucide-react';

type DeliveryStatus = 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'rejected';

interface Order {
  id: string;
  order_code: string;
  customer_name: string;
  address: string;
  location_url?: string;
  phone: string;
  region?: string;
  product_name: string;
  total: number;
  notes?: string;
  visit_date: string;
  delivery_status: DeliveryStatus;
  technician?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  price1: number;
  price2: number;
  price3: number;
  stock: number;
  category: string;
  image?: string | null;
}

interface SaleInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  product_name: string;
  amount: number;
  paid: number;
  remaining: number;
  date: string;
  branch: string;
  rep_name: string;
  status: string;
}

const statusMap: Record<DeliveryStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'في انتظار الموافقة', variant: 'outline' },
  accepted: { label: 'تم القبول', variant: 'secondary' },
  in_transit: { label: 'جاري التوصيل', variant: 'default' },
  delivered: { label: 'تم التسليم', variant: 'default' },
  rejected: { label: 'مرفوض', variant: 'destructive' },
};

export default function RepDeliveryPage({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [myInvoices, setMyInvoices] = useState<SaleInvoice[]>([]);
  const [profile, setProfile] = useState<{ full_name: string; branch_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<SaleInvoice | null>(null);
  const { toast } = useToast();

  // Sale form
  const [saleForm, setSaleForm] = useState({
    customer_name: '', phone: '', address: '',
    product_id: '', product_name: '', quantity: 1,
    price_tier: 'price' as 'price' | 'price1' | 'price2' | 'price3',
    unit_price: 0, total: 0, paid: 0, notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const fetchAll = async () => {
    const [activeRes, historyRes, prodRes, profileRes] = await Promise.all([
      supabase.from('work_orders').select('*').eq('assigned_rep', userId).in('delivery_status', ['pending', 'accepted', 'in_transit']).order('created_at', { ascending: false }),
      supabase.from('work_orders').select('*').eq('assigned_rep', userId).in('delivery_status', ['delivered', 'rejected']).order('created_at', { ascending: false }).limit(50),
      supabase.from('products').select('*').order('name'),
      supabase.from('profiles').select('full_name, branch_id').eq('id', userId).single(),
    ]);
    if (activeRes.data) setOrders(activeRes.data as unknown as Order[]);
    if (historyRes.data) setDeliveredOrders(historyRes.data as unknown as Order[]);
    if (prodRes.data) setProducts(prodRes.data as any as Product[]);
    if (profileRes.data) setProfile(profileRes.data as any);

    // Fetch my invoices
    const repName = profileRes.data?.full_name || '';
    if (repName) {
      const { data: invData } = await supabase.from('invoices').select('*').eq('rep_name', repName).order('created_at', { ascending: false }).limit(50);
      if (invData) setMyInvoices(invData as any as SaleInvoice[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [userId]);

  const updateStatus = async (orderId: string, status: DeliveryStatus) => {
    setUpdating(true);
    try {
      const { error } = await supabase.from('work_orders').update({ delivery_status: status } as any).eq('id', orderId);
      if (error) throw error;
      toast({ title: status === 'delivered' ? 'تم تسليم الأوردر بنجاح ✅' : status === 'rejected' ? 'تم رفض الأوردر' : 'تم تحديث الحالة' });
      fetchAll();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const selectProduct = (product: Product) => {
    const tier = saleForm.price_tier;
    const unitPrice = (product as any)[tier] || product.price;
    setSaleForm(p => ({
      ...p,
      product_id: product.id,
      product_name: product.name,
      unit_price: unitPrice,
      total: unitPrice * p.quantity,
    }));
    setProductSearch(product.name);
  };

  const changePriceTier = (tier: string) => {
    const product = products.find(p => p.id === saleForm.product_id);
    if (product) {
      const unitPrice = (product as any)[tier] || product.price;
      setSaleForm(p => ({ ...p, price_tier: tier as any, unit_price: unitPrice, total: unitPrice * p.quantity }));
    } else {
      setSaleForm(p => ({ ...p, price_tier: tier as any }));
    }
  };

  const changeQuantity = (qty: number) => {
    setSaleForm(p => ({ ...p, quantity: qty, total: p.unit_price * qty }));
  };

  const handleCreateSale = async () => {
    if (!saleForm.customer_name || !saleForm.product_id) {
      toast({ title: 'خطأ', description: 'يرجى ملء اسم العميل واختيار المنتج', variant: 'destructive' });
      return;
    }

    const product = products.find(p => p.id === saleForm.product_id);
    if (product && product.stock < saleForm.quantity) {
      toast({ title: 'خطأ', description: `المخزون غير كافي (${product.stock} وحدة متاحة)`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const remaining = saleForm.total - saleForm.paid;
      const status = remaining <= 0 ? 'paid' : saleForm.paid > 0 ? 'partial' : 'pending';
      const invoiceNumber = `INV-REP-${Date.now().toString().slice(-6)}`;
      const branchName = profile?.branch_id === '2' ? 'فرع الجيزة' : 'فرع الإسكندرية';

      // Create invoice
      const { error: invError } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber,
        customer_name: saleForm.customer_name,
        product_name: saleForm.product_name,
        amount: saleForm.total,
        paid: saleForm.paid,
        remaining,
        type: 'cash',
        status,
        branch: branchName,
        rep_name: profile?.full_name || '',
        date: new Date().toISOString().split('T')[0],
        created_by: userId,
      });
      if (invError) throw invError;

      // Deduct stock
      if (product) {
        const newStock = Math.max(0, product.stock - saleForm.quantity);
        const { error: stockError } = await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
        if (stockError) throw stockError;
      }

      toast({ title: `تم تسجيل البيع بنجاح ✅ فاتورة ${invoiceNumber}` });
      setShowSaleDialog(false);
      setSaleForm({ customer_name: '', phone: '', address: '', product_id: '', product_name: '', quantity: 1, price_tier: 'price', unit_price: 0, total: 0, paid: 0, notes: '' });
      setProductSearch('');
      fetchAll();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintInvoice = (inv: SaleInvoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl"><head><title>فاتورة ${inv.invoice_number}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
        body { padding: 20px; color: #1a1a2e; }
        .container { max-width: 700px; margin: 0 auto; border: 2px solid #1a3a5c; padding: 25px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a3a5c; padding-bottom: 12px; margin-bottom: 15px; }
        .company { font-size: 20px; font-weight: 800; color: #1a3a5c; }
        .title { background: linear-gradient(135deg, #1a3a5c, #2d5f8a); color: white; padding: 6px 25px; border-radius: 6px; font-size: 18px; font-weight: 700; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 12px 0; font-size: 13px; }
        .label { font-weight: 600; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { padding: 8px; border: 1px solid #ddd; font-size: 12px; text-align: right; }
        th { background: #f0f4f8; }
        .amounts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 12px 0; }
        .amount-box { text-align: center; padding: 8px; border-radius: 6px; color: white; }
        .total { background: #1a3a5c; } .paid { background: #2d8a6e; } .rem { background: #c0392b; }
        .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: center; margin-top: 30px; font-size: 11px; color: #666; }
        .sig-line { border-top: 1px dashed #999; margin-top: 40px; padding-top: 4px; }
        .footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 9px; color: #888; text-align: center; }
      </style></head><body>
      <div class="container">
        <div class="header">
          <div><div class="company">كلين ووتر</div><div style="font-size:10px;color:#666">لتكنولوجيا معالجة مياه الشرب</div></div>
          <div class="title">فاتورة بيع</div>
        </div>
        <div class="grid">
          <div><span class="label">رقم الفاتورة: </span>${inv.invoice_number}</div>
          <div><span class="label">التاريخ: </span>${inv.date}</div>
          <div><span class="label">العميل: </span><strong>${inv.customer_name}</strong></div>
          <div><span class="label">المندوب: </span>${inv.rep_name}</div>
          <div><span class="label">الفرع: </span>${inv.branch}</div>
        </div>
        <table><thead><tr><th>#</th><th>المنتج</th><th>القيمة</th></tr></thead>
        <tbody><tr><td>1</td><td>${inv.product_name}</td><td style="font-weight:700">${inv.amount.toLocaleString()} ج.م</td></tr></tbody></table>
        <div class="amounts">
          <div class="amount-box total"><div style="font-size:10px;opacity:0.9">الإجمالي</div><div style="font-size:16px;font-weight:800">${inv.amount.toLocaleString()} ج.م</div></div>
          <div class="amount-box paid"><div style="font-size:10px;opacity:0.9">المدفوع</div><div style="font-size:16px;font-weight:800">${inv.paid.toLocaleString()} ج.م</div></div>
          <div class="amount-box rem"><div style="font-size:10px;opacity:0.9">المتبقي</div><div style="font-size:16px;font-weight:800">${inv.remaining.toLocaleString()} ج.م</div></div>
        </div>
        <div class="sigs">
          <div><div style="font-weight:600">توقيع العميل</div><div class="sig-line">التوقيع</div></div>
          <div><div style="font-weight:600">توقيع المندوب</div><div class="sig-line">التوقيع</div></div>
        </div>
        <div class="footer">
          <p>${companyInfo.branches.join(' | ')}</p>
          <p>الخط الساخن: ${companyInfo.hotline}</p>
        </div>
      </div></body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const buildMapUrl = (locationUrl?: string, address?: string) => {
    const trimmed = (locationUrl || '').trim();
    if (trimmed) {
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;
  };

  const openExternalLink = (url: string) => {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed) {
      try { if (window.self !== window.top && window.top) { window.top.location.href = url; return; } } catch {}
      window.location.href = url;
    }
  };

  const pendingOrders = orders.filter(o => o.delivery_status === 'pending');
  const activeOrders = orders.filter(o => o.delivery_status === 'accepted' || o.delivery_status === 'in_transit');

  const filteredProducts = productSearch
    ? products.filter(p => p.name.includes(productSearch) || p.category.includes(productSearch)).slice(0, 10)
    : [];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-2xl mx-auto">
      {/* Quick Sale Button */}
      <Button className="w-full gap-2 h-12 text-base" onClick={() => setShowSaleDialog(true)}>
        <ShoppingCart className="h-5 w-5" /> تسجيل بيع جديد
      </Button>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="active" className="gap-1 text-xs">
            <Truck className="h-3.5 w-3.5" /> الأوردرات ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1 text-xs">
            <FileText className="h-3.5 w-3.5" /> مبيعاتي ({myInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 text-xs">
            <History className="h-3.5 w-3.5" /> السجل
          </TabsTrigger>
        </TabsList>

        {/* Active Orders Tab */}
        <TabsContent value="active" className="space-y-4 mt-4">
          {activeOrders.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-lg flex items-center gap-2"><Navigation className="h-5 w-5 text-primary" /> توصيل نشط</h2>
              {activeOrders.map(order => (
                <OrderCard key={order.id} order={order} updating={updating} onUpdateStatus={updateStatus} getMapUrl={buildMapUrl} onOpenMap={openExternalLink} isActive />
              ))}
            </div>
          )}
          {pendingOrders.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-lg">أوردرات جديدة ({pendingOrders.length})</h2>
              <AnimatePresence>
                {pendingOrders.map(order => (
                  <OrderCard key={order.id} order={order} updating={updating} onUpdateStatus={updateStatus} getMapUrl={buildMapUrl} onOpenMap={openExternalLink} />
                ))}
              </AnimatePresence>
            </div>
          )}
          {orders.length === 0 && (
            <Card className="card-shadow"><CardContent className="p-12 text-center">
              <Truck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-bold">لا توجد أوردرات حالياً</p>
              <p className="text-sm text-muted-foreground mt-1">ستظهر الأوردرات الجديدة هنا عند تعيينها لك</p>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* My Sales Tab */}
        <TabsContent value="sales" className="space-y-3 mt-4">
          {myInvoices.length === 0 ? (
            <Card className="card-shadow"><CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لا توجد مبيعات بعد</p>
              <Button className="mt-3 gap-2" onClick={() => setShowSaleDialog(true)}><Plus className="h-4 w-4" /> سجّل أول بيع</Button>
            </CardContent></Card>
          ) : (
            myInvoices.map(inv => (
              <Card key={inv.id} className="card-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{inv.invoice_number}</p>
                        <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'partial' ? 'secondary' : 'outline'} className="text-[10px]">
                          {inv.status === 'paid' ? 'مدفوعة' : inv.status === 'partial' ? 'جزئي' : 'معلقة'}
                        </Badge>
                      </div>
                      <p className="text-sm">{inv.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{inv.product_name} • {inv.date}</p>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span>الإجمالي: <strong>{formatEGP(inv.amount)}</strong></span>
                        <span className="text-secondary">المدفوع: {formatEGP(inv.paid)}</span>
                        {inv.remaining > 0 && <span className="text-destructive">المتبقي: {formatEGP(inv.remaining)}</span>}
                      </div>
                    </div>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePrintInvoice(inv)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {deliveredOrders.length === 0 ? (
            <Card className="card-shadow"><CardContent className="p-12 text-center">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لا يوجد سجل أوردرات</p>
            </CardContent></Card>
          ) : (
            deliveredOrders.map(order => (
              <Card key={order.id} className="card-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">#{order.order_code} • {order.product_name}</p>
                      <p className="text-xs text-muted-foreground">{order.address}</p>
                    </div>
                    <Badge variant={statusMap[order.delivery_status]?.variant || 'outline'}>
                      {statusMap[order.delivery_status]?.label || order.delivery_status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create Sale Dialog */}
      <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تسجيل بيع جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">اسم العميل *</Label>
              <Input value={saleForm.customer_name} onChange={e => setSaleForm(p => ({ ...p, customer_name: e.target.value }))} className="h-8 text-sm" placeholder="اسم العميل" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">رقم الهاتف</Label>
                <Input value={saleForm.phone} onChange={e => setSaleForm(p => ({ ...p, phone: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">العنوان</Label>
                <Input value={saleForm.address} onChange={e => setSaleForm(p => ({ ...p, address: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>

            {/* Product Search */}
            <div className="relative">
              <Label className="text-xs">المنتج *</Label>
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setSaleForm(p => ({ ...p, product_id: '', product_name: '' })); }}
                  className="h-8 text-sm pr-8"
                  placeholder="ابحث عن المنتج..."
                />
              </div>
              {productSearch && !saleForm.product_id && filteredProducts.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button key={p.id} className="w-full text-right p-2 hover:bg-accent/50 text-xs border-b last:border-0" onClick={() => selectProduct(p)}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{p.name}</span>
                        <Badge variant={p.stock > 0 ? 'outline' : 'destructive'} className="text-[9px]">{p.stock} وحدة</Badge>
                      </div>
                      <div className="flex gap-2 text-muted-foreground mt-0.5">
                        <span>سعر: {formatEGP(p.price)}</span>
                        {p.price1 > 0 && <span>س1: {formatEGP(p.price1)}</span>}
                        {p.price2 > 0 && <span>س2: {formatEGP(p.price2)}</span>}
                        {p.price3 > 0 && <span>س3: {formatEGP(p.price3)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {saleForm.product_id && (
              <>
                {/* Price Tier Selection */}
                <div>
                  <Label className="text-xs">اختر السعر</Label>
                  <Select value={saleForm.price_tier} onValueChange={changePriceTier}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">سعر البيع ({formatEGP(products.find(p => p.id === saleForm.product_id)?.price || 0)})</SelectItem>
                      {(products.find(p => p.id === saleForm.product_id)?.price1 || 0) > 0 && (
                        <SelectItem value="price1">سعر 1 ({formatEGP(products.find(p => p.id === saleForm.product_id)?.price1 || 0)})</SelectItem>
                      )}
                      {(products.find(p => p.id === saleForm.product_id)?.price2 || 0) > 0 && (
                        <SelectItem value="price2">سعر 2 ({formatEGP(products.find(p => p.id === saleForm.product_id)?.price2 || 0)})</SelectItem>
                      )}
                      {(products.find(p => p.id === saleForm.product_id)?.price3 || 0) > 0 && (
                        <SelectItem value="price3">سعر 3 ({formatEGP(products.find(p => p.id === saleForm.product_id)?.price3 || 0)})</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">الكمية</Label>
                    <Input type="number" min={1} value={saleForm.quantity} onChange={e => changeQuantity(Number(e.target.value) || 1)} className="h-8 text-sm" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-xs">سعر الوحدة</Label>
                    <Input type="number" value={saleForm.unit_price} readOnly className="h-8 text-sm bg-muted/50" dir="ltr" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">المدفوع</Label>
                  <Input type="number" value={saleForm.paid} onChange={e => setSaleForm(p => ({ ...p, paid: Number(e.target.value) || 0 }))} className="h-8 text-sm" dir="ltr" />
                </div>

                {/* Calculation Preview */}
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>الإجمالي:</span><span className="font-bold">{formatEGP(saleForm.total)}</span></div>
                  <div className="flex justify-between"><span>المدفوع:</span><span className="font-bold text-secondary">{formatEGP(saleForm.paid)}</span></div>
                  <div className="flex justify-between border-t pt-1"><span>المتبقي:</span><span className="font-bold text-destructive">{formatEGP(saleForm.total - saleForm.paid)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>المخزون الحالي: {products.find(p => p.id === saleForm.product_id)?.stock} وحدة</span>
                    <span>بعد البيع: {Math.max(0, (products.find(p => p.id === saleForm.product_id)?.stock || 0) - saleForm.quantity)} وحدة</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowSaleDialog(false)}>إلغاء</Button>
              <Button onClick={handleCreateSale} disabled={saving} className="gap-2">
                {saving ? 'جاري الحفظ...' : <><ShoppingCart className="h-4 w-4" /> تسجيل البيع</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ===== Order Card Component =====
function OrderCard({ order, updating, onUpdateStatus, getMapUrl, onOpenMap, isActive }: {
  order: Order; updating: boolean; onUpdateStatus: (id: string, status: DeliveryStatus) => void;
  getMapUrl: (locationUrl?: string, address?: string) => string; onOpenMap: (url: string) => void; isActive?: boolean;
}) {
  const mapsUrl = getMapUrl(order.location_url, order.address);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }}>
      <Card className={`card-shadow ${isActive ? 'border-2 border-primary' : ''}`}>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className={`font-bold ${isActive ? 'text-lg' : ''}`}>{order.customer_name}</p>
              <p className="text-xs text-muted-foreground">#{order.order_code} • {order.visit_date}</p>
            </div>
            <Badge variant={statusMap[order.delivery_status]?.variant || 'outline'}>{statusMap[order.delivery_status]?.label}</Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{order.product_name}</span></div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{order.address}</span>{order.region && <Badge variant="outline" className="text-[10px]">{order.region}</Badge>}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" /><a href={`tel:${order.phone}`} className="text-primary underline">{order.phone}</a></div>
            {order.notes && <p className="text-xs bg-accent/50 p-2 rounded-lg">{order.notes}</p>}
            {isActive && <div className="flex items-center gap-2 font-bold"><span>الإجمالي:</span><span dir="ltr">{order.total.toLocaleString()} ج.م</span></div>}
          </div>
          <div className="flex gap-2 pt-1">
            {order.delivery_status === 'pending' && (
              <>
                <Button className="flex-1 gap-2" onClick={() => onUpdateStatus(order.id, 'accepted')} disabled={updating}><Check className="h-4 w-4" /> قبول</Button>
                <Button className="flex-1 gap-2" variant="destructive" onClick={() => onUpdateStatus(order.id, 'rejected')} disabled={updating}><X className="h-4 w-4" /> رفض</Button>
              </>
            )}
            {order.delivery_status === 'accepted' && (
              <>
                <Button className="flex-1 gap-2" variant="outline" onClick={() => onOpenMap(mapsUrl)}><Navigation className="h-4 w-4" /> فتح الخريطة</Button>
                <Button className="flex-1 gap-2" onClick={() => onUpdateStatus(order.id, 'in_transit')} disabled={updating}><Truck className="h-4 w-4" /> بدء التوصيل</Button>
              </>
            )}
            {order.delivery_status === 'in_transit' && (
              <>
                <Button className="flex-1 gap-2" variant="outline" onClick={() => onOpenMap(mapsUrl)}><Navigation className="h-4 w-4" /> الخريطة</Button>
                <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => onUpdateStatus(order.id, 'delivered')} disabled={updating}><Check className="h-4 w-4" /> تم التسليم</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
