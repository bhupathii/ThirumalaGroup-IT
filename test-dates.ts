import { supabase } from './src/lib/supabaseDatabase.ts';
async function test() {
  const { data } = await supabase.from('finance_cashbook_entries').select('entry_date').limit(10);
  console.log(data?.map(d => d.entry_date.split('T')[0]));
}
test();
