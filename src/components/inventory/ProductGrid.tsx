import { Badge } from '@/components/ui/badge';
import { formatEGP } from '@/data/demo-data';

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  classification: string;
  stock: number;
  min_stock: number;
  cost: number;
  branch?: string;
}

interface ProductGridProps {
  products: ProductRow[];
  loading?: boolean;
  className?: string;
}

export function ProductGrid({ products, loading = false, className = '' }: ProductGridProps) {
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
            <th className="text-right p-3 font-medium">الفئة</th>
            <th className="text-right p-3 font-medium">المخزون</th>
            <th className="text-right p-3 font-medium">الحد الأدنى</th>
            <th className="text-right p-3 font-medium">التكلفة</th>
            <th className="text-right p-3 font-medium">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="p-3 font-medium">{p.name}</td>
              <td className="p-3 text-muted-foreground">{p.category}</td>
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
