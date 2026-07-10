import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .schema('finance')
    .from('loan_payment_followups')
    .select('id, promised_amount')
    .limit(1);
    
  console.log("QueryResult for finance.loan_payment_followups:", { data, error });
}

run();
