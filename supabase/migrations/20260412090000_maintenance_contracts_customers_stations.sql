ALTER TABLE public.customer_devices
  ADD COLUMN IF NOT EXISTS contract_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_duration_months integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS contract_first_visit_date date,
  ADD COLUMN IF NOT EXISTS contract_installment_interval_months integer NOT NULL DEFAULT 1;

ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'بدون عقد',
  ADD COLUMN IF NOT EXISTS contract_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_duration_months integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS contract_first_visit_date date,
  ADD COLUMN IF NOT EXISTS contract_installments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_installment_interval_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS contract_first_installment_date date;

CREATE TABLE IF NOT EXISTS public.station_contract_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  installment_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'معلق',
  collection_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_station_contract_installments_station_id
  ON public.station_contract_installments(station_id);

CREATE INDEX IF NOT EXISTS idx_station_contract_installments_installment_date
  ON public.station_contract_installments(installment_date);
