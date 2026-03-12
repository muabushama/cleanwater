-- Add optional location link for work orders so reps can open exact map location
ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS location_url text DEFAULT ''::text;