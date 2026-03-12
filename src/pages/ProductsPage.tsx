import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { products as demoProducts, formatEGP } from '@/data/demo-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AddDialog } from '@/components/AddDialog';
import { useToast } from '@/hooks/use-toast';
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
}

export default function ProductsPage({ isAdmin }: { isAdmin?: boolean }) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const { toast } = useToast();

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setProducts(data as any as Product[]);
    } else if (!error) {
      setProducts(demoProducts.map(p => ({ ...p, min_stock: p.minStock, price1: 0, price2: 0, price3: 0 })));
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
  }, []);

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
    ];
  }, [categories]);

  const filtered = products.filter(p => p.name.includes(search) || p.category.includes(search));

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

      const { error } = await supabase.from('products').insert({
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
        stock: Number(values.stock) || 0,
        min_stock: Number(values.min_stock) || 5,
        image: imageUrl || null,
      } as any);
      if (error) throw error;
      toast({ title: 'تم إضافة المنتج بنجاح' });
      setAddOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-muted-foreground text-sm">{products.length} منتج</p>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> إضافة منتج
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث عن منتج..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product, i) => (
            <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="card-shadow hover:card-shadow-lg transition-shadow cursor-pointer overflow-hidden">
                {product.image && (
                  <div className="w-full h-40 bg-muted">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm leading-tight">{product.name}</CardTitle>
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
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <AddDialog open={addOpen} onOpenChange={setAddOpen} title="إضافة منتج جديد" fields={productFields} onSubmit={handleAdd} loading={saving} />
    </motion.div>
  );
}
