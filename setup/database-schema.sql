-- =============================================
-- Oasis Suite - Full Database Schema
-- Run this in Supabase SQL Editor after creating your project
-- =============================================

-- 1. Enum
CREATE TYPE public.app_role AS ENUM ('admin', 'sales_rep');

-- 2. Tables
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  branch_id text DEFAULT '1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone1 text NOT NULL DEFAULT '',
  phone2 text DEFAULT '',
  whatsapp text DEFAULT '',
  address text NOT NULL DEFAULT '',
  region text DEFAULT '',
  branch text NOT NULL DEFAULT 'فرع الإسكندرية',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'فلاتر مياه',
  classification text NOT NULL DEFAULT 'منزلي',
  cost numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  price1 numeric NOT NULL DEFAULT 0,
  price2 numeric NOT NULL DEFAULT 0,
  price3 numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 5,
  warranty integer NOT NULL DEFAULT 12,
  image text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customer_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  product_name text NOT NULL DEFAULT '',
  device_type text NOT NULL DEFAULT '',
  serial_number text DEFAULT '',
  customer_code text DEFAULT '',
  install_date date,
  contract_type text NOT NULL DEFAULT 'كاش',
  selling_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  installments_count integer NOT NULL DEFAULT 0,
  installment_amount numeric NOT NULL DEFAULT 0,
  first_installment_date date,
  warranty_months integer NOT NULL DEFAULT 12,
  warranty_status text NOT NULL DEFAULT 'ساري',
  ad_source text DEFAULT '',
  branch text NOT NULL DEFAULT 'فرع الإسكندرية',
  notes text DEFAULT '',
  candles jsonb NOT NULL DEFAULT '[{"name":"الشمعة الأولى","type":"عادي درجة اولى","price":30,"duration_months":3},{"name":"الشمعة الثانية","type":"عادي درجة اولى","price":30,"duration_months":6},{"name":"الشمعة الثالثة","type":"عادي درجة اولى","price":30,"duration_months":9},{"name":"الشمعة الرابعة","type":"عادي درجة اولى","price":30,"duration_months":24},{"name":"الشمعة الخامسة","type":"عادي درجة اولى","price":30,"duration_months":12},{"name":"الشمعة السادسة","type":"عادي درجة اولى","price":30,"duration_months":24},{"name":"الشمعة السابعة","type":"عادي درجة اولى","price":30,"duration_months":24}]',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.candle_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  device_id uuid NOT NULL REFERENCES public.customer_devices(id),
  change_date date NOT NULL DEFAULT CURRENT_DATE,
  candle1 boolean NOT NULL DEFAULT false,
  candle2 boolean NOT NULL DEFAULT false,
  candle3 boolean NOT NULL DEFAULT false,
  candle4 boolean NOT NULL DEFAULT false,
  candle5 boolean NOT NULL DEFAULT false,
  candle6 boolean NOT NULL DEFAULT false,
  candle7 boolean NOT NULL DEFAULT false,
  cost numeric NOT NULL DEFAULT 0,
  collected numeric NOT NULL DEFAULT 0,
  remaining numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'تمت',
  technician text DEFAULT '',
  tds_reading text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  device_id uuid NOT NULL REFERENCES public.customer_devices(id),
  installment_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'معلق',
  collection_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  customer_name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  product_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  remaining numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  type text NOT NULL DEFAULT 'cash',
  date date NOT NULL DEFAULT CURRENT_DATE,
  rep_name text DEFAULT '',
  branch text NOT NULL DEFAULT 'فرع الإسكندرية',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'تغيير شمعات',
  next_date date NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  technician text DEFAULT '',
  cost numeric NOT NULL DEFAULT 0,
  phone text DEFAULT '',
  branch text NOT NULL DEFAULT 'فرع الإسكندرية',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  region text DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  branch text NOT NULL DEFAULT 'فرع الإسكندرية',
  status text NOT NULL DEFAULT 'pending',
  delivery_status text NOT NULL DEFAULT 'pending',
  visit_date text NOT NULL DEFAULT '',
  visit_time text DEFAULT '',
  install_date text DEFAULT '',
  warranty_status text DEFAULT 'ساري',
  warranty_until text DEFAULT '',
  technician text DEFAULT '',
  assigned_rep uuid,
  customer_code text DEFAULT '',
  customer_id_num integer DEFAULT 0,
  location_url text DEFAULT '',
  notes text DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]',
  previous_visits jsonb NOT NULL DEFAULT '[]',
  price1 numeric NOT NULL DEFAULT 0,
  price2 numeric NOT NULL DEFAULT 0,
  price3 numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  transport_cost numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rep_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 3. Functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

-- 4. Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candle_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- profiles
CREATE POLICY "Anyone authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "Authenticated can read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- customers
CREATE POLICY "Authenticated can read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update customers" ON public.customers FOR UPDATE TO authenticated USING (true);

-- products
CREATE POLICY "Authenticated can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- customer_devices
CREATE POLICY "Authenticated can read customer_devices" ON public.customer_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customer_devices" ON public.customer_devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update customer_devices" ON public.customer_devices FOR UPDATE TO authenticated USING (true);

-- candle_changes
CREATE POLICY "Authenticated can read candle_changes" ON public.candle_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert candle_changes" ON public.candle_changes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update candle_changes" ON public.candle_changes FOR UPDATE TO authenticated USING (true);

-- installments
CREATE POLICY "Authenticated can read installments" ON public.installments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert installments" ON public.installments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update installments" ON public.installments FOR UPDATE TO authenticated USING (true);

-- invoices
CREATE POLICY "Authenticated can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true);

-- maintenance
CREATE POLICY "Authenticated can read maintenance" ON public.maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert maintenance" ON public.maintenance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update maintenance" ON public.maintenance FOR UPDATE TO authenticated USING (true);

-- work_orders
CREATE POLICY "Authenticated can read work_orders" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert work_orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update work_orders" ON public.work_orders FOR UPDATE TO authenticated USING (true);

-- rep_locations
CREATE POLICY "Authenticated can read locations" ON public.rep_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reps can insert own location" ON public.rep_locations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- system_settings
CREATE POLICY "Admins can read settings" ON public.system_settings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settings" ON public.system_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 7. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Authenticated update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
