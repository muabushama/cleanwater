ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS phone text DEFAULT '';