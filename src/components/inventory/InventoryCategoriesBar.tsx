import { Package } from 'lucide-react';
import { getCategoryIcon } from './CategoryIcon';

export interface InventoryCategoryItem {
  id: string;
  name: string;
  icon_key?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

interface InventoryCategoriesBarProps {
  categories: InventoryCategoryItem[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  /** Flatten list: show roots and their children as separate cards (optional) */
  flat?: boolean;
  className?: string;
}

export function InventoryCategoriesBar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  flat = false,
  className = '',
}: InventoryCategoriesBarProps) {
  const roots = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const itemsToShow: { id: string; name: string; icon_key?: string | null }[] = flat
    ? roots.flatMap(r => [r, ...getChildren(r.id)])
    : roots;

  return (
    <div className={`flex flex-wrap gap-3 ${className}`} dir="rtl">
      {/* All Categories */}
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`
          flex flex-col items-center justify-center gap-2 min-w-[100px] py-4 px-4 rounded-xl
          shadow-md border-2 transition-all duration-200
          hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
          ${selectedCategoryId === null
            ? 'bg-primary text-primary-foreground border-primary shadow-primary/20'
            : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'}
        `}
      >
        <Package className="h-8 w-8" />
        <span className="text-sm font-medium">كل الأقسام</span>
      </button>

      {itemsToShow.map(cat => {
        const IconComp = getCategoryIcon(cat.icon_key);
        const isSelected = selectedCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(isSelected ? null : cat.id)}
            className={`
              flex flex-col items-center justify-center gap-2 min-w-[100px] py-4 px-4 rounded-xl
              shadow-md border-2 transition-all duration-200
              hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
              ${isSelected
                ? 'bg-primary text-primary-foreground border-primary shadow-primary/20'
                : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'}
            `}
          >
            <IconComp className="h-8 w-8" />
            <span className="text-sm font-medium text-center leading-tight">{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
