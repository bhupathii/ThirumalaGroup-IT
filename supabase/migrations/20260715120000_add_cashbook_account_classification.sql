-- Migration: Add report_section and category to cashbook_accounts under finance schema
-- Date: 2026-07-15

ALTER TABLE finance.cashbook_accounts ADD COLUMN IF NOT EXISTS report_section TEXT;
ALTER TABLE finance.cashbook_accounts ADD COLUMN IF NOT EXISTS category TEXT;

-- Populate the existing accounts based on report_classification or defaults
UPDATE finance.cashbook_accounts 
SET report_section = COALESCE(report_classification, 'PROFIT_AND_LOSS')
WHERE report_section IS NULL;

-- Default category based on report_section
UPDATE finance.cashbook_accounts 
SET category = CASE 
    WHEN report_section = 'BALANCE_SHEET' THEN 'Other Asset'
    ELSE 'Expense'
END
WHERE category IS NULL;
