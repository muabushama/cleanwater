
-- جدول أجهزة العملاء - لتخزين بيانات الجهاز والشمعات والضمان والتركيب والعقد
CREATE TABLE public.customer_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id) NOT NULL,
  product_name text NOT NULL DEFAULT '',
  device_type text NOT NULL DEFAULT '',
  serial_number text DEFAULT '',
  install_date date,
  warranty_months integer NOT NULL DEFAULT 12,
  warranty_status text NOT NULL DEFAULT 'ساري',
  contract_type text NOT NULL DEFAULT 'كاش',
  selling_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  installments_count integer NOT NULL DEFAULT 0,
  installment_amount numeric NOT NULL DEFAULT 0,
  first_installment_date date,
  candles jsonb NOT NULL DEFAULT '[
    {"name":"الشمعة الأولى","type":"عادي درجة اولى","duration_months":3,"price":30},
    {"name":"الشمعة الثانية","type":"عادي درجة اولى","duration_months":6,"price":30},
    {"name":"الشمعة الثالثة","type":"عادي درجة اولى","duration_months":9,"price":30},
    {"name":"الشمعة الرابعة","type":"عادي درجة اولى","duration_months":24,"price":30},
    {"name":"الشمعة الخامسة","type":"عادي درجة اولى","duration_months":12,"price":30},
    {"name":"الشمعة السادسة","type":"عادي درجة اولى","duration_months":24,"price":30},
    {"name":"الشمعة السابعة","type":"عادي درجة اولى","duration_months":24,"price":30}
  ]'::jsonb,
  branch text NOT NULL DEFAULT 'فرع الإسكندرية',
  customer_code text DEFAULT '',
  notes text DEFAULT '',
  ad_source text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.customer_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read customer_devices" ON public.customer_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customer_devices" ON public.customer_devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update customer_devices" ON public.customer_devices FOR UPDATE TO authenticated USING (true);

-- جدول سجل تغيير الشمعات (الصيانات التفصيلية)
CREATE TABLE public.candle_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id uuid REFERENCES public.customer_devices(id) NOT NULL,
  customer_id uuid REFERENCES public.customers(id) NOT NULL,
  change_date date NOT NULL DEFAULT CURRENT_DATE,
  candle1 boolean NOT NULL DEFAULT false,
  candle2 boolean NOT NULL DEFAULT false,
  candle3 boolean NOT NULL DEFAULT false,
  candle4 boolean NOT NULL DEFAULT false,
  candle5 boolean NOT NULL DEFAULT false,
  candle6 boolean NOT NULL DEFAULT false,
  candle7 boolean NOT NULL DEFAULT false,
  tds_reading text DEFAULT '',
  technician text DEFAULT '',
  cost numeric NOT NULL DEFAULT 0,
  collected numeric NOT NULL DEFAULT 0,
  remaining numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'تمت',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candle_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read candle_changes" ON public.candle_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert candle_changes" ON public.candle_changes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update candle_changes" ON public.candle_changes FOR UPDATE TO authenticated USING (true);

-- جدول الأقساط
CREATE TABLE public.installments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id uuid REFERENCES public.customer_devices(id) NOT NULL,
  customer_id uuid REFERENCES public.customers(id) NOT NULL,
  installment_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  collection_date date,
  status text NOT NULL DEFAULT 'معلق',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read installments" ON public.installments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert installments" ON public.installments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update installments" ON public.installments FOR UPDATE TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.candle_changes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;
