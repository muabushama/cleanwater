-- موقع التخزين داخل الفرع: مخزن رئيسي أو معرض
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS storage_location text DEFAULT 'المخزن الرئيسي';

COMMENT ON COLUMN public.products.storage_location IS 'المخزن الرئيسي | المعرض';
