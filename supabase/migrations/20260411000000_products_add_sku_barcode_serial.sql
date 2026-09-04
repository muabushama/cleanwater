-- Add missing columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS serial_number integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku_code text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS branch text NOT NULL DEFAULT 'فرع الإسكندرية';

-- Add maintenance phone column if missing
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS phone text;
