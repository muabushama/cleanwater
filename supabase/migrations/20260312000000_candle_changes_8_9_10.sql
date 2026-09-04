-- Add candle8, candle9, candle10 to candle_changes for 10 candles support
ALTER TABLE public.candle_changes ADD COLUMN IF NOT EXISTS candle8 boolean NOT NULL DEFAULT false;
ALTER TABLE public.candle_changes ADD COLUMN IF NOT EXISTS candle9 boolean NOT NULL DEFAULT false;
ALTER TABLE public.candle_changes ADD COLUMN IF NOT EXISTS candle10 boolean NOT NULL DEFAULT false;
