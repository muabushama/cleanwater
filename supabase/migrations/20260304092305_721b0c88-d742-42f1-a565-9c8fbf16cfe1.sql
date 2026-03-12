
-- Create system_settings table for storing app config like delete password
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can read settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings"
  ON public.system_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default delete password
INSERT INTO public.system_settings (key, value) VALUES ('delete_password', 'P@ss4417');

-- Add branch column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'فرع الإسكندرية';

-- Add branch column to maintenance table
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'فرع الإسكندرية';
