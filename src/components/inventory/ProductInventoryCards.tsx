import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatEGP } from '@/data/demo-data';
import { normalizeStorageLocation, STORAGE_SHOWROOM } from '@/lib/storageLocation';
import { Edit, Package } from 'lucide-react';

export interface InventoryProductCardModel {
  id: string;
  name: string;
  category: string;
  classification?: string;
  stock: number;
  min_stock: number;
  cost: number;
  price?: number;
  sku_code?: string | null;
  barcode?: string | null;
  image?: string | null;
  storage_location?: string | null;
}

interface ProductInventoryCardsProps {
  products: InventoryProductCardModel[];
  loading?: boolean;
  onProductClick?: (product: InventoryProductCardModel) => void;
  /** تعديل بيانات المنتج كاملة (اسم، أسعار، صورة...) */
  onEditProduct?: (product: InventoryProductCardModel) => void;
  className?: string;
}

export function ProductInventoryCards({
  products,
  loading = false,
  onProductClick,
  onEditProduct,
  className = '',
}: ProductInventoryCardsProps) {
  if (loading) {
    return <div className={`text-muted-foreground text-center py-16 ${className}`}>جاري التحميل...</div>;
  }

  if (products.length === 0) {
    return <div className={`text-muted-foreground text-center py-16 text-sm ${className}`}>لا توجد منتجات في هذا العرض</div>;
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 ${className}`} dir="rtl">
      {products.map((p) => {
        const low = Number(p.stock) <= Number(p.min_stock || 0);
        const sku = (p.sku_code || '').trim();
        const loc = normalizeStorageLocation(p.storage_location);
        const locShort = loc === STORAGE_SHOWROOM ? 'معرض' : 'مخزن';
        return (
          <Card
            key={p.id}
            className={`overflow-hidden border-2 transition-all hover:shadow-lg cursor-pointer ${
              low ? 'border-destructive/40 ring-1 ring-destructive/20' : 'border-border/80 hover:border-primary/30'
            }`}
            onClick={() => onProductClick?.(p)}
          >
            <CardContent className="p-0">
              <div className="aspect-[4/3] bg-gradient-to-br from-primary/5 to-muted flex items-center justify-center overflow-hidden">
                {p.image ? (
                  <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Package className="h-14 w-14 text-muted-foreground/40" />
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm leading-snug line-clamp-2">{p.name}</h3>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={low ? 'destructive' : 'secondary'} className="text-[10px]">
                      {low ? 'منخفض' : 'متوفر'}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-normal">
                      {locShort}
                    </Badge>
                  </div>
                </div>
                {sku && <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">SKU: {sku}</p>}
                <p className="text-xs text-muted-foreground line-clamp-1">{p.category}</p>
                <div className="flex items-end justify-between pt-1 border-t">
                  <div>
                    <p className="text-[10px] text-muted-foreground">المتوفر</p>
                    <p className={`text-lg font-black ${low ? 'text-destructive' : 'text-primary'}`}>{p.stock}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-muted-foreground">تكلفة</p>
                    <p className="text-xs font-semibold">{formatEGP(p.cost)}</p>
                  </div>
                </div>
                {onEditProduct && (
                  <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8 gap-1 text-xs"
                      onClick={() => onEditProduct(p)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      تعديل بيانات المنتج
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
