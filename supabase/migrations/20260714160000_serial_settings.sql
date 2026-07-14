-- Migration: serial_settings
-- Description: Create the serial_settings table in the finance schema for start number configuration.

CREATE TABLE IF NOT EXISTS finance.serial_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_start_no INTEGER NOT NULL DEFAULT 1,
  partner_start_no INTEGER NOT NULL DEFAULT 1,
  receipt_start_no INTEGER NOT NULL DEFAULT 1,
  cd_start_no INTEGER NOT NULL DEFAULT 1,
  hp_start_no INTEGER NOT NULL DEFAULT 1,
  stbd_start_no INTEGER NOT NULL DEFAULT 1,
  tbd_start_no INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure RLS is disabled for internal/admin access
ALTER TABLE finance.serial_settings DISABLE ROW LEVEL SECURITY;

-- Insert default settings row if it's empty
INSERT INTO finance.serial_settings (customer_start_no, partner_start_no, receipt_start_no, cd_start_no, hp_start_no, stbd_start_no, tbd_start_no)
SELECT 1, 1, 1, 1, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM finance.serial_settings);
