-- المرتجعات (Returns): ربط بالمخزون والفواتير والمالية
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  branch text NOT NULL DEFAULT 'فرع الإسكندرية',
  rep_name text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_returns_branch ON public.returns(branch);
CREATE INDEX IF NOT EXISTS idx_returns_date ON public.returns(return_date);
CREATE INDEX IF NOT EXISTS idx_returns_invoice ON public.returns(invoice_id);

-- المشتريات (Purchases): ربط بالمخزون والفواتير والمالية
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number text NOT NULL,
  supplier_name text NOT NULL DEFAULT '',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  branch text NOT NULL DEFAULT 'فرع الإسكندرية',
  invoice_file_url text,
  rep_name text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_branch ON public.purchases(branch);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(purchase_date);

-- نوع الفاتورة: وارد / منصرف / مبيعات
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_direction text NOT NULL DEFAULT 'مبيعات';
COMMENT ON COLUMN public.invoices.invoice_direction IS 'مبيعات | وارد | منصرف';

-- حركات المخزون: دعم مرجع المرتجع والمشتريات (إن وُجدت أعمدة reference)
-- إن لم يكن جدول stock_movements موجوداً فسيتم إنشاؤه في migration آخر
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements') THEN
    CREATE TABLE public.stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      branch text NOT NULL DEFAULT 'فرع الإسكندرية',
      type text NOT NULL DEFAULT 'purchase',
      quantity int NOT NULL DEFAULT 0,
      reference_type text,
      reference_id text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_stock_movements_branch ON public.stock_movements(branch);
    CREATE INDEX idx_stock_movements_created ON public.stock_movements(created_at);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'reference_type') THEN
    ALTER TABLE public.stock_movements ADD COLUMN reference_type text;
    ALTER TABLE public.stock_movements ADD COLUMN reference_id text;
  END IF;
END $$;
