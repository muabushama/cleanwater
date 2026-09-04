import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatEGP } from '@/data/demo-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AddDialog } from '@/components/AddDialog';
import { useToast } from '@/hooks/use-toast';
import { useUserBranch } from '@/hooks/useUserBranch';
import { branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { normalizeStorageLocation, STORAGE_LOCATION_OPTIONS, STORAGE_MAIN } from '@/lib/storageLocation';
import { promptDeletePassword } from '@/lib/deletePassword';
import type { Field } from '@/components/AddDialog';

interface Product {
  id: string;
  name: string;
  category: string;
  classification: string;
  cost: number;
  price: number;
  price1: number;
  price2: number;
  price3: number;
  discount: number;
  warranty: number;
  stock: number;
  min_stock: number;
  image?: string | null;
  serial_number?: number | null;
  sku_code?: string | null;
  barcode?: string | null;
  storage_location?: string | null;
}

const normalizeCodeSearch = (value: string) => {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternIndic = '۰۱۲۳۴۵۶۷۸۹';
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(easternIndic.indexOf(d)))
    .replace(/\s+/g, ' ');
};

export default function ProductsPage({ isAdmin }: { isAdmin?: boolean }) {
  const { branch } = useUserBranch();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const { toast } = useToast();

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('branch', branchDbValuesForUiBranch(branch))
      .order('created_at', { ascending: false });
    if (error) {
      setProducts([]);
    } else {
      setProducts((data || []) as any as Product[]);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('inventory_categories').select('id,name,parent_id').order('sort_order');
    if (Array.isArray(data)) {
      setCategories(data as { id: string; name: string; parent_id: string | null }[]);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [branch]);

  const productFields: Field[] = useMemo(() => {
    const roots = categories.filter(c => !c.parent_id);
    const getChildren = (id: string) => categories.filter(c => c.parent_id === id);
    const catOptions = categories.length
      ? [
          ...roots.map(c => ({ value: c.name, label: c.name })),
          ...roots.flatMap(r => getChildren(r.id).map(c => ({ value: c.name, label: `  — ${c.name}` }))),
        ]
      : [
          { value: 'فلاتر مياه', label: 'فلاتر مياه' },
          { value: 'محطات تحلية', label: 'محطات تحلية' },
          { value: 'قطع غيار', label: 'قطع غيار' },
        ];

    return [
      { name: 'image', label: 'صورة المنتج', type: 'file', accept: 'image/*' },
      {
        name: 'storage_location',
        label: 'إضافة المنتج في — اختر من القائمة',
        type: 'select',
        options: STORAGE_LOCATION_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
        defaultValue: STORAGE_MAIN,
      },
      { name: 'name', label: 'اسم المنتج', required: true },
      { name: 'category', label: 'القسم (من الأقسام الموجودة)', type: 'select', options: catOptions, defaultValue: catOptions[0]?.value || 'فلاتر مياه' },
      { name: 'classification', label: 'النوع', type: 'select', options: [
        { value: 'منزلي', label: 'منزلي' },
        { value: 'تجاري', label: 'تجاري' },
        { value: 'صناعي', label: 'صناعي' },
        { value: 'فاخر', label: 'فاخر' },
        { value: 'قطع غيار', label: 'قطع غيار' },
      ], defaultValue: 'منزلي' },
      { name: 'cost', label: 'التكلفة', type: 'number', required: true },
      { name: 'price', label: 'سعر البيع الأساسي', type: 'number', required: true },
      { name: 'price1', label: 'سعر 1', type: 'number', defaultValue: '0' },
      { name: 'price2', label: 'سعر 2', type: 'number', defaultValue: '0' },
      { name: 'price3', label: 'سعر 3', type: 'number', defaultValue: '0' },
      { name: 'discount', label: 'سعر الخصم', type: 'number' },
      { name: 'warranty', label: 'الضمان (شهر)', type: 'number', defaultValue: '12' },
      { name: 'stock', label: 'المخزون', type: 'number', defaultValue: '0' },
      { name: 'min_stock', label: 'الحد الأدنى', type: 'number', defaultValue: '5' },
      { name: 'serial_number', label: 'رقم مسلسل (عرض)', type: 'number', defaultValue: '0' },
      { name: 'sku_code', label: 'كود الصنف / SKU', defaultValue: '' },
      { name: 'barcode', label: 'باركود', defaultValue: '' },
    ];
  }, [categories]);

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const raw = search.trim();
    const q = normalizeCodeSearch(raw);
    if (!q) return true;
    const haystack = normalizeCodeSearch([
      p.name || '',
      String(p.sku_code || ''),
      String(p.barcode || ''),
      String(p.serial_number ?? ''),
      p.category || '',
      p.classification || '',
      String(p.price ?? ''),
      String(p.cost ?? ''),
      String(p.id || ''),
    ].join(' | '));
    if (haystack.includes(q)) return true;
    const digitsQ = q.replace(/\D/g, '');
    if (digitsQ.length >= 2) {
      const digitBlob = [p.sku_code, p.barcode, p.serial_number, p.id, p.name]
        .map((x) => String(x ?? '').replace(/\D/g, ''))
        .join('');
      if (digitBlob.includes(digitsQ)) return true;
    }
    const tokens = q.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length > 1) {
      return tokens.every((tok) => haystack.includes(tok));
    }
    return false;
  });

  const handleAdd = async (values: Record<string, string>, files?: Record<string, File>) => {
    setSaving(true);
    try {
      let imageUrl = '';
      if (files?.image) {
        const file = files.image;
        const ext = file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }

      const newStock = Number(values.stock) || 0;

      if (editProduct) {
        const sn = Number(values.serial_number);
        const editPayload: Record<string, unknown> = {
            name: values.name,
            category: values.category || 'فلاتر مياه',
            classification: values.classification || 'منزلي',
            cost: Number(values.cost) || 0,
            price: Number(values.price) || 0,
            price1: Number(values.price1) || 0,
            price2: Number(values.price2) || 0,
            price3: Number(values.price3) || 0,
            discount: Number(values.discount) || 0,
            warranty: Number(values.warranty) || 12,
            stock: newStock,
            min_stock: Number(values.min_stock) || 5,
            image: imageUrl || editProduct.image || null,
            serial_number: Number.isFinite(sn) && sn > 0 ? sn : (editProduct as any).serial_number ?? null,
            sku_code: (values.sku_code || '').trim() || null,
            barcode: (values.barcode || '').trim() || null,
            storage_location: normalizeStorageLocation(values.storage_location),
        };
        let updateError: any;
        ({ error: updateError } = await supabase.from('products').update(editPayload as any).eq('id', editProduct.id));
        if (updateError && /sku_code|barcode|storage_location|Unknown column/i.test(updateError.message || '')) {
          delete editPayload.sku_code;
          delete editPayload.barcode;
          delete editPayload.storage_location;
          ({ error: updateError } = await supabase.from('products').update(editPayload as any).eq('id', editProduct.id));
        }
        if (updateError) throw updateError;
        toast({ title: 'تم تعديل المنتج بنجاح' });
        setEditProduct(null);
      } else {
        const { data: existing, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('name', values.name)
          .eq('category', values.category || 'فلاتر مياه')
          .in('branch', branchDbValuesForUiBranch(branch))
          .maybeSingle();
        if (fetchError) throw fetchError;

        if (existing) {
          const updatedStock = (Number((existing as any).stock) || 0) + newStock;
          const payload: Record<string, unknown> = {
              cost: Number(values.cost) || (existing as any).cost || 0,
              price: Number(values.price) || (existing as any).price || 0,
              price1: Number(values.price1) || (existing as any).price1 || 0,
              price2: Number(values.price2) || (existing as any).price2 || 0,
              price3: Number(values.price3) || (existing as any).price3 || 0,
              discount: Number(values.discount) || (existing as any).discount || 0,
              warranty: Number(values.warranty) || (existing as any).warranty || 12,
              stock: updatedStock,
              min_stock: Number(values.min_stock) || (existing as any).min_stock || 5,
              image: imageUrl || (existing as any).image || null,
              sku_code: (values.sku_code || '').trim() || (existing as any).sku_code || null,
              barcode: (values.barcode || '').trim() || (existing as any).barcode || null,
              storage_location: normalizeStorageLocation(values.storage_location),
          };
          let updateError: any;
          ({ error: updateError } = await supabase.from('products').update(payload).eq('id', (existing as any).id));
          if (updateError && /sku_code|barcode|storage_location|Unknown column/i.test(updateError.message || '')) {
            delete payload.sku_code;
            delete payload.barcode;
            delete payload.storage_location;
            ({ error: updateError } = await supabase.from('products').update(payload).eq('id', (existing as any).id));
          }
          if (updateError) throw updateError;
          toast({ title: 'تم تحديث كمية المنتج الموجود' });
        } else {
          const maxSn = products.reduce((m, p) => Math.max(m, Number((p as any).serial_number) || 0), 0);
          const nextSn = Math.max(1, maxSn + 1);
          const snNew = Number(values.serial_number);
          const insertPayload: Record<string, unknown> = {
            name: values.name,
            category: values.category || 'فلاتر مياه',
            classification: values.classification || 'منزلي',
            cost: Number(values.cost) || 0,
            price: Number(values.price) || 0,
            price1: Number(values.price1) || 0,
            price2: Number(values.price2) || 0,
            price3: Number(values.price3) || 0,
            discount: Number(values.discount) || 0,
            warranty: Number(values.warranty) || 12,
            stock: newStock,
            min_stock: Number(values.min_stock) || 5,
            image: imageUrl || null,
            branch: canonicalBranchForSave(branch),
            serial_number: Number.isFinite(snNew) && snNew > 0 ? snNew : nextSn,
            sku_code: (values.sku_code || '').trim() || null,
            barcode: (values.barcode || '').trim() || null,
            storage_location: normalizeStorageLocation(values.storage_location),
          };
          let insertErr: any;
          ({ error: insertErr } = await supabase.from('products').insert(insertPayload as any));
          if (insertErr && /sku_code|barcode|storage_location|Unknown column/i.test(insertErr.message || '')) {
            delete insertPayload.sku_code;
            delete insertPayload.barcode;
            delete insertPayload.storage_location;
            ({ error: insertErr } = await supabase.from('products').insert(insertPayload as any));
          }
          if (insertErr) throw insertErr;
          toast({ title: 'تم إضافة المنتج بنجاح' });
        }
      }
      setAddOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEditProduct = (p: Product) => {
    setEditProduct(p);
    setAddOpen(true);
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!confirm(`هل تريد حذف المنتج "${p.name}"؟`)) return;
    if (!promptDeletePassword()) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) throw error;
      toast({ title: 'تم حذف المنتج' });
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const nextSerial = useMemo(() => {
    const maxSn = products.reduce((m, p) => Math.max(m, Number((p as any).serial_number) || 0), 0);
    return String(Math.max(1, maxSn + 1));
  }, [products]);

  const productInitialValues = editProduct ? {
    name: editProduct.name,
    category: editProduct.category,
    classification: editProduct.classification,
    cost: String(editProduct.cost ?? 0),
    price: String(editProduct.price ?? 0),
    price1: String(editProduct.price1 ?? 0),
    price2: String(editProduct.price2 ?? 0),
    price3: String(editProduct.price3 ?? 0),
    discount: String(editProduct.discount ?? 0),
    warranty: String(editProduct.warranty ?? 12),
    stock: String(editProduct.stock ?? 0),
    min_stock: String(editProduct.min_stock ?? 5),
    serial_number: String((editProduct as any).serial_number ?? ''),
    sku_code: String((editProduct as any).sku_code ?? ''),
    barcode: String((editProduct as any).barcode ?? ''),
    storage_location: normalizeStorageLocation((editProduct as any).storage_location),
  } : { serial_number: nextSerial, sku_code: '', barcode: '', storage_location: STORAGE_MAIN };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-muted-foreground text-sm">{products.length} منتج</p>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={() => { setEditProduct(null); setAddOpen(true); }}>
            <Plus className="h-4 w-4" /> إضافة منتج
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث بالاسم أو القسم أو المسلسل أو SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product, i) => (
            <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="card-shadow hover:card-shadow-lg transition-shadow overflow-hidden relative">
                {isAdmin && (
                  <div className="absolute left-2 top-2 z-10 flex gap-1">
                    <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => openEditProduct(product)} title="تعديل">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProduct(product)} title="حذف">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {product.image && (
                  <div className="w-full h-40 bg-muted">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground font-mono">#{(product as any).serial_number ?? i + 1}</span>
                      <CardTitle className="text-sm leading-tight">{product.name}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0 mr-2">{product.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">التصنيف</span>
                    <span className="text-xs">{product.classification}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">سعر البيع</span>
                    <span className="text-sm font-bold text-secondary">{formatEGP(product.price)}</span>
                  </div>
                  {/* 3 Price Tiers */}
                  <div className="grid grid-cols-3 gap-1 bg-muted/50 rounded p-1.5">
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground">سعر 1</p>
                      <p className="text-[11px] font-bold">{product.price1 ? formatEGP(product.price1) : '-'}</p>
                    </div>
                    <div className="text-center border-x border-border">
                      <p className="text-[9px] text-muted-foreground">سعر 2</p>
                      <p className="text-[11px] font-bold">{product.price2 ? formatEGP(product.price2) : '-'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground">سعر 3</p>
                      <p className="text-[11px] font-bold">{product.price3 ? formatEGP(product.price3) : '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">التكلفة</span>
                    <span className="text-xs">{formatEGP(product.cost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">المخزون</span>
                    <Badge variant={product.stock <= product.min_stock ? 'destructive' : 'outline'} className="text-[10px]">
                      {product.stock} وحدة
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">الضمان</span>
                    <span className="text-xs">{product.warranty} شهر</span>
                  </div>
                  {product.sku_code && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">كود المنتج</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{product.sku_code}</Badge>
                    </div>
                  )}
                  {product.barcode && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">باركود</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{product.barcode}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <AddDialog
        key={editProduct?.id ?? `new-${nextSerial}`}
        open={addOpen}
        onOpenChange={open => { setAddOpen(open); if (!open) setEditProduct(null); }}
        title={editProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}
        fields={productFields}
        onSubmit={handleAdd}
        loading={saving}
        initialValues={productInitialValues}
      />
    </motion.div>
  );
}
