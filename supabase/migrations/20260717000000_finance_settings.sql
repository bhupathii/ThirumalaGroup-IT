CREATE TABLE IF NOT EXISTS public.finance_settings (
    setting_key text PRIMARY KEY,
    setting_value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
ON public.finance_settings FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Enable all access for authenticated users" 
ON public.finance_settings FOR ALL 
TO authenticated USING (true) WITH CHECK (true);

-- Default mandatory fields for LoanEntry.tsx
INSERT INTO public.finance_settings (setting_key, setting_value)
VALUES ('loan_entry_mandatory_fields', '{"borrowerAadhaar": true, "borrowerPhone": true, "g1Aadhaar": true, "g1Phone": true, "g2Aadhaar": false, "g2Phone": false, "borrowerPhoto": false, "g1Photo": false, "g2Photo": false, "borrowerDoc": false, "g1Doc": false, "g2Doc": false, "promissoryNote": false, "rcBook": false}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
