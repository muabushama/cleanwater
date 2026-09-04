ALTER TABLE public.station_maintenance
  ADD COLUMN IF NOT EXISTS total_sale numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_lines jsonb,
  ADD COLUMN IF NOT EXISTS changed_candles jsonb;

COMMENT ON COLUMN public.station_maintenance.total_sale IS
  'Customer-facing sale total for the visit; collection and due amounts are calculated from it.';

COMMENT ON COLUMN public.station_maintenance.product_lines IS
  'Products used in the visit with quantity, unit cost, and unit sale price.';

COMMENT ON COLUMN public.station_maintenance.changed_candles IS
  'Numbers of candles/filters replaced during the visit.';
