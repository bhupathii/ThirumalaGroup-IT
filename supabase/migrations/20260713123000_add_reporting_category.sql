-- Migration: Add Reporting Category to Main Accounts and Transactions
-- Date: 2026-07-13

-- 1. Create the enum type in public schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_category_type') THEN
        CREATE TYPE public.report_category_type AS ENUM ('BALANCE_SHEET', 'PROFIT_LOSS');
    END IF;
END $$;

-- 2. Update regular.company_main_accounts
ALTER TABLE regular.company_main_accounts 
ADD COLUMN IF NOT EXISTS report_category public.report_category_type DEFAULT 'BALANCE_SHEET'::public.report_category_type;

-- Set existing accounts to 'BALANCE_SHEET' to ensure no null values (already handled by DEFAULT, but let's be safe)
UPDATE regular.company_main_accounts SET report_category = 'BALANCE_SHEET'::public.report_category_type WHERE report_category IS NULL;

ALTER TABLE regular.company_main_accounts ALTER COLUMN report_category SET NOT NULL;

-- 3. Update itr.company_main_accounts
ALTER TABLE itr.company_main_accounts 
ADD COLUMN IF NOT EXISTS report_category public.report_category_type DEFAULT 'BALANCE_SHEET'::public.report_category_type;

UPDATE itr.company_main_accounts SET report_category = 'BALANCE_SHEET'::public.report_category_type WHERE report_category IS NULL;

ALTER TABLE itr.company_main_accounts ALTER COLUMN report_category SET NOT NULL;

-- 4. Add columns to regular cash_book tables
ALTER TABLE regular.cash_book ADD COLUMN IF NOT EXISTS report_category public.report_category_type;
ALTER TABLE regular.cash_book ADD COLUMN IF NOT EXISTS head_of_account_id UUID REFERENCES regular.company_main_accounts(id) ON DELETE SET NULL;

ALTER TABLE regular.original_cash_book ADD COLUMN IF NOT EXISTS report_category public.report_category_type;
ALTER TABLE regular.original_cash_book ADD COLUMN IF NOT EXISTS head_of_account_id UUID REFERENCES regular.company_main_accounts(id) ON DELETE SET NULL;

ALTER TABLE regular.edit_cash_book ADD COLUMN IF NOT EXISTS report_category public.report_category_type;
ALTER TABLE regular.edit_cash_book ADD COLUMN IF NOT EXISTS head_of_account_id UUID REFERENCES regular.company_main_accounts(id) ON DELETE SET NULL;

ALTER TABLE regular.deleted_cash_book ADD COLUMN IF NOT EXISTS report_category public.report_category_type;
ALTER TABLE regular.deleted_cash_book ADD COLUMN IF NOT EXISTS head_of_account_id UUID REFERENCES regular.company_main_accounts(id) ON DELETE SET NULL;

-- 5. Add columns to itr cash_book tables
ALTER TABLE itr.cash_book ADD COLUMN IF NOT EXISTS report_category public.report_category_type;
ALTER TABLE itr.cash_book ADD COLUMN IF NOT EXISTS head_of_account_id UUID REFERENCES itr.company_main_accounts(id) ON DELETE SET NULL;

ALTER TABLE itr.original_cash_book ADD COLUMN IF NOT EXISTS report_category public.report_category_type;
ALTER TABLE itr.original_cash_book ADD COLUMN IF NOT EXISTS head_of_account_id UUID REFERENCES itr.company_main_accounts(id) ON DELETE SET NULL;

ALTER TABLE itr.edit_cash_book ADD COLUMN IF NOT EXISTS report_category public.report_category_type;
ALTER TABLE itr.edit_cash_book ADD COLUMN IF NOT EXISTS head_of_account_id UUID REFERENCES itr.company_main_accounts(id) ON DELETE SET NULL;

ALTER TABLE itr.deleted_cash_book ADD COLUMN IF NOT EXISTS report_category public.report_category_type;
ALTER TABLE itr.deleted_cash_book ADD COLUMN IF NOT EXISTS head_of_account_id UUID REFERENCES itr.company_main_accounts(id) ON DELETE SET NULL;
