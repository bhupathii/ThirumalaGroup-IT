require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    ALTER TABLE finance.loan_payment_followups ADD COLUMN IF NOT EXISTS promised_amount NUMERIC;
  `;
  
  console.log('Running SQL to add promised_amount column...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('❌ Error executing SQL:', error);
  } else {
    console.log('✅ SQL executed successfully!', data);
  }
}

run();
