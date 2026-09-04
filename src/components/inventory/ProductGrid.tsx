import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEGP } from '@/data/demo-data';
import { normalizeStorageLocation, STORAGE_SHOWROOM } from '@/lib/storageLocation';
import { Edit } from 'lucide-react';

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  classification: string;
  stock: number;
  min_stock: number;
  cost: number;
  branch?: string;
  sku_code?: string | null;
  barcode?: string | null;
  storage_location?: string | null;
}

interface ProductGridProps {
  products: ProductRow[];
  loading?: boolean;
  className?: string;
  /** ضغطة على صف المنتج (مثلاً تعديل سريع للرصيد) */
  onRowClick?: (product: ProductRow) => void;
  onEditProduct?: (product: ProductRow) => void;
}

export function ProductGrid({ products, loading = false, className = '', onRowClick, onEditProduct }: ProductGridProps) {
  if (loading) {
    return (
      <div className={`text-muted-foreground text-center py-12 ${className}`}>
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`} dir="rtl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-right p-3 font-medium">المنتج</th>
            <th className="text-right p-3 font-medium">SKU</th>
            <th className="text-right p-3 font-medium">الفئة</th>
            <th className="text-right p-3 font-medium">الموقع</th>
            <th className="text-right p-3 font-medium">المخزون</th>
            <th className="text-right p-3 font-medium">الحد الأدنى</th>
            <th className="text-right p-3 font-medium">التكلفة</th>
            <th className="text-right p-3 font-medium">الحالة</th>
            {onEditProduct && <th className="text-center p-3 font-medium w-[100px]">تعديل</th>}
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr
              key={p.id}
              className={`border-b hover:bg-muted/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(p) : undefined}
            >
              <td className="p-3 font-medium">{p.name}</td>
              <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{(p.sku_code || '').trim() || '—'}</td>
              <td className="p-3 text-muted-foreground">{p.category}</td>
              <td className="p-3 text-muted-foreground text-xs">
                {normalizeStorageLocation(p.storage_location) === STORAGE_SHOWROOM ? 'معرض' : 'مخزن رئيسي'}
              </td>
              <td className="p-3">{p.stock}</td>
              <td className="p-3">{p.min_stock}</td>
              <td className="p-3">{formatEGP(p.cost)}</td>
              <td className="p-3">
                <Badge
                  variant={Number(p.stock) <= Number(p.min_stock) ? 'destructive' : 'outline'}
                  className="text-[10px]"
                >
                  {Number(p.stock) <= Number(p.min_stock) ? 'منخفض' : 'متوفر'}
                </Badge>
              </td>
              {onEditProduct && (
                <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => onEditProduct(p)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    تعديل
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {products.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">لا توجد منتجات في هذا القسم</div>
      )}
    </div>
  );
}
