-- ربط حركة المخزن بموقع التخزين (رئيسي / معرض) لكل سجل
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS storage_location text;

COMMENT ON COLUMN public.stock_movements.storage_location IS 'المخزن الرئيسي أو المعرض — يطابق products.storage_location';
