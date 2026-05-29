import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pmqeegdmcrktccszgbwu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtcWVlZ2RtY3JrdGNjc3pnYnd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDY1OTUsImV4cCI6MjA2NzQ4MjU5NX0.OqaYKbr2CcLd10JTdyy0IRawUPwW3KGCAbsPNThcCFM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Testing exec_sql connection...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'SELECT 1 AS test_val;'
  });
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
  }
}

run();
