import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Settings2, Plus, Edit, Trash2 } from 'lucide-react';
import { useUserBranch } from '@/hooks/useUserBranch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { InventoryCategoriesBar } from '@/components/inventory/InventoryCategoriesBar';
import { ProductGrid } from '@/components/inventory/ProductGrid';

interface ProductRow {
  id: string;
  name: string;
  category: string;
  classification: string;
  stock: number;
  min_stock: number;
  cost: number;
  branch?: string;
}

interface InventoryCategory {
  id: string;
  name: string;
  icon_key: string;
  parent_id: string | null;
  sort_order: number;
}

export default function InventoryPage() {
  const { branch } = useUserBranch();
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  // لم يعد هناك اختيار "نوع القسم" من الواجهة، parent_id يُحافظ عليه فقط أثناء التعديل
  const [catForm, setCatForm] = useState({ name: '', icon_key: 'default', sort_order: 0 });
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    cost: '',
    priceRetail: '',
    priceWholesale: '',
  });
  const [productImage, setProductImage] = useState<File | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*').limit(1000),
        supabase.from('inventory_categories').select('*').order('sort_order'),
      ]);
      setProducts(Array.isArray(prodRes.data) ? (prodRes.data as ProductRow[]) : []);
      setCategories(Array.isArray(catRes.data) ? (catRes.data as InventoryCategory[]) : []);
    } catch {
      setProducts([]);
      setCategories([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [branch]);

  const roots = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const selectedCat = selectedCategoryId ? categories.find(c => c.id === selectedCategoryId) : null;
  const categoryNamesToFilter = useMemo(() => {
    if (!selectedCat) return null;
    const names = [selectedCat.name];
    const children = getChildren(selectedCat.id);
    children.forEach(c => names.push(c.name));
    return names;
  }, [selectedCategoryId, categories]);
  const filteredProducts = categoryNamesToFilter
    ? products.filter(p => categoryNamesToFilter.includes(p.category) || categoryNamesToFilter.includes(p.classification))
    : products;

  const lowStock = products.filter(p => Number(p.stock) <= Number(p.min_stock || 0));

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      cost: '',
      priceRetail: '',
      priceWholesale: '',
    });
    setProductImage(null);
  };

  const handleAddProduct = async () => {
    if (!productForm.name.trim()) {
      toast({ title: 'خطأ', description: 'اسم المنتج مطلوب', variant: 'destructive' });
      return;
    }
    if (!productForm.priceRetail.trim()) {
      toast({ title: 'خطأ', description: 'سعر القطاعي مطلوب', variant: 'destructive' });
      return;
    }
    setSavingProduct(true);
    try {
      let imageUrl: string | null = null;
      if (productImage) {
        const ext = productImage.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, productImage);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('products').insert({
        name: productForm.name.trim(),
        category: 'غير مصنف',
        classification: productForm.description.trim() || 'منزلي',
        cost: Number(productForm.cost) || 0,
        price: Number(productForm.priceRetail) || 0,
        price1: Number(productForm.priceWholesale) || 0,
        price2: 0,
        price3: 0,
        discount: 0,
        warranty: 12,
        stock: 0,
        min_stock: 0,
        image: imageUrl,
      } as any);
      if (error) throw error;
      toast({ title: 'تم إضافة المنتج بنجاح' });
      setAddProductOpen(false);
      resetProductForm();
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) {
      toast({ title: 'خطأ', description: 'اسم القسم مطلوب', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        name: catForm.name.trim(),
        icon_key: catForm.icon_key,
        // لا نغيّر التبعية من الفورم؛ نحافظ على parent_id الحالي في حالة التعديل، وإلا يكون قسم رئيسي
        parent_id: editingCategory?.parent_id ?? null,
        sort_order: catForm.sort_order,
      };
      if (editingCategory) {
        const { error } = await supabase.from('inventory_categories').update(payload).eq('id', editingCategory.id);
        if (error) throw error;
        toast({ title: 'تم تعديل القسم' });
        setEditCatOpen(false);
        setEditingCategory(null);
      } else {
        const { error } = await supabase.from('inventory_categories').insert({ ...payload, id: crypto.randomUUID() });
        if (error) throw error;
        toast({ title: 'تم إضافة القسم' });
        setAddCatOpen(false);
      }
      setCatForm({ name: '', icon_key: 'default', sort_order: 0 });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (cat: InventoryCategory) => {
    if (!confirm(`حذف القسم "${cat.name}"؟`)) return;
    try {
      const { error } = await supabase.from('inventory_categories').delete().eq('id', cat.id);
      if (error) throw error;
      toast({ title: 'تم حذف القسم' });
      setSelectedCategoryId(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const openEditCat = (c: InventoryCategory) => {
    setEditingCategory(c);
    setCatForm({ name: c.name, icon_key: c.icon_key, sort_order: c.sort_order });
    setEditCatOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">المخزون</h1>
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="gap-2" onClick={() => { resetProductForm(); setAddProductOpen(true); }}>
            <Plus className="h-4 w-4" /> إضافة أيقونة
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setCategoriesOpen(true)}>
            <Settings2 className="h-4 w-4" /> إدارة الأقسام
          </Button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> تنبيهات المخزون المنخفض
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.slice(0, 12).map(p => (
                <Badge key={p.id} variant="destructive" className="text-[10px]">{p.name}: {p.stock} / {p.min_stock}</Badge>
              ))}
              {lowStock.length > 12 && <Badge variant="outline">+{lowStock.length - 12}</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories bar: icon cards + All Categories */}
      <InventoryCategoriesBar
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        flat
      />

      <ProductGrid products={filteredProducts} loading={loading} />

      {/* Add Product (Icon) Dialog */}
      <Dialog open={addProductOpen} onOpenChange={open => { setAddProductOpen(open); if (!open) resetProductForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة أيقونة / منتج</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم المنتج *</Label>
              <Input
                value={productForm.name}
                onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                placeholder="مثال: فلتر 5 مراحل"
              />
            </div>
            <div>
              <Label>الوصف</Label>
              <Input
                value={productForm.description}
                onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))}
                placeholder="وصف مختصر للمنتج"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>سعر التكلفة</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={productForm.cost}
                  onChange={e => setProductForm(p => ({ ...p, cost: e.target.value }))}
                />
              </div>
              <div>
                <Label>سعر القطاعي *</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={productForm.priceRetail}
                  onChange={e => setProductForm(p => ({ ...p, priceRetail: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>سعر الجملة</Label>
              <Input
                type="number"
                dir="ltr"
                value={productForm.priceWholesale}
                onChange={e => setProductForm(p => ({ ...p, priceWholesale: e.target.value }))}
              />
            </div>
            <div>
              <Label>صورة المنتج</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setProductImage(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddProductOpen(false)}>إلغاء</Button>
              <Button onClick={handleAddProduct} disabled={savingProduct}>
                {savingProduct ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إدارة أقسام المخزون</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              onClick={() => {
                setEditingCategory(null);
                setCatForm({ name: '', icon_key: 'default', sort_order: categories.length });
                setAddCatOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> إضافة قسم أو فئة فرعية
            </Button>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {roots.map(cat => (
                <div key={cat.id} className="border rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{cat.name}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCat(cat)}><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCategory(cat)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {getChildren(cat.id).map(sub => (
                    <div key={sub.id} className="flex items-center justify-between pr-4 py-1 text-sm text-muted-foreground">
                      <span>— {sub.name}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditCat(sub)}><Edit className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteCategory(sub)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Category */}
      <Dialog
        open={addCatOpen || editCatOpen}
        onOpenChange={open => {
          setAddCatOpen(open);
          if (!open) setEditCatOpen(false);
          setEditingCategory(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'تعديل القسم' : 'إضافة قسم'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم القسم</Label>
              <Input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: فلاتر منزلية" />
            </div>
            <div>
              <Label>الأيقونة</Label>
              <Select value={catForm.icon_key} onValueChange={v => setCatForm(p => ({ ...p, icon_key: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر أيقونة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home_filters">فلاتر منزلية</SelectItem>
                  <SelectItem value="ro">RO</SelectItem>
                  <SelectItem value="spare_parts">قطع غيار</SelectItem>
                  <SelectItem value="desalination">محطات تحلية</SelectItem>
                  <SelectItem value="default">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ترتيب العرض</Label>
              <Input type="number" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setAddCatOpen(false); setEditCatOpen(false); }}>إلغاء</Button>
              <Button onClick={handleSaveCategory}>{editingCategory ? 'تعديل' : 'إضافة'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
