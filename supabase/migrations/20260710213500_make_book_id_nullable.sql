-- Migration: make_book_id_nullable
-- Description: Makes book_id column nullable in capital_entries table.

ALTER TABLE finance.capital_entries ALTER COLUMN book_id DROP NOT NULL;
