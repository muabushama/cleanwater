
-- Add delivery-related columns to work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS assigned_rep uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'accepted', 'in_transit', 'delivered', 'rejected'));
