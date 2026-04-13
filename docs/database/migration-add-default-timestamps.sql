-- Migration Script: Add default values to existing table
-- Run this if the table already exists and you want to add default values

-- Step 1: Add default values to columns
ALTER TABLE public.fms_rp_entry_gsolution_thienlong_2601
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Step 2: Create function for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 3: Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS update_fms_rp_entry_gsolution_thienlong_2601_updated_at 
  ON public.fms_rp_entry_gsolution_thienlong_2601;

CREATE TRIGGER update_fms_rp_entry_gsolution_thienlong_2601_updated_at 
  BEFORE UPDATE ON public.fms_rp_entry_gsolution_thienlong_2601 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Update existing rows (if any have NULL values)
UPDATE public.fms_rp_entry_gsolution_thienlong_2601
SET 
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now())
WHERE created_at IS NULL OR updated_at IS NULL;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'fms_rp_entry_gsolution_thienlong_2601'
  AND column_name IN ('created_at', 'updated_at');

