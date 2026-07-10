-- Migration: add_report_classification
-- Description: Adds report_classification column to cashbook_accounts and drops NOT NULL constraints on legacy capital_entries fields.

-- Add report_classification column to cashbook_accounts table if it doesn't exist
ALTER TABLE finance.cashbook_accounts ADD COLUMN IF NOT EXISTS report_classification TEXT;

-- Drop check constraint if exists, then add the constraint for BALANCE_SHEET / PROFIT_AND_LOSS
ALTER TABLE finance.cashbook_accounts DROP CONSTRAINT IF EXISTS check_report_classification;
ALTER TABLE finance.cashbook_accounts ADD CONSTRAINT check_report_classification CHECK (report_classification IN ('BALANCE_SHEET', 'PROFIT_AND_LOSS'));

-- Relax NOT NULL constraints on capital_entries table for legacy columns
ALTER TABLE finance.capital_entries ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE finance.capital_entries ALTER COLUMN type DROP NOT NULL;
