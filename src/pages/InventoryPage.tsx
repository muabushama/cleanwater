import { motion } from 'framer-motion';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Settings2,
  Plus,
  Edit,
  Trash2,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  Filter,
  Wallet,
  Warehouse,
  Users,
  BarChart3,
  LayoutGrid,
  List,
  ScanLine,
  Building2,
  Store,
  Truck,
  Factory,
  Search,
  MapPin,
} from 'lucide-react';
import { useUserBranch } from '@/hooks/useUserBranch';
import { BRANCH_ALEX, BRANCH_GIZA, branchDbValuesForUiBranch, canonicalBranchForSave } from '@/lib/branchFilters';
import { normalizeStorageLocation, STORAGE_MAIN, STORAGE_SHOWROOM, STORAGE_LOCATION_OPTIONS } from '@/lib/storageLocation';
import { promptDeletePassword } from '@/lib/deletePassword';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { InventoryCategoriesBar } from '@/components/inventory/InventoryCategoriesBar';
import { ProductGrid } from '@/components/inventory/ProductGrid';
import { ProductSearchCombobox } from '@/components/inventory/ProductSearchCombobox';
import { ProductInventoryCards } from '@/components/inventory/ProductInventoryCards';
import { formatDateDayMonthYear as formatDateDisplay } from '@/lib/dateDisplay';

const effectiveMovementDate = (m: { created_at?: string | null; movement_date?: string | null }) =>
  String(m.movement_date || (m.created_at || '').slice(0, 10) || '');

const extractTechnicianName = (notes: string): string | null => {
  const m1 = notes.match(/فني[:：\s]+([^|،,\n]+)/);
  if (m1) return m1[1].trim() || null;
  const m2 = notes.match(/عربية[:：\s]+([^|،,\n]+)/);
  if (m2) return m2[1].trim() || null;
  const m3 = notes.match(/فنى[:：\s]+([^|،,\n]+)/);
  if (m3) return m3[1].trim() || null;
  return null;
};

const extractSourceFromNotes = (notes: string): string | null => {
  const m = String(notes || '').match(/مصدر المخزون[:：]\s*([^|]+)/);
  return m ? (m[1].trim() || null) : null;
};

/** موقع الحركة للعرض والفلترة: عمود DB → ملاحظات قديمة → موقع سجل المنتج */
function movementRowLocation(
  m: { storage_location?: string | null; notes?: string | null },
  prod: ProductRow | undefined,
): typeof STORAGE_MAIN | typeof STORAGE_SHOWROOM {
  const raw = (m as { storage_location?: string | null }).storage_location;
  if (raw != null && String(raw).trim() !== '') {
    return normalizeStorageLocation(String(raw)) === STORAGE_SHOWROOM ? STORAGE_SHOWROOM : STORAGE_MAIN;
  }
  const fromNotes = extractSourceFromNotes(String(m.notes || ''));
  if (fromNotes) {
    if (/معرض/i.test(fromNotes)) return STORAGE_SHOWROOM;
    if (/رئيس|مخزن/i.test(fromNotes)) return STORAGE_MAIN;
  }
  if (prod?.storage_location) {
    return normalizeStorageLocation(prod.storage_location) === STORAGE_SHOWROOM ? STORAGE_SHOWROOM : STORAGE_MAIN;
  }
  return STORAGE_MAIN;
}

interface ProductRow {
  id: string;
  name: string;
  category: string;
  classification: string;
  stock: number;
  min_stock: number;
  cost: number;
  branch?: string;
  price?: number;
  price1?: number;
  price2?: number;
  price3?: number;
  sku_code?: string | null;
  barcode?: string | null;
  unit?: string | null;
  supplier_name?: string | null;
  description?: string | null;
  image?: string | null;
  storage_location?: string | null;
}

function aggregateWarehouseSlice(list: ProductRow[]) {
  const count = list.length;
  let qty = 0;
  let value = 0;
  const productList: { name: string; qty: number; value: number }[] = [];
  list.forEach((p) => {
    const q = Number(p.stock) || 0;
    const v = q * (Number(p.cost) || 0);
    qty += q;
    value += v;
    productList.push({ name: p.name, qty: q, value: v });
  });
  productList.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ar'));
  return { count, qty, value, productList };
}

interface InventoryCategory {
  id: string;
  name: string;
  icon_key: string;
  parent_id: string | null;
  sort_order: number;
}

interface TechnicianAccount {
  id: string;
  full_name: string;
  branch_id?: string | null;
}

