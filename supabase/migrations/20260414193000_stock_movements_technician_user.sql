-- Link stock movement rows to technician accounts
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS technician_user_id uuid NULL;

