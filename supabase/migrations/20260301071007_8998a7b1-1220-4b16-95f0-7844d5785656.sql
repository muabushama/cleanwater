
-- Add 3 price tiers to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price1 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price2 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price3 numeric NOT NULL DEFAULT 0;

-- Add 3 price tiers to work_orders table
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS price1 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS price2 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS price3 numeric NOT NULL DEFAULT 0;