export default function InventoryPage() {
  const navigate = useNavigate();
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
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category: '',
    sku: '',
    barcode: '',
    unit: 'قطعة',
    supplier: '',
    min_stock: '5',
    cost: '',
    priceRetail: '',
    priceWholesale: '',
    storage_location: STORAGE_MAIN,
  });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [movementCategorySearch, setMovementCategorySearch] = useState('');
  const [addProductCategorySearch, setAddProductCategorySearch] = useState('');
  const [hubSection, setHubSection] = useState<'products' | 'movements' | 'warehouses' | 'technicians'>('products');
  const [productView, setProductView] = useState<'cards' | 'table'>('cards');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [stockMovements, setStockMovements] = useState<
    { id: string; product_id: string; branch: string; type: string; quantity: number; reference_type: string | null; reference_id: string | null; notes: string | null; unit_cost?: number | null; movement_date?: string | null; technician_user_id?: string | null; storage_location?: string | null; created_at: string }[]
  >([]);
  const [technicianAccounts, setTechnicianAccounts] = useState<TechnicianAccount[]>([]);
  const [invoiceRefs, setInvoiceRefs] = useState<{ id: string; invoice_number: string; customer_name: string; amount: number; quantity?: number; product_id?: string | null }[]>([]);
  const [purchaseRefs, setPurchaseRefs] = useState<{ id: string; purchase_number: string; supplier_name: string; unit_price?: number; quantity?: number; product_id?: string | null }[]>([]);
  const [countDateFrom, setCountDateFrom] = useState('');
  const [countDateTo, setCountDateTo] = useState('');
  const [techDateFrom, setTechDateFrom] = useState('');
  const [techDateTo, setTechDateTo] = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [techProductSearch, setTechProductSearch] = useState('');
  const [techBranchFilter, setTechBranchFilter] = useState<'all' | typeof BRANCH_ALEX | typeof BRANCH_GIZA>('all');
  const [warehouseDetail, setWarehouseDetail] = useState<{
    branch: typeof BRANCH_ALEX | typeof BRANCH_GIZA;
    slot: 'main' | 'showroom';
  } | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementSaving, setMovementSaving] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'purchase' | 'sale' | 'adjustment' | 'opening_balance'>('all');
  const [movementLocationFilter, setMovementLocationFilter] = useState<'all' | 'main' | 'showroom'>('all');
  const [movementForm, setMovementForm] = useState({
    product_id: '',
    type: 'purchase' as 'purchase' | 'sale' | 'adjustment' | 'opening_balance',
    quantity: '1',
    reference: '',
    notes: '',
    supplier_name: '',
    customer_name: '',
    category: '',
    unit_cost: '',
    sell_price: '',
    movement_date: new Date().toISOString().slice(0, 10),
    technician_user_id: '',
    technician_name: '',
    /** المخزن الذي تُسجَّل فيه الحركة (إلزامي) — يطابق products.storage_location */
    movement_location: STORAGE_MAIN as typeof STORAGE_MAIN | typeof STORAGE_SHOWROOM,
  });
  const [productNameSearch, setProductNameSearch] = useState('');
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [quickProduct, setQuickProduct] = useState<ProductRow | null>(null);
  const [quickStockValue, setQuickStockValue] = useState('');
  const [quickStockSaving, setQuickStockSaving] = useState(false);

  const normalizeCodeSearch = (value: string) => {
    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const easternIndic = '۰۱۲۳۴۵۶۷۸۹';
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String(easternIndic.indexOf(d)));
  };

  const openMovement = (type: typeof movementForm.type) => {
    setMovementCategorySearch('');
    const b = canonicalBranchForSave(branch) as typeof BRANCH_ALEX | typeof BRANCH_GIZA;
    const defaultLoc =
      warehouseDetail && warehouseDetail.branch === b
        ? warehouseDetail.slot === 'showroom'
          ? STORAGE_SHOWROOM
          : STORAGE_MAIN
        : STORAGE_MAIN;
    setMovementForm({
      product_id: '',
      type,
      quantity: '1',
      reference: '',
      notes: type === 'opening_balance' ? 'رصيد أول المدة' : '',
      supplier_name: '',
      customer_name: '',
      category: '',
      unit_cost: '',
      sell_price: '',
      movement_date: new Date().toISOString().slice(0, 10),
      technician_user_id: '',
      technician_name: '',
      movement_location: defaultLoc,
    });
    setMovementOpen(true);
  };

  const onMovementProductChange = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    setMovementForm((prev) => ({
      ...prev,
      product_id: productId,
      unit_cost: prod ? String(prod.cost || '') : '',
      sell_price: prod ? String(prod.price || '') : '',
      category: prod ? (prod.category || '') : '',
      supplier_name: prod ? (prod.supplier_name || '') : prev.supplier_name,
    }));
  };

  const fetchData = async () => {
    setLoading(true);
    const bv = branchDbValuesForUiBranch(branch);
    const [prodQ, catQ, movQ, invQ, purQ, techRolesQ] = await Promise.allSettled([
      supabase.from('products').select('*').in('branch', bv).limit(5000),
      supabase.from('inventory_categories').select('*').order('sort_order'),
      supabase.from('stock_movements').select('*').in('branch', bv).order('created_at', { ascending: false }).limit(3000),
      supabase.from('invoices').select('id,invoice_number,customer_name,amount,quantity,product_id,status').in('branch', bv).limit(4000),
      supabase.from('purchases').select('id,purchase_number,supplier_name,unit_price,quantity,product_id').in('branch', bv).limit(4000),
      supabase.from('user_roles').select('user_id,role').in('role', ['sales_rep', 'staff']),
    ]);

    let nextProducts: ProductRow[] = [];
    if (prodQ.status === 'fulfilled') {
      nextProducts = Array.isArray(prodQ.value.data) ? (prodQ.value.data as ProductRow[]) : [];
      if (prodQ.value.error) nextProducts = [];
    } else {
      nextProducts = [];
    }
    // تنظيف سريع + إزالة التكرار
    const seenProductIds = new Set<string>();
    nextProducts = nextProducts.filter((p) => {
      const id = String(p.id || '').trim();
      const name = String(p.name || '').trim();
      if (!id || !name) return false;
      if (seenProductIds.has(id)) return false;
      seenProductIds.add(id);
      return true;
    });
    setProducts(nextProducts);

    // مهم: الأقسام تُحمّل دائماً من جدول inventory_categories مباشرة ولا تتأثر بفشل الاستعلامات الأخرى
    let nextCategories: InventoryCategory[] = [];
    if (catQ.status === 'fulfilled') {
      nextCategories = Array.isArray(catQ.value.data) ? (catQ.value.data as InventoryCategory[]) : [];
    }
    if (nextCategories.length > 0) {
      setCategories(nextCategories);
    } else {
      // Fallback: إذا جدول الأقسام غير موجود/فارغ، نولّد أقساماً من المنتجات نفسها
      const names = new Set<string>();
      nextProducts.forEach((p) => {
        const c1 = String(p.category || '').trim();
        const c2 = String(p.classification || '').trim();
        if (c1) names.add(c1);
        if (c2) names.add(c2);
      });
      const generated: InventoryCategory[] = [...names].map((name, i) => ({
        id: `virtual-${i}-${name}`,
        name,
        icon_key: 'default',
        parent_id: null,
        sort_order: i,
      }));
      setCategories(generated);
    }

    setStockMovements(
      movQ.status === 'fulfilled' && Array.isArray(movQ.value.data) ? (movQ.value.data as any[]) : [],
    );
    setInvoiceRefs(
      invQ.status === 'fulfilled' && Array.isArray(invQ.value.data)
        ? (invQ.value.data as any[]).filter((x: any) => String(x?.status || '') !== 'deleted')
        : [],
    );
    setPurchaseRefs(
      purQ.status === 'fulfilled' && Array.isArray(purQ.value.data) ? (purQ.value.data as any[]) : [],
    );
    if (techRolesQ.status === 'fulfilled' && Array.isArray(techRolesQ.value.data)) {
      const userIds = [...new Set((techRolesQ.value.data as any[]).map((r) => String(r.user_id || '').trim()).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: techProfiles } = await supabase
          .from('profiles')
          .select('id,full_name,branch_id')
          .in('id', userIds);
        setTechnicianAccounts(
          Array.isArray(techProfiles)
            ? (techProfiles as any[])
                .map((p) => ({
                  id: String(p.id || ''),
                  full_name: String(p.full_name || '').trim() || String(p.id || ''),
                  branch_id: p.branch_id ?? null,
                }))
                .filter((p) => p.id)
                .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'))
            : [],
        );
      } else {
        setTechnicianAccounts([]);
      }
    } else {
      setTechnicianAccounts([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [branch]);

  useEffect(() => {
    if (hubSection !== 'warehouses') return;
    setWarehouseDetail((prev) => {
      const b = canonicalBranchForSave(branch) as typeof BRANCH_ALEX | typeof BRANCH_GIZA;
      if (!prev) return { branch: b, slot: 'main' };
      if (prev.branch !== b) return { branch: b, slot: prev.slot };
      return prev;
    });
  }, [branch, hubSection]);

  const roots = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);
  const allCategoryNames = useMemo(() => {
    const names = new Set<string>(['غير مصنف']);
    roots.forEach((r) => {
      if (r.name) names.add(r.name);
      getChildren(r.id).forEach((sub) => {
        if (sub.name) names.add(sub.name);
      });
    });
    return [...names];
  }, [categories]);
  const filteredMovementCategoryOptions = useMemo(() => {
    const term = movementCategorySearch.trim().toLowerCase();
    if (!term) return allCategoryNames;
    return allCategoryNames.filter((n) => n.toLowerCase().includes(term));
  }, [allCategoryNames, movementCategorySearch]);
  const filteredAddProductCategoryOptions = useMemo(() => {
    const term = addProductCategorySearch.trim().toLowerCase();
    if (!term) return allCategoryNames;
    return allCategoryNames.filter((n) => n.toLowerCase().includes(term));
  }, [allCategoryNames, addProductCategorySearch]);

  const selectedCat = selectedCategoryId ? categories.find(c => c.id === selectedCategoryId) : null;
  const categoryNamesToFilter = useMemo(() => {
    if (!selectedCat) return null;
    const names = [selectedCat.name];
    const children = getChildren(selectedCat.id);
    children.forEach(c => names.push(c.name));
    return names;
  }, [selectedCategoryId, categories]);
  const filteredProducts = useMemo(() => {
    let list = categoryNamesToFilter
      ? products.filter(p => categoryNamesToFilter.includes(p.category) || categoryNamesToFilter.includes(p.classification))
      : products;
    const term = normalizeCodeSearch(productNameSearch);
    if (term) {
      list = list.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const sku = normalizeCodeSearch(String(p.sku_code || ''));
        const bc = normalizeCodeSearch(String(p.barcode || ''));
        return name.includes(term) || sku === term || bc === term || sku.includes(term) || bc.includes(term);
      });
    }
    return list;
  }, [products, categoryNamesToFilter, productNameSearch]);
  const movementProducts = useMemo(() => {
    const bv = new Set(branchDbValuesForUiBranch(branch).map((x) => String(x).trim()));
    const wantLoc = movementForm.movement_location;
    const seen = new Set<string>();
    const cleaned = products
      .filter((p) => bv.has(String(p.branch || '').trim()))
      .filter((p) => normalizeStorageLocation(p.storage_location) === wantLoc)
      .filter((p) => {
        const id = String(p.id || '').trim();
        const name = String(p.name || '').trim();
        return id.length > 0 && name.length > 0;
      })
      .filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .map((p) => ({
        id: p.id,
        name: String(p.name || '').trim(),
        stock: Number(p.stock) || 0,
      }));
    return cleaned;
  }, [products, branch, movementForm.movement_location]);

  const lowStock = products.filter(p => Number(p.stock) <= Number(p.min_stock || 0));

  const warehousesSummary = useMemo(() => {
    return ([BRANCH_ALEX, BRANCH_GIZA] as const).map((canonical) => {
      const bv = new Set(branchDbValuesForUiBranch(canonical).map((x) => String(x).trim()));
      const inBranch = products.filter((p) => bv.has(String(p.branch || '').trim()));
      const mainList = inBranch.filter((p) => normalizeStorageLocation(p.storage_location) === STORAGE_MAIN);
      const showroomList = inBranch.filter((p) => normalizeStorageLocation(p.storage_location) === STORAGE_SHOWROOM);
      return {
        branchName: canonical,
        branchTotal: aggregateWarehouseSlice(inBranch),
        main: aggregateWarehouseSlice(mainList),
        showroom: aggregateWarehouseSlice(showroomList),
      };
    });
  }, [products]);

  const warehouseDetailProducts = useMemo(() => {
    if (!warehouseDetail) return [] as ProductRow[];
    const bv = new Set(branchDbValuesForUiBranch(warehouseDetail.branch).map((x) => String(x).trim()));
    const loc = warehouseDetail.slot === 'showroom' ? STORAGE_SHOWROOM : STORAGE_MAIN;
    return products
      .filter(
        (p) =>
          bv.has(String(p.branch || '').trim()) && normalizeStorageLocation(p.storage_location) === loc,
      )
      .sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0) || a.name.localeCompare(b.name, 'ar'));
  }, [products, warehouseDetail]);

  const technicianNameById = useMemo(
    () => Object.fromEntries(technicianAccounts.map((t) => [t.id, t.full_name])),
    [technicianAccounts],
  );

  const technicianMovementRows = useMemo(() => {
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    return stockMovements
      .map((m) => {
        const notes = String(m.notes || '');
        const technicianFromAccount = String(m.technician_user_id || '').trim()
          ? technicianNameById[String(m.technician_user_id || '').trim()]
          : '';
        const technician = technicianFromAccount || extractTechnicianName(notes);
        if (!technician) return null;
        const q = Number(m.quantity) || 0;
        const prod = productById[m.product_id];
        const unitPrice = Number(m.unit_cost) || Number(prod?.price) || 0;
        const qtySigned = m.type === 'sale' ? -Math.abs(q) : q;
        return {
          id: m.id,
          technician,
          date: effectiveMovementDate(m),
          qty: qtySigned,
          value: Math.abs(qtySigned) * unitPrice,
          lines: 1,
          notes,
          type: m.type,
          productName: String(prod?.name || m.product_id || 'منتج'),
          productBranch: String(prod?.branch || ''),
          technicianUserId: String(m.technician_user_id || '') || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || ''))) as {
        id: string;
        technician: string;
        date: string;
        qty: number;
        value: number;
        lines: number;
        notes: string;
        type: string;
        productName: string;
        productBranch: string;
        technicianUserId: string | null;
      }[];
  }, [stockMovements, products, technicianNameById]);

  const techBranchStats = useMemo(() => {
    const empty = () => ({ lines: 0, netQty: 0 });
    const alex = empty();
    const giza = empty();
    const alexSet = new Set(branchDbValuesForUiBranch(BRANCH_ALEX).map((x) => String(x).trim()));
    const gizaSet = new Set(branchDbValuesForUiBranch(BRANCH_GIZA).map((x) => String(x).trim()));
    technicianMovementRows.forEach((row) => {
      const pb = String(row.productBranch || '').trim();
      if (alexSet.has(pb)) {
        alex.lines += 1;
        alex.netQty += row.qty;
      } else if (gizaSet.has(pb)) {
        giza.lines += 1;
        giza.netQty += row.qty;
      }
    });
    return { [BRANCH_ALEX]: alex, [BRANCH_GIZA]: giza } as Record<
      typeof BRANCH_ALEX | typeof BRANCH_GIZA,
      { lines: number; netQty: number }
    >;
  }, [technicianMovementRows]);

  const filteredTechnicianRows = useMemo(() => {
    const from = techDateFrom || '';
    const to = techDateTo || '';
    const techTerm = techSearch.trim().toLowerCase();
    const productTerm = techProductSearch.trim().toLowerCase();
    const branchSet =
      techBranchFilter === 'all'
        ? null
        : new Set(branchDbValuesForUiBranch(techBranchFilter).map((x) => String(x).trim()));
    return technicianMovementRows.filter((row) => {
      const dateOk = (!from || row.date >= from) && (!to || row.date <= to);
      const techOk = !techTerm || row.technician.toLowerCase().includes(techTerm);
      const productOk = !productTerm || row.productName.toLowerCase().includes(productTerm);
      const branchOk =
        !branchSet || branchSet.has(String(row.productBranch || '').trim());
      return dateOk && techOk && productOk && branchOk;
    });
  }, [technicianMovementRows, techDateFrom, techDateTo, techSearch, techProductSearch, techBranchFilter]);

  const techniciansSummary = useMemo(() => {
    const map = new Map<string, {
      qty: number;
      value: number;
      lines: number;
      byProduct: Record<string, { qty: number; value: number; lines: number; firstDate: string; lastDate: string }>;
    }>();
    filteredTechnicianRows.forEach((row) => {
      const prev = map.get(row.technician) || { qty: 0, value: 0, lines: 0, byProduct: {} };
      prev.qty += row.qty;
      prev.value += row.value;
      prev.lines += 1;
      const bp = prev.byProduct[row.productName] || {
        qty: 0,
        value: 0,
        lines: 0,
        firstDate: row.date,
        lastDate: row.date,
      };
      bp.qty += row.qty;
      bp.value += row.value;
      bp.lines += 1;
      bp.firstDate = row.date < bp.firstDate ? row.date : bp.firstDate;
      bp.lastDate = row.date > bp.lastDate ? row.date : bp.lastDate;
      prev.byProduct[row.productName] = bp;
      map.set(row.technician, prev);
    });
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        qty: v.qty,
        value: v.value,
        lines: v.lines,
        topProducts: Object.entries(v.byProduct)
          .sort((a, b) => Math.abs(b[1].qty) - Math.abs(a[1].qty)),
      }))
      .sort((a, b) => b.lines - a.lines);
  }, [filteredTechnicianRows]);

  const consumptionTop = useMemo(() => {
    const map = new Map<string, number>();
    stockMovements.forEach((m) => {
      if (m.type !== 'sale') return;
      const id = m.product_id;
      if (!id) return;
      map.set(id, (map.get(id) || 0) + (Number(m.quantity) || 0));
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, qty]) => ({
        id,
        qty,
        name: products.find((p) => p.id === id)?.name || 'صنف',
      }));
  }, [stockMovements, products]);

  const handleBarcodeLookup = () => {
    const t = barcodeInput.trim();
    if (!t) {
      toast({ title: 'أدخل باركود أو SKU', variant: 'destructive' });
      return;
    }
    const byBar = products.find((p) => p.barcode && String(p.barcode).trim() === t);
    const bySku = products.find((p) => p.sku_code && String(p.sku_code).trim().toLowerCase() === t.toLowerCase());
    const p = byBar || bySku;
    if (!p) {
      toast({ title: 'لم يُعثر على منتج', description: t, variant: 'destructive' });
      return;
    }
    setQuickProduct(p);
    setQuickStockValue(String(p.stock ?? 0));
    setQuickStockOpen(true);
    setBarcodeInput('');
    toast({ title: 'تم تحديد المنتج', description: p.name });
  };

  // جرد المخزن: حركات في نطاق التاريخ
  const countMovementRows = useMemo(() => {
    const from = countDateFrom || '';
    const to = countDateTo || '';
    const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));
    const list = stockMovements.filter(m => {
      const dateOk = inRange((m.created_at || '').slice(0, 10));
      const typeOk = movementTypeFilter === 'all' ? true : m.type === movementTypeFilter;
      const loc = movementRowLocation(m, productMap[m.product_id]);
      const locOk =
        movementLocationFilter === 'all'
          ? true
          : movementLocationFilter === 'showroom'
            ? loc === STORAGE_SHOWROOM
            : loc === STORAGE_MAIN;
      return dateOk && typeOk && locOk;
    });
    const invoiceByRef = new Map<string, any>();
    invoiceRefs.forEach((inv) => {
      if (inv.id) invoiceByRef.set(String(inv.id), inv);
      if (inv.invoice_number) invoiceByRef.set(String(inv.invoice_number), inv);
    });
    const purchaseByRef = new Map<string, any>();
    purchaseRefs.forEach((pur) => {
      if (pur.id) purchaseByRef.set(String(pur.id), pur);
      if (pur.purchase_number) purchaseByRef.set(String(pur.purchase_number), pur);
    });
    const typeLabel = (t: string) =>
      t === 'purchase' ? 'وارد' : t === 'sale' ? 'منصرف' : t === 'adjustment' ? 'تعديل' : t === 'opening_balance' ? 'رصيد أول المدة' : t;
    const refLabel = (m: (typeof list)[0]) => m.reference_type && m.reference_id ? `${m.reference_type} ${m.reference_id}` : '-';
    const effect = (m: (typeof list)[0]) => {
      const q = m.quantity || 0;
      if (m.type === 'purchase' || m.type === 'opening_balance') return q;
      if (m.type === 'sale') return -q;
      return q;
    };
    const sorted = [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const rows = sorted.map(m => {
      const q = m.quantity || 0;
      const stockNow = Number(productMap[m.product_id]?.stock) || 0;
      const laterEffects = list.filter(x => x.product_id === m.product_id && (x.created_at || '') > (m.created_at || '')).reduce((s, x) => s + effect(x), 0);
      const balance = stockNow - laterEffects;
      const prod = productMap[m.product_id];
      const ref = String(m.reference_id || '');
      const inv = invoiceByRef.get(ref);
      const pur = purchaseByRef.get(ref);
      const unitPrice =
        Number(m.unit_cost ?? (m.type === 'sale' ? prod?.price : prod?.cost)) || 0;
      const signedQty = m.type === 'sale' ? -q : q;
      const incoming = signedQty > 0 ? signedQty : 0;
      const outgoing = signedQty < 0 ? Math.abs(signedQty) : 0;
      const total = (incoming > 0 ? incoming : outgoing) * unitPrice;
      const entity =
        (m.type === 'purchase' && (pur?.supplier_name || 'مورد')) ||
        (m.type === 'sale' && (inv?.customer_name || 'عميل')) ||
        (m.reference_type === 'opening_balance' ? 'رصيد أول المدة' : 'مراجعة جرد');
      const code = prod?.sku_code || prod?.barcode || String(m.product_id || '').slice(0, 8);
      const locationLabel = movementRowLocation(m, prod) === STORAGE_SHOWROOM ? 'المعرض' : 'المخزن الرئيسي';

      return {
        id: m.id,
        date: (m as any).movement_date || (m.created_at || '').slice(0, 10),
        type: m.type,
        typeLabel: typeLabel(m.type),
        locationLabel,
        reference: refLabel(m),
        code,
        productName: prod?.name || m.product_id,
        incoming,
        outgoing,
        unitPrice,
        total,
        entity,
        quantity: signedQty,
        balance,
        notes: m.notes || '-',
      };
    });
    return rows;
  }, [stockMovements, products, invoiceRefs, purchaseRefs, countDateFrom, countDateTo, movementTypeFilter, movementLocationFilter]);

  const countStats = useMemo(() => {
    const from = countDateFrom || '';
    const to = countDateTo || '';
    const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));
    const list = stockMovements.filter(m => {
      if (!inRange((m.created_at || '').slice(0, 10))) return false;
      const loc = movementRowLocation(m, productMap[m.product_id]);
      if (movementLocationFilter === 'all') return true;
      if (movementLocationFilter === 'showroom') return loc === STORAGE_SHOWROOM;
      return loc === STORAGE_MAIN;
    });
    const totalIn = list.filter(m => m.type === 'purchase').reduce((s, m) => s + (m.quantity || 0), 0);
    const totalOpening = list.filter(m => m.type === 'opening_balance').reduce((s, m) => s + (m.quantity || 0), 0);
    const totalOut = list.filter(m => m.type === 'sale').reduce((s, m) => s + (m.quantity || 0), 0);
    const bv = new Set(branchDbValuesForUiBranch(branch).map((x) => String(x).trim()));
    const inBranch = products.filter((p) => bv.has(String(p.branch || '').trim()));
    const productsForBalance =
      movementLocationFilter === 'all'
        ? inBranch
        : inBranch.filter(
            (p) =>
              normalizeStorageLocation(p.storage_location) ===
              (movementLocationFilter === 'showroom' ? STORAGE_SHOWROOM : STORAGE_MAIN),
          );
    const currentBalance = productsForBalance.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    return {
      totalItems: productsForBalance.length,
      totalIncoming: totalIn,
      totalOpening,
      totalOutgoing: totalOut,
      currentBalance,
    };
  }, [stockMovements, products, countDateFrom, countDateTo, movementLocationFilter, branch]);

  const handleManualMovement = async () => {
    const productId = movementForm.product_id;
    const qty = Math.abs(Number(movementForm.quantity) || 0);
    if (!productId || qty <= 0) {
      toast({ title: 'خطأ', description: 'اختر المنتج وأدخل الكمية', variant: 'destructive' });
      return;
    }
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const prodLoc = normalizeStorageLocation(prod.storage_location);
    if (prodLoc !== movementForm.movement_location) {
      toast({
        title: 'موقع غير متطابق',
        description: 'اختر المخزن نفسه المسجّل للصنف، أو اختر صنفاً من قائمة المنتجات بعد اختيار الموقع.',
        variant: 'destructive',
      });
      return;
    }
    setMovementSaving(true);
    try {
      const type = movementForm.type;
      const techId = String(movementForm.technician_user_id || '').trim();
      const techNameFromAccount = techId ? (technicianNameById[techId] || '') : '';
      const techName = techNameFromAccount || movementForm.technician_name.trim();
      const movementQty = type === 'adjustment' ? Number(movementForm.quantity) : type === 'sale' ? -qty : qty;
      const rowType = type === 'opening_balance' ? 'opening_balance' : type === 'adjustment' ? 'adjustment' : type === 'sale' ? 'sale' : type === 'purchase' ? 'purchase' : 'purchase';
      const insertQty = type === 'adjustment' ? movementQty : qty;
      const unitCost = Number(movementForm.unit_cost) || 0;

      const noteParts: string[] = [];
      if (movementForm.notes) noteParts.push(movementForm.notes);
      if (movementForm.supplier_name && type === 'purchase') noteParts.push(`مورد: ${movementForm.supplier_name}`);
      if (movementForm.customer_name && type === 'sale') noteParts.push(`عميل: ${movementForm.customer_name}`);
      if (techName) noteParts.push(`فني: ${techName}`);
      if (movementForm.movement_location === STORAGE_SHOWROOM) noteParts.push('مصدر المخزون: المعرض');
      else noteParts.push('مصدر المخزون: المخزن الرئيسي');

      const movementPayload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        product_id: productId,
        branch: canonicalBranchForSave(branch),
        type: rowType,
        quantity: insertQty,
        reference_type:
          type === 'opening_balance'
            ? 'opening_balance'
            : movementForm.reference
              ? 'manual'
              : null,
        reference_id: movementForm.reference || (type === 'opening_balance' ? 'opening' : null),
        notes: noteParts.join(' | ') || (type === 'opening_balance' ? 'رصيد أول المدة' : null),
      };
      if (techId) movementPayload.technician_user_id = techId;
      if (movementForm.movement_date) {
        movementPayload.movement_date = movementForm.movement_date;
      }
      if (unitCost > 0) movementPayload.unit_cost = unitCost;
      movementPayload.storage_location = movementForm.movement_location;

      let movementInsertError: any;
      ({ error: movementInsertError } = await supabase.from('stock_movements').insert(movementPayload));
      if (movementInsertError && /technician_user_id|Unknown column/i.test(movementInsertError.message || '')) {
        delete movementPayload.technician_user_id;
        ({ error: movementInsertError } = await supabase.from('stock_movements').insert(movementPayload));
      }
      if (movementInsertError && /storage_location|Unknown column/i.test(movementInsertError.message || '')) {
        delete movementPayload.storage_location;
        ({ error: movementInsertError } = await supabase.from('stock_movements').insert(movementPayload));
      }
      if (movementInsertError) throw movementInsertError;

      const current = Number(prod.stock) || 0;
      const delta =
        type === 'sale' ? -qty : type === 'purchase' || type === 'opening_balance' ? qty : Number(movementForm.quantity);
      const newStock = Math.max(0, current + delta);

      const productUpdate: Record<string, unknown> = { stock: newStock };
      if (unitCost > 0 && (type === 'purchase' || type === 'opening_balance')) {
        productUpdate.cost = unitCost;
      }
      const sellPrice = Number(movementForm.sell_price) || 0;
      if (sellPrice > 0) {
        productUpdate.price = sellPrice;
      }
      if (movementForm.category && movementForm.category.trim()) {
        productUpdate.category = movementForm.category.trim();
      }
      if (movementForm.supplier_name && movementForm.supplier_name.trim()) {
        try {
          await supabase.from('products').update({ supplier_name: movementForm.supplier_name.trim() } as any).eq('id', productId);
        } catch { /* column may not exist */ }
      }

      await supabase.from('products').update(productUpdate).eq('id', productId);
      toast({ title: 'تم تسجيل الحركة وتحديث الرصيد والأسعار' });
      setMovementOpen(false);
      setMovementForm({
        product_id: '', type: 'purchase', quantity: '1', reference: '', notes: '',
        supplier_name: '', customer_name: '', category: '', unit_cost: '', sell_price: '',
        movement_date: new Date().toISOString().slice(0, 10), technician_user_id: '', technician_name: '',
        movement_location: STORAGE_MAIN,
      });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setMovementSaving(false);
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    const movement = stockMovements.find((m) => m.id === movementId);
    if (!movement) return;
    if (!confirm('هل تريد حذف حركة المخزون هذه؟')) return;
    if (!promptDeletePassword()) return;
    try {
      const product = products.find((p) => p.id === movement.product_id);
      if (product) {
        let reverseDelta = 0;
        if (movement.type === 'purchase' || movement.type === 'opening_balance') reverseDelta = -(Number(movement.quantity) || 0);
        else if (movement.type === 'sale') reverseDelta = Number(movement.quantity) || 0;
        else reverseDelta = -(Number(movement.quantity) || 0);
        const nextStock = Math.max(0, (Number(product.stock) || 0) + reverseDelta);
        await supabase.from('products').update({ stock: nextStock }).eq('id', product.id);
      }
      const { error } = await supabase.from('stock_movements').delete().eq('id', movementId);
      if (error) throw error;
      toast({ title: 'تم حذف الحركة' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditMovement = async (movementId: string) => {
    const movement = stockMovements.find((m) => m.id === movementId);
    if (!movement) return;
    const qtyRaw = window.prompt('الكمية الجديدة للحركة:', String(movement.quantity ?? 0));
    if (qtyRaw == null) return;
    const qtyNum = Number(qtyRaw);
    if (!Number.isFinite(qtyNum) || qtyNum === 0) {
      toast({ title: 'خطأ', description: 'الكمية غير صحيحة', variant: 'destructive' });
      return;
    }
    const unitCostRaw = window.prompt('سعر الوحدة (اختياري):', String((movement as any).unit_cost ?? ''));
    if (unitCostRaw == null) return;
    const notesRaw = window.prompt('الملاحظات:', String(movement.notes || ''));
    if (notesRaw == null) return;
    try {
      const product = products.find((p) => p.id === movement.product_id);
      if (!product) {
        toast({ title: 'خطأ', description: 'المنتج غير موجود', variant: 'destructive' });
        return;
      }
      const oldSigned =
        movement.type === 'sale'
          ? -Math.abs(Number(movement.quantity) || 0)
          : movement.type === 'adjustment'
            ? Number(movement.quantity) || 0
            : Math.abs(Number(movement.quantity) || 0);
      const newSigned =
        movement.type === 'sale'
          ? -Math.abs(qtyNum)
          : movement.type === 'adjustment'
            ? qtyNum
            : Math.abs(qtyNum);
      const delta = newSigned - oldSigned;
      const nextStock = Math.max(0, (Number(product.stock) || 0) + delta);
      await supabase.from('products').update({ stock: nextStock }).eq('id', product.id);

      const updatePayload: Record<string, unknown> = {
        quantity: movement.type === 'adjustment' ? qtyNum : Math.abs(qtyNum),
        notes: notesRaw || null,
      };
      const parsedUnit = Number(unitCostRaw || 0);
      if (Number.isFinite(parsedUnit) && parsedUnit > 0) updatePayload.unit_cost = parsedUnit;
      const { error } = await supabase.from('stock_movements').update(updatePayload).eq('id', movementId);
      if (error) throw error;
      toast({ title: 'تم تعديل الحركة' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const saveQuickStock = async () => {
    if (!quickProduct) return;
    const next = Math.max(0, Math.floor(Number(quickStockValue)));
    if (Number.isNaN(next)) {
      toast({ title: 'خطأ', description: 'أدخل رقماً صحيحاً', variant: 'destructive' });
      return;
    }
    setQuickStockSaving(true);
    try {
      const prev = Number(quickProduct.stock) || 0;
      const diff = next - prev;
      if (diff !== 0) {
        const quickPayload: Record<string, unknown> = {
          id: crypto.randomUUID(),
          product_id: quickProduct.id,
          branch: canonicalBranchForSave(branch),
          type: 'adjustment',
          quantity: diff,
          reference_type: 'stock_adjust',
          reference_id: null,
          notes: 'تعديل سريع من جدول المنتجات',
          storage_location: normalizeStorageLocation(quickProduct.storage_location),
        };
        let insErr: any;
        ({ error: insErr } = await supabase.from('stock_movements').insert(quickPayload));
        if (insErr && /storage_location|Unknown column/i.test(insErr.message || '')) {
          delete quickPayload.storage_location;
          ({ error: insErr } = await supabase.from('stock_movements').insert(quickPayload));
        }
        if (insErr) throw insErr;
      }
      await supabase.from('products').update({ stock: next }).eq('id', quickProduct.id);
      toast({ title: 'تم تحديث الرصيد' });
      setQuickStockOpen(false);
      setQuickProduct(null);
      fetchData();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setQuickStockSaving(false);
    }
  };

  const resetProductForm = () => {
    const selectedCat = selectedCategoryId ? categories.find(c => c.id === selectedCategoryId) : null;
    setAddProductCategorySearch('');
    setEditingProductId(null);
    setProductForm({
      name: '',
      description: '',
      category: selectedCat ? selectedCat.name : 'غير مصنف',
      sku: '',
      barcode: '',
      unit: 'قطعة',
      supplier: '',
      min_stock: '5',
      cost: '',
      priceRetail: '',
      priceWholesale: '',
      storage_location: STORAGE_MAIN,
    });
    setProductImage(null);
  };

  const openEditProduct = (p: ProductRow) => {
    setEditingProductId(p.id);
    setAddProductCategorySearch('');
    setProductForm({
      name: p.name || '',
      description: (p.description || '').trim(),
      category: (p.category || '').trim() || 'غير مصنف',
      sku: (p.sku_code || '').trim(),
      barcode: (p.barcode || '').trim(),
      unit: (p.unit || '').trim() || 'قطعة',
      supplier: (p.supplier_name || '').trim(),
      min_stock: String(p.min_stock ?? 5),
      cost: String(p.cost ?? ''),
      priceRetail: String(p.price ?? ''),
      priceWholesale: String(p.price1 ?? ''),
      storage_location: normalizeStorageLocation(p.storage_location),
    });
    setProductImage(null);
    setAddProductOpen(true);
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

      const insertPayload: Record<string, unknown> = {
        id: crypto.randomUUID(),
        name: productForm.name.trim(),
        branch: canonicalBranchForSave(branch),
        category: (productForm.category && productForm.category.trim()) ? productForm.category.trim() : 'غير مصنف',
        classification: 'عام',
        cost: Number(productForm.cost) || 0,
        price: Number(productForm.priceRetail) || 0,
        price1: Number(productForm.priceWholesale) || 0,
        price2: 0,
        price3: 0,
        discount: 0,
        warranty: 12,
        stock: 0,
        min_stock: Math.max(0, Math.floor(Number(productForm.min_stock) || 0)),
        image: imageUrl,
        storage_location: normalizeStorageLocation(productForm.storage_location),
      };
      if (productForm.sku.trim()) insertPayload.sku_code = productForm.sku.trim();
      if (productForm.barcode.trim()) insertPayload.barcode = productForm.barcode.trim();
      if (productForm.unit.trim()) insertPayload.unit = productForm.unit.trim();
      if (productForm.supplier.trim()) insertPayload.supplier_name = productForm.supplier.trim();
      if (productForm.description.trim()) insertPayload.description = productForm.description.trim();

      let insertError: any;
      ({ error: insertError } = await supabase.from('products').insert(insertPayload as any));
      if (insertError && /storage_location|Unknown column/i.test(insertError.message || '')) {
        delete insertPayload.storage_location;
        ({ error: insertError } = await supabase.from('products').insert(insertPayload as any));
      }
      if (insertError) throw insertError;
      toast({ title: 'تم إضافة المنتج بنجاح' });
      // تحديث فوري للقائمة حتى لو fetchData تأخر/فشل مؤقتاً
      setProducts((prev) => ([
        {
          id: String(insertPayload.id),
          name: String(insertPayload.name || ''),
          category: String(insertPayload.category || 'غير مصنف'),
          classification: String(insertPayload.classification || 'عام'),
          stock: Number(insertPayload.stock || 0),
          min_stock: Number(insertPayload.min_stock || 0),
          cost: Number(insertPayload.cost || 0),
          branch: String(insertPayload.branch || branch),
          price: Number(insertPayload.price || 0),
          sku_code: (insertPayload.sku_code as string) || null,
          barcode: (insertPayload.barcode as string) || null,
          unit: (insertPayload.unit as string) || null,
          supplier_name: (insertPayload.supplier_name as string) || null,
          description: (insertPayload.description as string) || null,
          image: (insertPayload.image as string) || null,
          storage_location: String(insertPayload.storage_location || STORAGE_MAIN),
        },
        ...prev.filter((p) => p.id !== String(insertPayload.id)),
      ]));
      setSelectedCategoryId(null);
      setAddProductOpen(false);
      resetProductForm();
      fetchData();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProductId) return;
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
      const existing = products.find((x) => x.id === editingProductId);
      let imageUrl: string | null = existing?.image ?? null;
      if (productImage) {
        const ext = productImage.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, productImage);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }

      const updatePayload: Record<string, unknown> = {
        name: productForm.name.trim(),
        category: (productForm.category && productForm.category.trim()) ? productForm.category.trim() : 'غير مصنف',
        cost: Number(productForm.cost) || 0,
        price: Number(productForm.priceRetail) || 0,
        price1: Number(productForm.priceWholesale) || 0,
        min_stock: Math.max(0, Math.floor(Number(productForm.min_stock) || 0)),
        image: imageUrl,
        storage_location: normalizeStorageLocation(productForm.storage_location),
      };
      if (productForm.sku.trim()) updatePayload.sku_code = productForm.sku.trim();
      else updatePayload.sku_code = null;
      if (productForm.barcode.trim()) updatePayload.barcode = productForm.barcode.trim();
      else updatePayload.barcode = null;
      if (productForm.unit.trim()) updatePayload.unit = productForm.unit.trim();
      if (productForm.supplier.trim()) updatePayload.supplier_name = productForm.supplier.trim();
      else updatePayload.supplier_name = null;
      if (productForm.description.trim()) updatePayload.description = productForm.description.trim();
      else updatePayload.description = null;

      let updateError: any;
      ({ error: updateError } = await supabase.from('products').update(updatePayload as any).eq('id', editingProductId));
      if (updateError && /storage_location|Unknown column/i.test(updateError.message || '')) {
        delete updatePayload.storage_location;
        ({ error: updateError } = await supabase.from('products').update(updatePayload as any).eq('id', editingProductId));
      }
      if (updateError) throw updateError;
      toast({ title: 'تم تحديث المنتج بنجاح' });
      setProducts((prev) =>
        prev.map((row) =>
          row.id === editingProductId
            ? {
                ...row,
                name: String(updatePayload.name || row.name),
                category: String(updatePayload.category || row.category),
                cost: Number(updatePayload.cost) || 0,
                price: Number(updatePayload.price) || 0,
                price1: Number(updatePayload.price1) || 0,
                min_stock: Number(updatePayload.min_stock) || 0,
                sku_code: (updatePayload.sku_code as string) ?? row.sku_code,
                barcode: (updatePayload.barcode as string) ?? row.barcode,
                unit: (updatePayload.unit as string) ?? row.unit,
                supplier_name: (updatePayload.supplier_name as string) ?? row.supplier_name,
                description: (updatePayload.description as string) ?? row.description,
                image: (updatePayload.image as string) ?? row.image,
                storage_location: String(updatePayload.storage_location ?? row.storage_location ?? STORAGE_MAIN),
              }
            : row,
        ),
      );
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
    if (!promptDeletePassword()) return;
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

  const hubNavBtn = (id: typeof hubSection, label: string, icon: ReactNode) => (
    <Button
      type="button"
      variant={hubSection === id ? 'default' : 'ghost'}
      size="sm"
      className={`gap-2 rounded-lg ${hubSection === id ? 'shadow-md' : ''}`}
      onClick={() => setHubSection(id)}
    >
      {icon}
      {label}
    </Button>
  );

  const movementsPanel = (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">حركة المخزون والجرد</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Package className="h-5 w-5" />
                  <span className="text-sm">إجمالي الأصناف</span>
                </div>
                <p className="text-2xl font-bold">{countStats.totalItems.toLocaleString('ar-EG')}</p>
                <p className="text-xs text-muted-foreground">الرصيد الكلي</p>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <ArrowDownCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm">إجمالي الكميات الواردة</span>
                </div>
                <p className="text-2xl font-bold text-green-700">{countStats.totalIncoming.toLocaleString('ar-EG')}</p>
                <p className="text-xs text-muted-foreground">في نطاق التاريخ</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Wallet className="h-5 w-5 text-amber-700" />
                  <span className="text-sm">رصيد أول المدة</span>
                </div>
                <p className="text-2xl font-bold text-amber-800">{countStats.totalOpening.toLocaleString('ar-EG')}</p>
                <p className="text-xs text-muted-foreground">في نطاق التاريخ</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/10 border-orange-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <ArrowUpCircle className="h-5 w-5 text-orange-600" />
                  <span className="text-sm">إجمالي الكميات المنصرفة</span>
                </div>
                <p className="text-2xl font-bold text-orange-700">{countStats.totalOutgoing.toLocaleString('ar-EG')}</p>
                <p className="text-xs text-muted-foreground">في نطاق التاريخ</p>
              </CardContent>
            </Card>
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Package className="h-5 w-5 text-destructive" />
                  <span className="text-sm">رصيد المخزون الحالي</span>
                </div>
                <p className="text-2xl font-bold text-destructive">{countStats.currentBalance.toLocaleString('ar-EG')}</p>
                <p className="text-xs text-muted-foreground">الإجمالي الحالي</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">
            عند إنشاء فاتورة مبيعات من قسم الفواتير يتم تسجيل حركة منصرف تلقائياً — وعند إنشاء فاتورة مشتريات يتم تسجيل حركة وارد تلقائياً.
            يمكنك أيضاً إضافة حركات يدوية من هنا.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" size="sm" className="gap-1" onClick={() => openMovement('purchase')}>
              <ArrowDownCircle className="h-4 w-4" /> إضافة وارد
            </Button>
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => openMovement('sale')}>
              <ArrowUpCircle className="h-4 w-4" /> تسجيل منصرف
            </Button>
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => openMovement('opening_balance')}>
              <Wallet className="h-4 w-4" /> رصيد أول المدة
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openMovement('adjustment')}>
              <Edit className="h-4 w-4" /> تعديل رصيد
            </Button>
            <Label className="text-sm">من تاريخ</Label>
            <Input type="date" value={countDateFrom} onChange={e => setCountDateFrom(e.target.value)} className="w-40" />
            <Label className="text-sm">إلى تاريخ</Label>
            <Input type="date" value={countDateTo} onChange={e => setCountDateTo(e.target.value)} className="w-40" />
            <Select value={movementTypeFilter} onValueChange={v => setMovementTypeFilter(v as any)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="نوع الحركة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحركات</SelectItem>
                <SelectItem value="purchase">الوارد فقط</SelectItem>
                <SelectItem value="sale">المنصرف فقط</SelectItem>
                <SelectItem value="adjustment">التعديل فقط</SelectItem>
                <SelectItem value="opening_balance">رصيد أول المدة فقط</SelectItem>
              </SelectContent>
            </Select>
            <Select value={movementLocationFilter} onValueChange={(v) => setMovementLocationFilter(v as 'all' | 'main' | 'showroom')}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="المكان" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المواقع</SelectItem>
                <SelectItem value="main">المخزن الرئيسي</SelectItem>
                <SelectItem value="showroom">المعرض</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" size="sm" className="gap-1">
              <Filter className="h-4 w-4" /> مفلتر
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="p-2 text-right font-medium">التاريخ</th>
                      <th className="p-2 text-right font-medium">الكود</th>
                      <th className="p-2 text-right font-medium">نوع الحركة</th>
                      <th className="p-2 text-right font-medium">المكان</th>
                      <th className="p-2 text-right font-medium">الرقم المرجعي</th>
                      <th className="p-2 text-right font-medium">اسم الصنف</th>
                      <th className="p-2 text-right font-medium">وارد</th>
                      <th className="p-2 text-right font-medium">منصرف</th>
                      <th className="p-2 text-right font-medium">السعر</th>
                      <th className="p-2 text-right font-medium">الإجمالي</th>
                      <th className="p-2 text-right font-medium">جهة الحركة</th>
                      <th className="p-2 text-right font-medium">الرصيد الحالي</th>
                      <th className="p-2 text-right font-medium">ملاحظات</th>
                      <th className="p-2 text-right font-medium">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countMovementRows.length === 0 ? (
                      <tr><td colSpan={14} className="p-4 text-center text-muted-foreground">لا توجد حركات في نطاق الفلترة</td></tr>
                    ) : (
                      countMovementRows.map(row => (
                        <tr key={row.id} className="border-b hover:bg-muted/30">
                          <td className="p-2 text-muted-foreground">{formatDateDisplay(row.date)}</td>
                          <td className="p-2" dir="ltr">{row.code || '-'}</td>
                          <td className="p-2">
                            <Badge
                              variant={row.type === 'sale' ? 'destructive' : row.type === 'opening_balance' ? 'outline' : row.type === 'purchase' ? 'default' : 'secondary'}
                              className={`text-xs ${row.type === 'opening_balance' ? 'border-amber-600/50 bg-amber-500/10' : ''}`}
                            >
                              {row.typeLabel}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-xs font-normal">
                              {row.locationLabel}
                            </Badge>
                          </td>
                          <td className="p-2">{row.reference}</td>
                          <td className="p-2">{row.productName}</td>
                          <td className="p-2 text-green-700 font-medium" dir="ltr">{row.incoming > 0 ? row.incoming : '-'}</td>
                          <td className="p-2 text-red-700 font-medium" dir="ltr">{row.outgoing > 0 ? row.outgoing : '-'}</td>
                          <td className="p-2" dir="ltr">{row.unitPrice > 0 ? row.unitPrice.toLocaleString('ar-EG') : '-'}</td>
                          <td className="p-2 font-medium" dir="ltr">{row.total > 0 ? row.total.toLocaleString('ar-EG') : '-'}</td>
                          <td className="p-2">{row.entity}</td>
                          <td className="p-2 font-medium" dir="ltr">{row.balance}</td>
                          <td className="p-2 text-muted-foreground">{row.notes}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditMovement(row.id)}
                                title="تعديل الحركة"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDeleteMovement(row.id)}
                                title="حذف الحركة"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-l from-primary/15 via-background to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">المخزون</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              فلاتر منزلية، محطات تحلية، قطع غيار، ومستلزمات — عرض بالفئات، باركود، حركة مخزون، وجرد.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" onClick={() => { resetProductForm(); setEditingProductId(null); setAddProductOpen(true); }}>
              <Plus className="h-4 w-4" /> إضافة منتج
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setCategoriesOpen(true)}>
              <Settings2 className="h-4 w-4" /> الفئات
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/reports')}>
              <BarChart3 className="h-4 w-4" /> تقارير
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-4 p-1 rounded-xl bg-background/90 border border-border/80">
          {hubNavBtn('products', 'المنتجات', <LayoutGrid className="h-4 w-4" />)}
          {hubNavBtn('movements', 'حركة المخزون', <ArrowDownCircle className="h-4 w-4" />)}
          {hubNavBtn('warehouses', 'المخازن', <Warehouse className="h-4 w-4" />)}
          {hubNavBtn('technicians', 'مخزون الفنيين', <Users className="h-4 w-4" />)}
        </div>
      </div>

      <div
        className={`grid gap-5 ${hubSection === 'products' || hubSection === 'movements' ? 'lg:grid-cols-[minmax(0,280px)_1fr]' : 'grid-cols-1'}`}
      >
        {(hubSection === 'products' || hubSection === 'movements') && (
          <aside className="space-y-4 lg:sticky lg:top-4 order-2 lg:order-none">
            <Card className="border-destructive/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> التنبيهات
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-52 overflow-y-auto space-y-2 text-sm">
                {lowStock.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا يوجد مخزون تحت الحد الأدنى.</p>
                ) : (
                  lowStock.slice(0, 12).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-right rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs hover:bg-destructive/10"
                      onClick={() => {
                        setQuickProduct(p);
                        setQuickStockValue(String(p.stock ?? 0));
                        setQuickStockOpen(true);
                      }}
                    >
                      <span className="font-medium block truncate">{p.name}</span>
                      <span className="text-destructive">{p.stock} / حد {p.min_stock}</span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">أكثر الأصناف صرفاً (صيانة/بيع)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {consumptionTop.length === 0 ? (
                  <p className="text-muted-foreground">لا توجد حركات منصرف بعد.</p>
                ) : (
                  consumptionTop.map((r, i) => (
                    <div key={r.id} className="flex justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
                      <span className="truncate">{i + 1}. {r.name}</span>
                      <span className="shrink-0 font-semibold" dir="ltr">{r.qty}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => setHubSection('movements')}>
                <ArrowDownCircle className="h-4 w-4" /> تسجيل حركة مخزون
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => setCategoriesOpen(true)}>
                <Package className="h-4 w-4" /> إدارة الفئات والأقسام
              </Button>
            </div>
          </aside>
        )}

        <div className="min-w-0 space-y-4 order-1 lg:order-none">
          {hubSection === 'products' && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <div className="flex flex-1 flex-col gap-2 min-w-[200px] max-w-md">
                  <Label className="text-xs flex items-center gap-1">
                    <ScanLine className="h-3.5 w-3.5" /> باركود أو SKU
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      dir="ltr"
                      placeholder="امسح أو الصق الكود ثم Enter"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()}
                    />
                    <Button type="button" variant="secondary" onClick={handleBarcodeLookup}>
                      بحث
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">يجهّز المنتج للتعديل السريع؛ يمكن لاحقاً ربط كاميرا للمسح.</p>
                </div>
                <div className="flex gap-1 rounded-lg border p-1 bg-muted/40">
                  <Button
                    type="button"
                    size="sm"
                    variant={productView === 'cards' ? 'default' : 'ghost'}
                    className="gap-1"
                    onClick={() => setProductView('cards')}
                  >
                    <LayoutGrid className="h-4 w-4" /> كروت
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={productView === 'table' ? 'default' : 'ghost'}
                    className="gap-1"
                    onClick={() => setProductView('table')}
                  >
                    <List className="h-4 w-4" /> جدول
                  </Button>
                </div>
              </div>
              <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو كود الصنف أو الباركود..."
                  value={productNameSearch}
                  onChange={(e) => setProductNameSearch(e.target.value)}
                  className="pr-9"
                />
              </div>
              <InventoryCategoriesBar
                variant="strip"
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
              />
              <p className="text-xs text-muted-foreground">اضغط على منتج لتعديل الرصيد سريعاً، أو «تعديل» لتعديل الاسم والأسعار والصورة وغيرها.</p>
              {productView === 'cards' ? (
                <ProductInventoryCards
                  products={filteredProducts}
                  loading={loading}
                  onProductClick={(p) => {
                    setQuickProduct(p as ProductRow);
                    setQuickStockValue(String(p.stock ?? 0));
                    setQuickStockOpen(true);
                  }}
                  onEditProduct={(p) => openEditProduct(p as ProductRow)}
                />
              ) : (
                <ProductGrid
                  products={filteredProducts}
                  loading={loading}
                  onRowClick={(p) => {
                    setQuickProduct(p);
                    setQuickStockValue(String(p.stock ?? 0));
                    setQuickStockOpen(true);
                  }}
                  onEditProduct={openEditProduct}
                />
              )}
            </>
          )}
          {hubSection === 'movements' && movementsPanel}
          {hubSection === 'warehouses' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">المخازن</h2>
              <p className="text-sm text-muted-foreground">
                اضغط على «المخزن الرئيسي» أو «المعرض» لعرض الأصناف المسجّلة في ذلك الموقع داخل الفرع. موقع كل صنف يُحدَّد من نافذة إضافة/تعديل المنتج.
              </p>

              {warehousesSummary.map(({ branchName, branchTotal, main, showroom }) => {
                const techS = techBranchStats[branchName];
                const locCards: {
                  key: 'main' | 'showroom';
                  name: string;
                  desc: string;
                  Icon: typeof Building2;
                  stats: ReturnType<typeof aggregateWarehouseSlice>;
                }[] = [
                  { key: 'main', name: 'المخزن الرئيسي', desc: 'استقبال مشتريات وتوزيع', Icon: Building2, stats: main },
                  { key: 'showroom', name: 'المعرض', desc: 'مبيعات التجزئة والعرض', Icon: Store, stats: showroom },
                ];
                return (
                  <Card key={branchName} className="border-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <MapPin className="h-5 w-5 text-primary" />
                        {branchName}
                        <Badge variant="outline" className="text-[10px] mr-auto">
                          إجمالي الفرع: {branchTotal.count} صنف • {branchTotal.qty.toLocaleString('ar-EG')} وحدة •{' '}
                          {branchTotal.value.toLocaleString('ar-EG')} ج.م
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid sm:grid-cols-3 gap-3">
                        {locCards.map(({ key, name, desc, Icon, stats }) => {
                          const selected =
                            warehouseDetail?.branch === branchName && warehouseDetail.slot === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setWarehouseDetail({ branch: branchName, slot: key })}
                              className={`text-right rounded-lg border-2 transition-colors p-4 flex flex-col gap-2 hover:border-primary/40 hover:bg-muted/20 ${
                                selected ? 'border-primary ring-2 ring-primary/25 shadow-sm' : 'border-border'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-6 w-6 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-bold text-sm">{name}</p>
                                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                                </div>
                              </div>
                              <div className="text-xs space-y-0.5 border-t pt-2 mt-1">
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">أصناف:</span>
                                  <strong>{stats.count}</strong>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">إجمالي الكمية:</span>
                                  <strong>{stats.qty.toLocaleString('ar-EG')}</strong>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">قيمة المخزون:</span>
                                  <strong>{stats.value.toLocaleString('ar-EG')} ج.م</strong>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setTechBranchFilter(branchName);
                            setHubSection('technicians');
                          }}
                          className="text-right rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors p-4 flex flex-col gap-2 hover:bg-muted/20"
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="h-6 w-6 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-sm">عربية الفني</p>
                              <p className="text-[10px] text-muted-foreground">مخزون متحرك — من حركات مسجّلة باسم فني</p>
                            </div>
                          </div>
                          <div className="text-xs space-y-0.5 border-t pt-2 mt-1">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">حركات مرتبطة:</span>
                              <strong>{techS.lines.toLocaleString('ar-EG')}</strong>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">صافي كمية (تقريبي):</span>
                              <strong dir="ltr">{techS.netQty.toLocaleString('ar-EG')}</strong>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1">اضغط للانتقال إلى «مخزون الفنيين» مع فلتر هذا الفرع</p>
                          </div>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {warehouseDetail && (
                <Card className="border-primary/25 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                      تفاصيل الأصناف: {warehouseDetail.branch} —{' '}
                      {warehouseDetail.slot === 'main' ? STORAGE_MAIN : STORAGE_SHOWROOM}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mr-auto h-8 text-xs"
                        onClick={() => setWarehouseDetail(null)}
                      >
                        إخفاء القائمة
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {warehouseDetailProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        لا توجد أصناف مسجّلة في هذا الموقع ضمن الفرع (أو كلها برصيد صفر). أضف منتجاً واختر المعرض أو المخزن الرئيسي، أو انقل الصنف من تعديل المنتج.
                      </p>
                    ) : (
                      <div className="grid gap-1 max-h-72 overflow-y-auto">
                        {warehouseDetailProducts.map((p) => {
                          const v = (Number(p.stock) || 0) * (Number(p.cost) || 0);
                          return (
                            <div
                              key={p.id}
                              className="flex flex-wrap items-center justify-between gap-2 bg-background/80 rounded px-2 py-2 text-xs border border-border/60"
                            >
                              <span className="font-medium text-foreground">{p.name}</span>
                              <div className="flex flex-wrap items-center gap-3">
                                <span>
                                  كمية: <strong>{(Number(p.stock) || 0).toLocaleString('ar-EG')}</strong>
                                </span>
                                <span className="text-muted-foreground">
                                  قيمة: {v.toLocaleString('ar-EG')} ج.م
                                </span>
                                <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => openEditProduct(p)}>
                                  تعديل المنتج
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          {hubSection === 'technicians' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5" /> مخزون الفنيين
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  ملخص حركات الفنيين حسب المنتج والتاريخ. الأفضل اختيار «حساب الفني» أثناء تسجيل الحركة لربط المخزون بالحساب مباشرة. ما زال الإدخال اليدوي للاسم مدعوماً كحل بديل.
                </p>
                <div className="grid gap-2 md:grid-cols-5">
                  <div>
                    <Label className="text-xs">الفرع</Label>
                    <Select
                      value={techBranchFilter}
                      onValueChange={(v) =>
                        setTechBranchFilter(v as 'all' | typeof BRANCH_ALEX | typeof BRANCH_GIZA)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="كل الفروع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الفروع</SelectItem>
                        <SelectItem value={BRANCH_ALEX}>{BRANCH_ALEX}</SelectItem>
                        <SelectItem value={BRANCH_GIZA}>{BRANCH_GIZA}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">من تاريخ</Label>
                    <Input type="date" value={techDateFrom} onChange={(e) => setTechDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">إلى تاريخ</Label>
                    <Input type="date" value={techDateTo} onChange={(e) => setTechDateTo(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">بحث باسم الفني</Label>
                    <Input value={techSearch} onChange={(e) => setTechSearch(e.target.value)} placeholder="مثال: أحمد" />
                  </div>
                  <div>
                    <Label className="text-xs">بحث بالمنتج</Label>
                    <Input value={techProductSearch} onChange={(e) => setTechProductSearch(e.target.value)} placeholder="مثال: شمعة أولى" />
                  </div>
                </div>
                <div className="rounded-md bg-muted/30 p-2 text-xs flex flex-wrap gap-3">
                  <span>الحركات في النطاق: <strong className="text-foreground">{filteredTechnicianRows.length.toLocaleString('ar-EG')}</strong></span>
                  <span>الفترة: <strong className="text-foreground">{techDateFrom ? formatDateDisplay(techDateFrom) : 'من البداية'} - {techDateTo ? formatDateDisplay(techDateTo) : 'حتى الآن'}</strong></span>
                  {techBranchFilter !== 'all' && (
                    <span>
                      الفرع: <strong className="text-foreground">{techBranchFilter}</strong>
                    </span>
                  )}
                  {techProductSearch.trim() && <span>المنتج: <strong className="text-foreground">{techProductSearch}</strong></span>}
                </div>
                {techniciansSummary.length === 0 ? (
                  <p className="text-xs">لا توجد حركات مطابقة للفترة أو الفلاتر الحالية. تأكد من كتابة اسم الفني عند إضافة الحركة، ثم حدّد المدة المطلوبة.</p>
                ) : (
                  techniciansSummary.map((t) => (
                    <div key={t.name} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-foreground text-base">{t.name}</p>
                          <p className="text-xs">عدد الحركات: {t.lines.toLocaleString('ar-EG')}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-foreground">صافي الكمية: {t.qty.toLocaleString('ar-EG')}</p>
                          {t.value > 0 && <p className="text-xs">القيمة: {t.value.toLocaleString('ar-EG')} ج.م</p>}
                        </div>
                      </div>
                      {t.topProducts.length > 0 && (
                        <div className="border-t pt-2">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">المنتجات خلال الفترة:</p>
                          <div className="grid gap-1">
                            {t.topProducts.map(([n, info]) => (
                              <div key={n} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 text-xs gap-3 flex-wrap">
                                <div>
                                  <span className="text-foreground font-medium">{n}</span>
                                  <p className="text-[11px] text-muted-foreground">
                                    من {formatDateDisplay(info.firstDate)} إلى {formatDateDisplay(info.lastDate)} - {info.lines.toLocaleString('ar-EG')} حركة
                                  </p>
                                </div>
                                <div className="flex gap-3">
                                  <span className="font-medium text-foreground">كمية: {info.qty.toLocaleString('ar-EG')}</span>
                                  {info.value > 0 && <span className="text-muted-foreground">({info.value.toLocaleString('ar-EG')} ج.م)</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">آخر الحركات (حتى 15):</p>
                        <div className="grid gap-1 max-h-56 overflow-y-auto">
                          {filteredTechnicianRows
                            .filter((r) => r.technician === t.name)
                            .slice(0, 15)
                            .map((r) => {
                              const src = extractSourceFromNotes(r.notes);
                              const typeLabel =
                                r.type === 'sale'
                                  ? 'منصرف'
                                  : r.type === 'purchase'
                                    ? 'وارد'
                                    : r.type === 'adjustment'
                                      ? 'تعديل'
                                      : r.type === 'opening_balance'
                                        ? 'رصيد أول'
                                        : r.type;
                              return (
                                <div
                                  key={r.id}
                                  className="flex flex-wrap items-center justify-between gap-2 bg-background/80 rounded px-2 py-1.5 text-[11px] border border-border/60 text-foreground"
                                >
                                  <span className="text-muted-foreground shrink-0">{formatDateDisplay(r.date)}</span>
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    {typeLabel}
                                  </Badge>
                                  <span className="font-medium flex-1 min-w-[100px] truncate">{r.productName}</span>
                                  <span dir="ltr" className="font-semibold shrink-0">
                                    {r.qty > 0 ? '+' : ''}
                                    {r.qty.toLocaleString('ar-EG')}
                                  </span>
                                  <Badge variant={r.technicianUserId ? 'secondary' : 'outline'} className="text-[9px] shrink-0">
                                    {r.technicianUserId ? 'مرتبط بالحساب' : 'اسم يدوي'}
                                  </Badge>
                                  {src && <span className="text-muted-foreground shrink-0">من {src}</span>}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={quickStockOpen} onOpenChange={setQuickStockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل رصيد المنتج</DialogTitle>
          </DialogHeader>
          {quickProduct && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{quickProduct.name}</p>
              <div>
                <Label>الرصيد الجديد</Label>
                <Input type="number" dir="ltr" min={0} value={quickStockValue} onChange={(e) => setQuickStockValue(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">يُسجّل فرق الرصيد كحركة تعديل في الجرد.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setQuickStockOpen(false)}>إلغاء</Button>
                <Button onClick={saveQuickStock} disabled={quickStockSaving}>{quickStockSaving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* حركة مخزون */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {movementForm.type === 'purchase' && '📥 إضافة وارد'}
              {movementForm.type === 'sale' && '📤 تسجيل منصرف'}
              {movementForm.type === 'opening_balance' && '📋 رصيد أول المدة'}
              {movementForm.type === 'adjustment' && '✏️ تعديل الرصيد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label className="font-semibold text-base">المكان / المخزن *</Label>
              <Select
                value={movementForm.movement_location}
                onValueChange={(v) =>
                  setMovementForm((p) => ({
                    ...p,
                    movement_location: v as typeof STORAGE_MAIN | typeof STORAGE_SHOWROOM,
                    product_id: '',
                  }))
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STORAGE_MAIN}>المخزن الرئيسي</SelectItem>
                  <SelectItem value={STORAGE_SHOWROOM}>المعرض</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                الحركة تُسجّل لهذا الموقع فقط؛ قائمة المنتجات أدناه تعرض أصناف هذا المخزن.
              </p>
            </div>

            <div>
              <Label className="font-semibold">المنتج *</Label>
              <ProductSearchCombobox
                products={movementProducts}
                value={movementForm.product_id}
                onValueChange={onMovementProductChange}
              />
              {movementForm.product_id && (() => {
                const p = products.find(x => x.id === movementForm.product_id);
                return p ? (
                  <div className="mt-1 p-2 rounded-lg bg-muted/50 text-xs flex flex-wrap gap-3">
                    <span>الرصيد الحالي: <strong>{p.stock}</strong></span>
                    <span>سعر الشراء: <strong>{p.cost || 0}</strong></span>
                    <span>سعر البيع: <strong>{p.price || 0}</strong></span>
                    {p.supplier_name && <span>المورد: <strong>{p.supplier_name}</strong></span>}
                  </div>
                ) : null;
              })()}
            </div>

            <div>
              <Label>نوع الحركة</Label>
              <Select value={movementForm.type} onValueChange={(v) => setMovementForm((p) => ({ ...p, type: v as typeof movementForm.type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">وارد (شراء / توريد)</SelectItem>
                  <SelectItem value="sale">منصرف (بيع)</SelectItem>
                  <SelectItem value="opening_balance">رصيد أول المدة</SelectItem>
                  <SelectItem value="adjustment">تعديل يدوي (موجب/سالب)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الكمية * {movementForm.type === 'adjustment' ? '(+/-)' : ''}</Label>
                <Input type="number" dir="ltr" min={movementForm.type === 'adjustment' ? undefined : 1} value={movementForm.quantity} onChange={e => setMovementForm(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div>
                <Label>تاريخ الحركة</Label>
                <Input type="date" value={movementForm.movement_date} onChange={e => setMovementForm(p => ({ ...p, movement_date: e.target.value }))} />
              </div>
            </div>

            {(movementForm.type === 'purchase' || movementForm.type === 'opening_balance') && (
              <div>
                <Label>المورد</Label>
                <Input
                  placeholder="اسم المورد أو الشركة"
                  value={movementForm.supplier_name}
                  onChange={e => setMovementForm(p => ({ ...p, supplier_name: e.target.value }))}
                />
              </div>
            )}

            {movementForm.type === 'sale' && (
              <div>
                <Label>اسم العميل</Label>
                <Input
                  placeholder="اسم العميل"
                  value={movementForm.customer_name}
                  onChange={e => setMovementForm(p => ({ ...p, customer_name: e.target.value }))}
                />
              </div>
            )}

            <div>
              <Label>حساب الفني (اختياري)</Label>
              <Select
                value={movementForm.technician_user_id ? movementForm.technician_user_id : 'none'}
                onValueChange={(v) =>
                  setMovementForm((p) => ({
                    ...p,
                    technician_user_id: v === 'none' ? '' : v,
                    technician_name: v === 'none' ? p.technician_name : '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر حساب الفني" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون ربط حساب</SelectItem>
                  {technicianAccounts.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                عند الاختيار، حركة مخزون الفني تُربط مباشرة بحسابه.
              </p>
            </div>

            <div>
              <Label>اسم الفني اليدوي (اختياري)</Label>
              <Input
                placeholder="يستخدم فقط إذا لم يتم اختيار حساب فني"
                value={movementForm.technician_name}
                disabled={!!movementForm.technician_user_id}
                onChange={e => setMovementForm(p => ({ ...p, technician_name: e.target.value }))}
              />
            </div>

            <div>
              <Label>القسم / التصنيف</Label>
              <Input
                value={movementCategorySearch}
                onChange={e => setMovementCategorySearch(e.target.value)}
                placeholder="اكتب حرف للبحث في الأقسام..."
                className="mb-2"
              />
              <Select
                value={movementForm.category || 'غير مصنف'}
                onValueChange={v => setMovementForm(p => ({ ...p, category: v }))}
              >
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {filteredMovementCategoryOptions.map((name) => (
                    <SelectItem key={`movement-cat-${name}`} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>سعر الشراء (رصيد أول المدة)</Label>
                <Input
                  type="number"
                  dir="ltr"
                  placeholder="سعر الشراء"
                  value={movementForm.unit_cost}
                  onChange={e => setMovementForm(p => ({ ...p, unit_cost: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">السعر اللي اشتريت بيه المنتج</p>
              </div>
              <div>
                <Label>سعر البيع (رصيد آخر المدة)</Label>
                <Input
                  type="number"
                  dir="ltr"
                  placeholder="سعر البيع"
                  value={movementForm.sell_price}
                  onChange={e => setMovementForm(p => ({ ...p, sell_price: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">السعر اللي هيتباع بيه</p>
              </div>
            </div>

            <div>
              <Label>رقم الفاتورة / المرجع (اختياري)</Label>
              <Input
                dir="ltr"
                placeholder="PO-102 / INV-889"
                value={movementForm.reference}
                onChange={e => setMovementForm(p => ({ ...p, reference: e.target.value }))}
              />
            </div>
            <div>
              <Label>ملاحظات (اختياري)</Label>
              <Input
                placeholder="مثال: وارد من المصنع — دفعة مارس"
                value={movementForm.notes}
                onChange={e => setMovementForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            {movementForm.product_id && Number(movementForm.quantity) > 0 && (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-3 text-xs space-y-1">
                  <p className="font-semibold text-sm">ملخص الحركة:</p>
                  <p>المنتج: <strong>{products.find(x => x.id === movementForm.product_id)?.name}</strong></p>
                  <p>الكمية: <strong>{movementForm.quantity}</strong> — النوع: <strong>
                    {movementForm.type === 'purchase' ? 'وارد' : movementForm.type === 'sale' ? 'منصرف' : movementForm.type === 'opening_balance' ? 'رصيد أول المدة' : 'تعديل'}
                  </strong></p>
                  {Number(movementForm.unit_cost) > 0 && (
                    <p>الإجمالي (شراء): <strong>{(Number(movementForm.quantity) * Number(movementForm.unit_cost)).toLocaleString('ar-EG')} ج.م</strong></p>
                  )}
                  {Number(movementForm.sell_price) > 0 && (
                    <p>الإجمالي (بيع): <strong>{(Number(movementForm.quantity) * Number(movementForm.sell_price)).toLocaleString('ar-EG')} ج.م</strong></p>
                  )}
                  <p>الرصيد بعد الحركة: <strong>{
                    Math.max(0, (Number(products.find(x => x.id === movementForm.product_id)?.stock) || 0) +
                    (movementForm.type === 'sale' ? -Math.abs(Number(movementForm.quantity)) : movementForm.type === 'adjustment' ? Number(movementForm.quantity) : Math.abs(Number(movementForm.quantity))))
                  }</strong></p>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setMovementOpen(false)}>إلغاء</Button>
              <Button onClick={handleManualMovement} disabled={movementSaving} size="lg">
                {movementSaving
                  ? 'جاري الحفظ...'
                  : movementForm.type === 'purchase'
                    ? 'حفظ الوارد وتحديث المخزون'
                    : movementForm.type === 'sale'
                      ? 'حفظ المنصرف وتحديث المخزون'
                      : movementForm.type === 'opening_balance'
                        ? 'حفظ رصيد أول المدة'
                        : 'حفظ التعديل'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Product Dialog */}
      <Dialog open={addProductOpen} onOpenChange={open => { setAddProductOpen(open); if (!open) resetProductForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProductId ? 'تعديل منتج' : 'إضافة منتج'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
              <Label className="text-sm font-semibold">موقع الإضافة — قائمة اختيار</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                اختر من القائمة: <strong className="text-foreground">المخزن الرئيسي</strong> أو <strong className="text-foreground">المعرض</strong> (يحدد ظهور الصنف في المخزن والتحويل للمناديب).
              </p>
              <Select
                value={normalizeStorageLocation(productForm.storage_location)}
                onValueChange={(v) =>
                  setProductForm((p) => ({ ...p, storage_location: normalizeStorageLocation(v) }))
                }
              >
                <SelectTrigger className="bg-background font-medium">
                  <SelectValue placeholder="المخزن الرئيسي أو المعرض" />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_LOCATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>اسم المنتج *</Label>
              <Input
                value={productForm.name}
                onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                placeholder="مثال: فلتر RO 7 مراحل"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">SKU / كود الصنف</Label>
                <Input dir="ltr" value={productForm.sku} onChange={e => setProductForm(p => ({ ...p, sku: e.target.value }))} placeholder="RO-7001" />
              </div>
              <div>
                <Label className="text-xs">الباركود</Label>
                <Input dir="ltr" value={productForm.barcode} onChange={e => setProductForm(p => ({ ...p, barcode: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">الوحدة</Label>
                <Input value={productForm.unit} onChange={e => setProductForm(p => ({ ...p, unit: e.target.value }))} placeholder="قطعة" />
              </div>
              <div>
                <Label className="text-xs">حد التنبيه الأدنى</Label>
                <Input type="number" dir="ltr" value={productForm.min_stock} onChange={e => setProductForm(p => ({ ...p, min_stock: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">المورد</Label>
              <Input value={productForm.supplier} onChange={e => setProductForm(p => ({ ...p, supplier: e.target.value }))} placeholder="اسم المورد" />
            </div>
            <div>
              <Label>وصف / ملاحظات</Label>
              <Textarea
                className="min-h-[72px] text-sm"
                value={productForm.description}
                onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))}
                placeholder="مواصفات، ملاحظات تركيب، توافق مع أجهزة..."
              />
            </div>
            <div>
              <Label>القسم (رئيسي أو فرعي)</Label>
              <Input
                value={addProductCategorySearch}
                onChange={e => setAddProductCategorySearch(e.target.value)}
                placeholder="اكتب حرف للبحث في الأقسام..."
                className="mb-2"
              />
              <Select
                value={productForm.category || 'غير مصنف'}
                onValueChange={v => setProductForm(p => ({ ...p, category: v }))}
              >
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {filteredAddProductCategoryOptions.map((name) => (
                    <SelectItem key={`add-product-cat-${name}`} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>صورة المنتج {editingProductId && <span className="text-muted-foreground font-normal">(اتركها فارغة للإبقاء على الصورة الحالية)</span>}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setProductImage(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddProductOpen(false)}>إلغاء</Button>
              <Button onClick={editingProductId ? handleUpdateProduct : handleAddProduct} disabled={savingProduct}>
                {savingProduct ? 'جاري الحفظ...' : editingProductId ? 'حفظ التعديلات' : 'حفظ'}
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
                  <SelectItem value="supplies">مستلزمات</SelectItem>
                  <SelectItem value="tools">أدوات فنيين</SelectItem>
                  <SelectItem value="technician">عربية / فني</SelectItem>
                  <SelectItem value="station">محطة</SelectItem>
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
