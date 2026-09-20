import { useState, useRef } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { matchesAnyLooseSearch } from '@/lib/searchText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type ProductPick = { id: string; name: string; stock: number; sku_code?: string | null; barcode?: string | null };

interface ProductSearchComboboxProps {
  products: ProductPick[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductSearchCombobox({
  products,
  value,
  onValueChange,
  placeholder = 'ابحث واختر المنتج',
  disabled,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = products.find((p) => p.id === value);

  const filtered = query.trim()
    ? products.filter((p) => matchesAnyLooseSearch([p.name, p.sku_code, p.barcode], query))
    : products;

  const pickProduct = (id: string) => {
    onValueChange(id);
    const picked = products.find((p) => p.id === id);
    setQuery(picked?.name || '');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) {
        setQuery(selected?.name || '');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal h-auto min-h-9 py-1 px-2 text-right"
        >
          <span className="whitespace-normal break-words text-right leading-snug flex-1">
            {selected ? `${selected.name} (رصيد: ${selected.stock})` : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[80]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            dir="rtl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اكتب اسم المنتج للبحث..."
            className="h-9"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault();
                pickProduct(filtered[0].id);
              }
            }}
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground space-y-1">
              <p>لا يوجد منتج مطابق.</p>
              <p className="text-xs">
                {products.length > 0
                  ? `المنتجات المحمّلة حالياً: ${products.length}`
                  : 'لا توجد منتجات محمّلة حالياً. راجع بيانات الفرع أو حدّث الصفحة.'}
              </p>
            </div>
          ) : (
            filtered.slice(0, 50).map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-right hover:bg-accent/50 border-b last:border-0"
                onClick={() => pickProduct(p.id)}
              >
                <Check className={cn('h-4 w-4 shrink-0 mt-0.5', value === p.id ? 'opacity-100 text-primary' : 'opacity-0')} />
                <span className="flex-1 whitespace-normal break-words text-right leading-snug">{p.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">({p.stock})</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
