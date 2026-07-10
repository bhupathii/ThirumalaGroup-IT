-- Idempotent migration to add promised_amount to loan_payment_followups table
ALTER TABLE finance.loan_payment_followups ADD COLUMN IF NOT EXISTS promised_amount NUMERIC;
