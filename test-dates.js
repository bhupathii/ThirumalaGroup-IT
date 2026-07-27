import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('finance_cashbook_entries').select('entry_date').limit(10);
  if (error) console.error("Error:", error);
  else {
    const dates = [...new Set(data.map(d => d.entry_date.split('T')[0]))];
    console.log("DATES:", dates);
  }
}
test();
