-- Migration to add action_type to transaction_reviews and support REJECTED status
ALTER TABLE finance.transaction_reviews 
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'CREATE' CHECK (action_type IN ('CREATE', 'EDIT', 'DELETE'));

ALTER TABLE finance.transaction_reviews 
  ALTER COLUMN action_type SET DEFAULT 'CREATE';

-- Drop potential check constraints on review_status and recreate
ALTER TABLE finance.transaction_reviews DROP CONSTRAINT IF EXISTS transaction_reviews_review_status_check;
ALTER TABLE finance.transaction_reviews DROP CONSTRAINT IF EXISTS transaction_reviews_review_status_check1;

ALTER TABLE finance.transaction_reviews 
  ADD CONSTRAINT transaction_reviews_review_status_check CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED'));
